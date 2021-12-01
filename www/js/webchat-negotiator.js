
/* globals navigator, WebchatServerlessChannel, PeerConnection, 
   webchatTools, RTCPeerConnection, webchatServerless */

/* exported Negotiator */

'use strict';

var Negotiator = function(params, channel) {
  this.params_ = params;
  this.channel_ = channel;
  this.peers_ = {};
  this.peerLocks_ = {};
  this.started_ = false;
  this.startTime_ = null;
  
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
    this.params_.roomId = roomParams.room_id;
    this.params_.roomKey = webchatServerless.room_password;
    this.params_.roomLink = roomParams.room_link;
    this.params_.isInitiator = roomParams.is_initiator === 'true';

    this.params_.messages = roomParams.messages;
  }.bind(this)).catch(function(error) {
    this.onError_('Error occured joinging room.  Reason: ' + error.message);
    return Promise.reject(error);
  }.bind(this));
  
  // 1) Open channel and 2) join room
  Promise.all([channelPromise, joinPromise]).then(function() {
    
    // 3) register channel
    Promise.all([this.channel_.register(this.params_.roomId, this.params_.clientId, this.startTime_)]).then(function() {
      
      // 4) Get Ice servers and 5) media
      Promise.all([iceServersPromise, mediaPromise]).then(function() {
        
        // 6) Initialize Certificates
        Promise.all([this.maybeInitializeCertificates()]).then(function(){
        
          // 7) Finally, start signalling.
          this.startSignaling_();
          this.started_ = true;
        }.bind(this));
      }.bind(this)).catch(function(error) {
        this.onError_('Failed to start signaling.  Reason: ' + error.message);
      }.bind(this));
    }.bind(this));
  }.bind(this)).catch(function(error) {
    this.onError_('Error occured while registering channel.  Reason: ' + error.message);
  }.bind(this));
};

Negotiator.prototype.joinRoom_ = function() {
  return new Promise(async function(resolve, reject) {
    
    if (!this.params_.roomId) {
      reject(Error('Missing room id.'));
    }
    
    var room_id = this.params_.roomId;
    var media_constraints = JSON.stringify(this.params_.mediaConstraints);
    
    var client_id = this.params_.clientId;
    var room_link = webchatTools.createRoomLink(room_id);
    //TODO: Create the room, too!
    var pc_config = webchatTools.initPcConfig();
    
    var fileList = await webchatServerless.listFiles();
    var is_initiator = "true";
    var messages = [];
    if(fileList.length > 0) {
      is_initiator = "false";
      messages = await webchatServerless.getFile(fileList[0]);
      messages = JSON.parse(messages.Body);
    }
    
    var responseObj = {
      "params": {
        "offer_options": "{}", 
        "client_id": client_id, 
        "room_id": room_id, 
        "pc_config": pc_config, 
        "pc_constraints": "{\"optional\": []}",
        "is_initiator": is_initiator, 
        "messages": messages, 
        "warning_messages": [], 
        "error_messages": [], 
        "is_loopback": "false",
        "media_constraints": "{\"audio\": false, \"video\": false}", 
      }, 
      "result": "SUCCESS"
    }
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
          console.log('Got access to local media with mediaConstraints:\n' +
          '  \'' + JSON.stringify(mediaConstraints) + '\'');

          this.onUserMediaSuccess_(stream);
        }.bind(this)).catch(function(error) {
          this.onError_('Error getting user media: ' + error.message);
          this.onUserMediaError_(error);
        }.bind(this));
  } else {
    mediaPromise = Promise.resolve();
  }
  return mediaPromise;
};

// Asynchronously request an ICE server if needed.
Negotiator.prototype.maybeGetIceServers_ = function() {
  if ( !this.params_.peerConnectionConfig.iceServers || (this.params_.peerConnectionConfig.iceServers.length === 0)) {
    this.params_.peerConnectionConfig.iceServers = webchatTools.getIceServers(2);
  }
  return Promise.resolve();
};

Negotiator.prototype.maybeInitializeCertificates = function() {
  return new Promise(function(resolve, reject) {
    if (typeof RTCPeerConnection.generateCertificate === 'function') {
      var certParams = {name: 'ECDSA', namedCurve: 'P-256'};
      RTCPeerConnection.generateCertificate(certParams)
          .then(function(cert) {
            console.log('ECDSA certificate generated successfully.');
            this.params_.peerConnectionConfig.certificates = [cert];
          }.bind(this))
          .catch(function(error) {
            console.log('ECDSA certificate generation failed.');
            reject(error);
          });
    }
    resolve(true);
  }.bind(this));
};

Negotiator.prototype.startSignaling_ = function() {
};

Negotiator.prototype.onRecvSignalingChannelMessage_ = function(msg) {
  this.getPeerConnection(msg.peer, msg.start_time).receiveSignalingMessage(msg.data);
};

Negotiator.prototype.getPeerConnection = function( peer, startTime ) {
  console.log("Getting connection to peer : "+peer);
  if(Object.keys(this.peers_).indexOf(peer) < 0) {
    //In the case of the first peer connection we receive, we should rename it to match the remote client.
    this.peers_[peer] = this.createPeerConnection_(peer);
    this.onnewconnection({peerId: peer, peerConnection: this.peers_[peer]})
    
    if ((startTime != null) && (this.startTime_ > startTime)) {
      this.peers_[peer].startConnection(this.params_.offerOptions);
    } else {
      this.peers_[peer].joinConnection(this.params_.messages);
    }
  }
  return this.peers_[peer];
}

Negotiator.prototype.getPeerConnectionAsync = function( peer ) {
  //TODO: implement this!
}

Negotiator.prototype.createPeerConnection_ = function(peerId) {
  let pcClient = new PeerConnection(peerId, this.params_);
  pcClient.onsignalingmessage = this.sendSignalingMessage_.bind(this);
  pcClient.ondatachannelmessage = this.ondatachannelmessage;
  pcClient.onremotehangup = this.onremotehangup;
  pcClient.onremotesdpset = this.onremotesdpset;
  pcClient.onremotestreamadded = this.onremotestreamadded;
  pcClient.onsignalingstatechange = this.onsignalingstatechange;
  pcClient.oniceconnectionstatechange = this.oniceconnectionstatechange;
  pcClient.onnewicecandidate = this.onnewicecandidate;
  pcClient.onerror = this.onerror;
  return pcClient;
};

Negotiator.prototype.sendSignalingMessage_ = async function(message, peerId) {
  var msgString = JSON.stringify(message);
  await this.channel_.send(msgString, peerId);
};

Negotiator.prototype.onError_ = function(message) {
  if (this.onerror) {
    this.onerror(message);
  }
};

Negotiator.prototype.listPeerIds = function() {
  return Object.getKeys(this.peers_);
}
