
/* globals PeerConnection, RoomSelection, $, webchatServerless,
           queryStringToDictionary, Negotiator, UI_CONSTANTS */

/* exported WebchatService */

var WebchatService = function(params, channel) {
  this.params_ = params;
  this.channel_ = channel;
  this.connectedPeers_ = [];
  this.dataChannelMessageHandlers_ = [];
  
  this.roomLink_ = '';
  this.localStream_ = null;
  this.remoteVideoResetTimer_ = null;
  this.roomId_ = null;
  this.roomPassword = null;
  this.startTime = null;
  
  this.loadUrlParams_();
  
  this.onError_ = null;
  this.onRemoteHangup_ = null;
  this.onRemoteSdpSet_ = null;
  this.onRemoteStreamAdded_ = null;
  this.onLocalStreamAdded_ = null;
  
  this.onNewPeerConnection_ = function(event) {
    console.log(" ### Received Peer Connection Event for "+event.peerId+"! ### ");
    this.connectedPeers_[event.peerId] = event.peerConnection;
  }.bind(this); 
  this.onIceConnectionStateChanged_ = function(event) {
    //console.log(" ## ## Received ICE Connection State event :: "+JSON.stringify(event));
  }.bind(this);
  this.onSignalingStateChanged_ = function(event) {
    //console.log(" ## ## onsignalingstatechange event :: "+JSON.stringify(event));
  };
  this.onNewIceCandidate_ = function(location, candidate) {
    //console.log(" ## ## onnewicecandidate event :: location = "+JSON.stringify(location)+", candidate = "+JSON.stringify(candidate));
  };
}

WebchatService.prototype.start = function(roomId, roomPassword) {
  this.startTime = Date.now();
  
  console.log(" ### Room Id = "+roomId);
  this.params_.roomId = roomId;
  this.negotiator_ = new Negotiator(this.params_, this.channel_);

  if(this.params_.errorMessages) {
    var roomErrors = this.params_.errorMessages;
    if (roomErrors && roomErrors.length > 0) {
      for (var i = 0; i < roomErrors.length; ++i) {
        console.log("Room Error: "+roomErrors[i]);
      }
      return;
    }
  }
  
  if(this.params_.warningMessages) {
    var roomWarnings = this.params_.warningMessages;
    if (roomWarnings && roomWarnings.length > 0) {
      for (var j = 0; j < roomWarnings.length; ++j) {
        console.log("Room Warning: "+roomWarnings[i]);
      }
    }
  }
  
  this.negotiator_.onnewconnection = this.onNewPeerConnection_;
  this.negotiator_.ondatachannelmessage = this.onDataChannelMessage_.bind(this);
  
  this.negotiator_.onremotehangup = this.onRemoteHangup_;
  this.negotiator_.onremotesdpset = this.onRemoteSdpSet_;
  this.negotiator_.onremotestreamadded = this.onRemoteStreamAdded_;
  this.negotiator_.onlocalstreamadded = this.onLocalStreamAdded_;
  
  this.negotiator_.onerror = this.onError_;

  this.negotiator_.onsignalingstatechange = this.onSignalingStateChanged_;
  this.negotiator_.oniceconnectionstatechange = this.onIceConnectionStateChanged_;
  this.negotiator_.onnewicecandidate = this.onNewIceCandidate_;
  
  this.negotiator_.start(this.params_.roomId);
  
  //TODO: Add logic to process data channel messages from peers.
  
  //TODO: Add logic to handler new peers.
};

// Sends a message to the specified peers, if connected.
// If no peers are specified, then it sends the message to all peers.
WebchatService.prototype.sendDataChannelMessage = function(message, peers = []) {
  if( !peers || (peers.length == 0)) {
    peers = Object.keys(this.connectedPeers_);
  }
  
  for(let i=0; i<peers.length; i++) {
    try {
      this.connectedPeers_[peers[i]].sendDataChannelMessage(message);
    } catch(e) {
      console.log("Error sending outgoing data channel message.");
      console.log(e);
    }
  }
}

// Adds a handler to process data channel messages.
WebchatService.prototype.addDataChannelMessageHandler = function(handler) {
  if(handler && !this.dataChannelMessageHandlers_.includes(handler)) {
    this.dataChannelMessageHandlers_.push(handler);
  }
}

// Handle incoming data channel messages
WebchatService.prototype.onDataChannelMessage_ = function( message ) {
  for(let i=0; i<this.dataChannelMessageHandlers_.length; i++) {
    try {
      this.dataChannelMessageHandlers_[i](message);
    } catch(e) {
      console.log("Error processing incoming data channel message.");
      console.log(e);
    }
  }
}

WebchatService.prototype.loadUrlParams_ = function() {
  /* eslint-disable dot-notation */
  var DEFAULT_VIDEO_CODEC = 'VP9';
  var urlParams = queryStringToDictionary(window.location.search);
  this.params_.audioSendBitrate = urlParams['asbr'];
  this.params_.audioSendCodec = urlParams['asc'];
  this.params_.audioRecvBitrate = urlParams['arbr'];
  this.params_.audioRecvCodec = urlParams['arc'];
  this.params_.opusMaxPbr = urlParams['opusmaxpbr'];
  this.params_.opusFec = urlParams['opusfec'];
  this.params_.opusDtx = urlParams['opusdtx'];
  this.params_.opusStereo = urlParams['stereo'];
  this.params_.videoSendBitrate = urlParams['vsbr'];
  this.params_.videoSendInitialBitrate = urlParams['vsibr'];
  this.params_.videoSendCodec = urlParams['vsc'];
  this.params_.videoRecvBitrate = urlParams['vrbr'];
  this.params_.videoRecvCodec = urlParams['vrc'] || DEFAULT_VIDEO_CODEC;
  this.params_.videoFec = urlParams['videofec'];
  /* eslint-enable dot-notation */
};

WebchatService.prototype.hangup = function(boolean_flag) {
  console.log("webchat-service - TODO: Implement hangup");
};

WebchatService.prototype.onRemoteHangup = function() {
  console.log("webchat-service - TODO: Implement onRemoteHangup");
};

WebchatService.prototype.restart = function() {
  console.log("webchat-service - TODO: Implement restart");
};

WebchatService.prototype.toggleAudioMute = function() {
  console.log("webchat-service - TODO: Implement toggleAudioMute");
};

WebchatService.prototype.toggleVideoMute = function() {
  console.log("webchat-service - TODO: Implement toggleVideoMute");
};