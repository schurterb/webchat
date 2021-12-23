
/* globals navigator, PeerConnection, 
   webchatTools, RTCPeerConnection */

/* exported Negotiator */

'use strict';

var Negotiator = function(params, channel, log_level=0) {
  this.params_ = params;
  this.channel_ = channel;
  this.log_level = log_level;
  
  this.peers_ = {};
  this.peerLocks_ = {};
  this.started_ = false;
  this.startTime_ = null;
  
  this.connection_attempts_ = {};
  this.max_retries = 5;
  this.retry_delay = 1;
  
  this.onnewconnection = null;
  this.ondatachannelmessage = null;
  
  this.onerror = null;
  this.onnewicecandidate = null;
  this.oniceconnectionstatechange = null;
  this.onsignalingstatechange = null;
  this.onlocalstreamadded = null;
  this.onremotestreamadded = null;
  this.onremotehangup = null;
  this.onremotesdpset = null;
};


Negotiator.prototype.start = function(roomId, roomKey) {
  this.startTime_ = Date.now();
  this.params_.roomId = roomId;
  this.params_.roomKey = roomKey;
  
  this.channel_.onmessage = this.onRecvSignalingChannelMessage_.bind(this);
  
  // Asynchronously initialize everything
  var mediaPromise = this.maybeGetMedia_();
  var iceServersPromise = this.maybeGetIceServers_();
  var channelPromise = this.channel_.open(this.startTime_);
  
  // Asynchronously join the room.
  var joinPromise = this.joinRoom_().then(function(roomParams) {
    
    this.params_.clientId = roomParams.client_id;
    this.params_.roomLink = roomParams.room_link;
    this.params_.isInitiator = roomParams.is_initiator === 'true';

    this.params_.messages = roomParams.messages;
  }.bind(this)).catch(function(error) {
    this.onError_('Error occured joinging room.  Reason: ' + error.message);
    return Promise.reject(error);
  }.bind(this));
  
  if(this.log_level >= 2) { console.log("[negotiator]: Initializing..."); }
  // 1) Open channel and 2) join room
  Promise.all([channelPromise, joinPromise]).then(function() {
    // 3) register channel
    Promise.all([this.channel_.register(this.params_.roomId, this.params_.clientId, this.startTime_)]).then(function() {
      // 4) Get Ice servers and 5) media
      Promise.all([iceServersPromise, mediaPromise]).then(function() {
        // 6) Initialize Certificates
        Promise.all([this.maybeInitializeCertificates()]).then(function(){
          this.started_ = true;
        }.bind(this));
      }.bind(this)).catch(function(error) {
        if(this.log_level >= 1) { console.log("[negotiator][error]: Failed to start signaling.  Reason: " + error.message); }
      }.bind(this));
    }.bind(this));
  }.bind(this)).catch(function(error) {
    if(this.log_level >= 1) { console.log("[negotiator][error]: Error occured while registering channel.  Reason: " + error.message); }
  }.bind(this));
};

Negotiator.prototype.joinRoom_ = function() {
  return new Promise(async function(resolve, reject) {
    if (!this.params_.roomId) { reject(Error('Missing room id.')); }
    
    var responseObj = {
      "params": {
        "offer_options": "{}", 
        "client_id": this.params_.clientId, 
        "room_id": this.params_.roomId, 
        "pc_config": webchatTools.initPcConfig(), 
        "pc_constraints": "{\"optional\": []}",
        "is_initiator": "true", 
        "messages": [], 
        "warning_messages": [], 
        "error_messages": [], 
        "is_loopback": "false",
        "media_constraints": JSON.stringify(this.params_.mediaConstraints), 
      }, 
      "result": "SUCCESS"
    };
    resolve(responseObj.params);
    
  }.bind(this));
};

// Asynchronously request user media if needed.
Negotiator.prototype.maybeGetMedia_ = function() {
  
  var needStream = (this.params_.mediaConstraints.audio !== false ||
                    this.params_.mediaConstraints.video !== false);
  var mediaPromise = null;
  if (needStream) {
    var mediaConstraints = this.params_.mediaConstraints;

    mediaPromise = navigator.mediaDevices.getUserMedia(mediaConstraints)
        .catch(function(error) {
          if (error.name !== 'NotFoundError') {
            throw error;
          }
          return navigator.mediaDevices.enumerateDevices()
              .then(function(devices) {
                var cam = devices.find(function(device) {
                  return device.kind === 'videoinput';
                });
                var mic = devices.find(function(device) {
                  return device.kind === 'audioinput';
                });
                var constraints = {
                  video: cam && mediaConstraints.video,
                  audio: mic && mediaConstraints.audio
                };
                return navigator.mediaDevices.getUserMedia(constraints);
              });
        })
        .then(function(stream) {
          if(this.log_level >= 2) {
            console.log('[negotiator]: Got access to local media with mediaConstraints:\n  \'' + JSON.stringify(mediaConstraints) + '\'');
          }
          this.onUserMediaSuccess_(stream);
        }.bind(this)).catch(function(error) {
          if(this.log_level >= 1) { console.log('[negotiator][error]: Error getting user media: ' + error.message); }
          this.onUserMediaError_(error);
        }.bind(this));
  } else {
    mediaPromise = Promise.resolve();
  }
  return mediaPromise;
};

// Asynchronously get ice servers if needed.
Negotiator.prototype.maybeGetIceServers_ = function() {
  return new Promise(function(resolve, reject) {
    if ( !this.params_.peerConnectionConfig.iceServers || (this.params_.peerConnectionConfig.iceServers.length === 0)) {
      this.params_.peerConnectionConfig.iceServers = webchatTools.getIceServers(2);
    }
    resolve(true);
  }.bind(this));
};

// Asynchronously init certificates if needed.
Negotiator.prototype.maybeInitializeCertificates = function() {
  return new Promise(function(resolve, reject) {
    if (typeof RTCPeerConnection.generateCertificate === 'function') {
      var certParams = {name: 'ECDSA', namedCurve: 'P-256'};
      RTCPeerConnection.generateCertificate(certParams)
          .then(function(cert) {
            if(this.log_level >= 2) { console.log('[negotiator]: ECDSA certificate generated successfully.'); }
            this.params_.peerConnectionConfig.certificates = [cert];
          }.bind(this))
          .catch(function(error) {
            if(this.log_level >= 2) { console.log('[negotiator]: ECDSA certificate generation failed.'); }
            reject(error);
          });
    }
    resolve(true);
  }.bind(this));
};

Negotiator.prototype.onRecvSignalingChannelMessage_ = function(msg) {
  if (msg.type == 'new_peer') {
    //Start connection with this new peer
    this.getPeerConnection(msg.peer_id, null, true);
  } else if (msg.contents != null) {
    this.getPeerConnection(msg.contents.client_id, msg.contents.start_time, false).receiveSignalingMessage(msg.contents.message);
  } else {
    if(this.log_level >= 1) { console.log('[negotiator][warn]: unhandled signaling message :: ',msg); }
  }
};

Negotiator.prototype.listPeers = function() {
  return Object.keys(this.peers_);
}

Negotiator.prototype.getPeerConnection = function( peer, startTime = null, initiate_anyway = false ) {
  if(Object.keys(this.peers_).indexOf(peer) < 0) {
    
    this.peers_[peer] = this.createPeerConnection_(peer);
    
    // If this is a retry, regenerate the ice candidates
    // else initialize the connection attempt entry
    if( !Object.keys(this.connection_attempts_).includes(peer) ) { 
      this.connection_attempts_[peer] = 1;
    } else {
      if(this.connection_attempts_[peer] > 1) {
        this.peers_[peer].restartIce();
      }
    }
    
    if ( initiate_anyway || ((startTime != null) && (this.startTime_ > startTime)) ) {
      this.peers_[peer].startConnection(this.params_.offerOptions);
    } else {
      this.peers_[peer].joinConnection(this.params_.messages);
    }
    
    //Notify others of new connection
    if(this.onnewconnection) {
      this.onnewconnection({peerId: peer, peerConnection: this.peers_[peer]});
    }
  }
  return this.peers_[peer];
}

Negotiator.prototype.createPeerConnection_ = function(peerId) {
  let pcClient = new PeerConnection(peerId, this.params_, this.log_level);
  pcClient.onsignalingmessage = this.sendSignalingMessage_.bind(this);
  pcClient.ondatachannelmessage = this.ondatachannelmessage;
  pcClient.onremotehangup = this.onremotehangup;
  pcClient.onremotesdpset = this.onremotesdpset;
  pcClient.onremotestreamadded = this.onremotestreamadded;
  pcClient.onsignalingstatechange = this.onsignalingstatechange;
  pcClient.oniceconnectionstatechange = function( event ) {
    
    if(this.log_level >= 2) { console.log("[negotiator]: Received ICE connection state change event :: ",event); }
    if( (event.iceConnectionState == 'disconnected') || (event.iceConnectionState == 'failed')) {
      if( Object.keys(this.peers_).includes(event.peerId) ) {
        
        if(this.log_level >= 2) { console.log("[negotiator]: Removing disconnected or failed connection to ",event.peerId); }
        if( !this.peers_[event.peerId].isInitiator_ && (event.iceConnectionState == 'failed') ) {
          
          if (this.connection_attempts_[event.peerId] < this.max_retries) {
            if(this.log_level >= 2) { console.log("[negotiator]: Attempting to initiate connection to ",event.peerId," :: Attempt",this.connection_attempts_[event.peerId]); }
            this.connection_attempts_[event.peerId] += 1;
            setTimeout( this.onRecvSignalingChannelMessage_({type: "new_peer", peer_id: event.peerId}), this.retry_delay * this.connection_attempts_[event.peerId]);
          } else {
            delete this.connection_attempts_[event.peerId];
          }
          
        }
        delete this.peers_[event.peerId];
      }
    }
    
    //Forward ice connection event
    if( this.oniceconnectionstatechange ) { this.oniceconnectionstatechange(event); }
  }.bind(this);
  pcClient.onnewicecandidate = this.onnewicecandidate;
  pcClient.onerror = this.onerror;
  return pcClient;
};

Negotiator.prototype.sendSignalingMessage_ = function(message, peerId) {
  var msgString = JSON.stringify(message);
  this.channel_.send(msgString, peerId);
};

Negotiator.prototype.listPeerIds = function() {
  return Object.getKeys(this.peers_);
}

Negotiator.prototype.onUserMediaSuccess_ = function( stream ) {
  if(this.log_level >= 2) { console.log("[negotiator][media]: stream received"); }
}
Negotiator.prototype.onUserMediaError_ = function( error ) {
  if(this.log_level >= 1) { console.log("[negotiator][media][error]: ",error); }
}