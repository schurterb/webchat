/* globals mergeConstraints, parseJSON, iceCandidateType,
   maybePreferAudioReceiveCodec, maybePreferVideoReceiveCodec,
   maybePreferAudioSendCodec, maybePreferVideoSendCodec,
   maybeSetAudioSendBitRate, maybeSetVideoSendBitRate,
   maybeSetAudioReceiveBitRate, maybeSetVideoSendInitialBitRate,
   maybeSetVideoReceiveBitRate, maybeSetVideoSendInitialBitRate,
   maybeRemoveVideoFec, maybeSetOpusOptions, webchatTools, Crypto,
   RTCPeerConnection, RTCIceCandidate, RTCSessionDescription */

/* exported PeerConnection */

'use strict';

var PeerConnection = function(id, params, log_level=1) {
  this.peerId = id;
  this.params_ = params;
  this.log_level=log_level;
  
  if(this.log_level >= 2) {
    console.log("[pc]: "+JSON.stringify(this.params_));
  }
  this.startTime_ = Date.now();

  this.cryptoClient_ = null; //new Crypto(this.params_.roomKey);
  this.createAndConfigureRTCPeerConnection();
  
  this.dataChannel_ = null;
  this.pc_.ondatachannel = function(event) {
    if( !this.dataChannel_ ) {
      this.dataChannel_ = event.channel;
      this.dataChannel_.onmessage = this.receiveDataChannelMessage.bind(this);
    }
  }.bind(this); 
  
  this.hasRemoteSdp_ = false;
  this.messageQueue_ = [];
  this.messageQueueLock_ = false;
  this.isInitiator_ = false;
  this.started_ = false;
  
  this.onerror = null;
  this.oniceconnectionstatechange = null;
  this.onnewicecandidate = null;
  this.onremotehangup = null;
  this.onremotesdpset = null;
  this.onremotestreamadded = null;
  this.onsignalingmessage = null;
  this.onsignalingstatechange = null;
  this.ondatachannelmessage = null;
};

// Always set up audio and video, and don't use voice detection
PeerConnection.DEFAULT_SDP_OFFER_OPTIONS_ = {
  offerToReceiveAudio: 1,
  offerToReceiveVideo: 1,
  voiceActivityDetection: false
};

PeerConnection.prototype.createDataChannel = function(channelId) {
  this.dataChannel_ = this.pc_.createDataChannel(channelId, { id: webchatTools.randomString(4, '#') });
  this.dataChannel_.onmessage = this.receiveDataChannelMessage.bind(this);
}

PeerConnection.prototype.startConnection = function(offerOptions) {
  if (this.started_) { return false; }
  
  this.isInitiator_ = true;
  this.started_ = true;
  
  this.createDataChannel("Channel1");
  
  var constraints = mergeConstraints(PeerConnection.DEFAULT_SDP_OFFER_OPTIONS_, offerOptions);
  if(this.log_level >= 2) {
    console.log('[pc]: Sending offer to peer, with constraints: \n\''+JSON.stringify(constraints)+'\'.');
  }
  this.pc_.createOffer(constraints)
      .then(this.setLocalSdpAndNotify_.bind(this))
      .catch(this.onError_.bind(this, 'createOffer'));

  return true;
};

PeerConnection.prototype.joinConnection = function(initialMessages) {
  if (this.started_) { return false; }

  this.isInitiator_ = false;
  this.started_ = true;
  
  if (initialMessages && initialMessages.length > 0) {
    for (var i = 0, len = initialMessages.length; i < len; i++) {
      this.receiveSignalingMessage(initialMessages[i]);
    }
  }
  
  return true;
};

PeerConnection.prototype.close = function() {
  if (this.pc_) {
    this.pc_.close();
    this.pc_ = null;
  }
};

PeerConnection.prototype.receiveSignalingMessage = function(message) {
  if(message.length > 0) {
    var messageObj = parseJSON(message);
    if (!messageObj) {
      if(this.log_level >= 1) {
        console.log("[pc][error]: Failed to parse json='"+message+"'");
      }
      return;
    }
    if ((this.isInitiator_ && messageObj.type === 'answer') ||
        (!this.isInitiator_ && messageObj.type === 'offer')) {
      this.hasRemoteSdp_ = true;
      // Always process offer before candidates.
      this.messageQueue_.unshift(messageObj);
    } else if (messageObj.type === 'candidate') {
      this.messageQueue_.push(messageObj);
    } else if (messageObj.type === 'bye') {
      if (this.onremotehangup) {
        this.onremotehangup();
      }
    }
    
    var interval_id = setInterval(function() {
      if (this.pc_ && this.started_ && this.hasRemoteSdp_ && !this.messageQueueLock_) {
        this.messageQueueLock_ = true;
        var num_messages = this.messageQueue_.length
        if(num_messages > 0) {
          for (var i = 0; i < num_messages; i++) {
            this.processSignalingMessage_(this.messageQueue_[0]);
            this.messageQueue_.shift();
          }
        } else {
          clearInterval(interval_id);
        }
        this.messageQueueLock_ = true;
      }
      
    }.bind(this), 200, 500);
  }
};

PeerConnection.prototype.processSignalingMessage_ = function(message) {
  if (message.type === 'offer' && !this.isInitiator_) {
    if (this.pc_.signalingState !== 'stable') {
      if(this.log_level >= 1) {
        console.log('[pc][error]: remote offer received in unexpected state: ' +  this.pc_.signalingState);
      }
      return;
    }
    this.setRemoteSdp_(message);
    this.createAnswer_();
  } else if (message.type === 'answer' && this.isInitiator_) {
    if (this.pc_.signalingState !== 'have-local-offer') {
      if(this.log_level >= 1) {
        console.log('[pc][error]: remote answer received in unexpected state: ' + this.pc_.signalingState);
      }
      return;
    }
    this.setRemoteSdp_(message);
  } else if (message.type === 'candidate') {
    var candidate = new RTCIceCandidate({
      sdpMLineIndex: message.label,
      candidate: message.candidate
    });
    this.recordIceCandidate_('Remote', candidate);
    this.pc_.addIceCandidate(candidate)
        .then( function () {
          if(this.log_level >= 2) {
            console.log('[pc]: Remote candidate added successfully.')
          }
        })
        .catch(this.onError_.bind(this, 'addIceCandidate'));
  } else {
    if(this.log_level >= 1) {
      console.log('[pc][warn]: unexpected message: ' + JSON.stringify(message));
    }
  }
};

PeerConnection.prototype.getPeerConnectionStates = function() {
  if (this.pc_) {
    return {
      'signalingState': this.pc_.signalingState,
      'iceGatheringState': this.pc_.iceGatheringState,
      'iceConnectionState': this.pc_.iceConnectionState
    };
  }
};

PeerConnection.prototype.getPeerConnectionStats = function(callback) {
  if (!this.pc_) {
    return;
  }
  this.pc_.getStats(null).then(callback);
};

PeerConnection.prototype.createAnswer_ = function() {
  if(this.log_level >= 2) {
    console.log('[pc]: Sending answer to peer.');
  }
  this.pc_.createAnswer()
      .then(this.setLocalSdpAndNotify_.bind(this))
      .catch(this.onError_.bind(this, 'createAnswer'));
};

PeerConnection.prototype.setLocalSdpAndNotify_ = function(sessionDescription) 
{
  sessionDescription.sdp = maybeSetOpusOptions(sessionDescription.sdp, this.params_);
  sessionDescription.sdp = maybePreferAudioReceiveCodec(sessionDescription.sdp, this.params_);
  sessionDescription.sdp = maybePreferVideoReceiveCodec(sessionDescription.sdp, this.params_);
  sessionDescription.sdp = maybeSetAudioReceiveBitRate(sessionDescription.sdp, this.params_);
  sessionDescription.sdp = maybeSetVideoReceiveBitRate(sessionDescription.sdp, this.params_);
  sessionDescription.sdp = maybeRemoveVideoFec(sessionDescription.sdp, this.params_);
  
  this.pc_.setLocalDescription(sessionDescription)
      .then( function() {
        if(this.log_level >= 2) {
          console.log('[pc]: Set session description success.');
        }
      })
      .catch(this.onError_.bind(this, 'setLocalDescription'));

  if (this.onsignalingmessage) {
    // To avoid issue with Chrome version of RTCSessionDescription ...
    this.onsignalingmessage({
      sdp: sessionDescription.sdp,
      type: sessionDescription.type
    }, this.peerId);
  }
};

PeerConnection.prototype.setRemoteSdp_ = function(message) {
  message.sdp = maybeSetOpusOptions(message.sdp, this.params_);
  message.sdp = maybePreferAudioSendCodec(message.sdp, this.params_);
  message.sdp = maybePreferVideoSendCodec(message.sdp, this.params_);
  message.sdp = maybeSetAudioSendBitRate(message.sdp, this.params_);
  message.sdp = maybeSetVideoSendBitRate(message.sdp, this.params_);
  message.sdp = maybeSetVideoSendInitialBitRate(message.sdp, this.params_);
  message.sdp = maybeRemoveVideoFec(message.sdp, this.params_);
  
  this.pc_.setRemoteDescription(new RTCSessionDescription(message))
      .then(this.onSetRemoteDescriptionSuccess_.bind(this))
      .catch(this.onError_.bind(this, 'setRemoteDescription'));
};

PeerConnection.prototype.onSetRemoteDescriptionSuccess_ = function() {
  if(this.log_level >= 2) {
    console.log('[pc]: Set remote session description success. Checking for remote streams.');
  }
  var remoteStreams = this.pc_.getReceivers(); // getRemoteStreams is deprecated
  if (this.onremotesdpset) {
    this.onremotesdpset(remoteStreams.length > 0 && remoteStreams[0].getVideoTracks().length > 0);
  }
};

PeerConnection.prototype.recordIceCandidate_ = function(location, candidateObj) {
  if (this.onnewicecandidate) { this.onnewicecandidate(location, candidateObj.candidate); }
};

PeerConnection.prototype.addStream = function(stream) {
  if (this.pc_) { this.pc_.addStream(stream); }
};

PeerConnection.prototype.onError_ = function(tag, error) {
  if(this.log_level >= 1) {
    console.log('['+tag+'][error]: '+error.toString());
  }
};

PeerConnection.prototype.createAndConfigureRTCPeerConnection = function() {
  if(this.log_level >= 2) {
    console.log('[pc]: Creating RTCPeerConnnection with:\n' +
                '  config: \'' + JSON.stringify(this.params_.peerConnectionConfig) + '\';\n' +
                '  constraints: \'' + JSON.stringify(this.params_.peerConnectionConstraints) +
                '\'.');
  }

  this.pc_ = new RTCPeerConnection(this.params_.peerConnectionConfig, this.params_.peerConnectionConstraints);
  
  // Change this to possibly terminate PeerConnection
  this.pc_.onremovestream = function() {
    if(this.log_level >= 2) {
      console.log('[pc]: Remote stream removed.');
    }
  }
  
  // Add various event handlers
  this.pc_.onicecandidate = function(event) {
    if (event.candidate) {
      if ( !(event.candidate.candidate.indexOf('tcp') !== -1) && 
           !(this.params_.peerConnectionConfig.iceTransports === 'relay' && 
             iceCandidateType(event.candidate.candidate) !== 'relay') )
      {
        if (this.onsignalingmessage) {
          this.onsignalingmessage({
            type: 'candidate',
            label: event.candidate.sdpMLineIndex,
            id: event.candidate.sdpMid,
            candidate: event.candidate.candidate
          }, this.peerId);
        }
        this.recordIceCandidate_('Local', event.candidate);
      }
    } else {
      if(this.log_level >= 2) {
        console.log('[pc]: End of candidates.');
      }
    }
  }.bind(this);
  this.pc_.ontrack = function(event) {
    if (this.onremotestreamadded) { this.onremotestreamadded(event.streams[0]); }
  }.bind(this);
  this.pc_.onsignalingstatechange = function() {
    if (this.pc_) {
      if(this.log_level >= 2) {
        console.log('[pc]: Signaling state changed to: ' + this.pc_.signalingState);
      }
      if (this.onsignalingstatechange) { this.onsignalingstatechange({peerId: this.peerId, signalingState: this.pc_.signalingState}); }
    }
  }.bind(this);
  this.pc_.oniceconnectionstatechange = function() {
    if (this.pc_) {
      if(this.log_level >= 2) {
        console.log('[pc]: ICE connection state changed to: ' + this.pc_.iceConnectionState);
      }
      if (this.pc_.iceConnectionState === 'completed') {
        if(this.log_level >= 2) {
          console.log('[pc]: ICE complete time: ' + (Date.now() - this.startTime_).toFixed(0) + 'ms.');
        }
      }
      if (this.oniceconnectionstatechange) {  this.oniceconnectionstatechange({peerId: this.peerId, iceConnectionState: this.pc_.iceConnectionState}); }
    }
  }.bind(this);
};

PeerConnection.prototype.getRTCPeerConnection = function() {
  return this.pc_;
};

PeerConnection.prototype.getDataChannel = function() {
  return this.dataChannel_;
};

PeerConnection.prototype.sendDataChannelMessage = function(message) {
  if(this.dataChannel_ && (this.dataChannel_.readyState == "open")) {
    if(this.cryptoClient_) {
      message = this.cryptoClient_.encrypt(message);
    }
    if(this.log_level >= 3) {
      console.log('[pc]: sending message to ' + this.peerId + ' :: ' + message);
    }
    this.dataChannel_.send(message);
    return true;
  } else {
    return false;
  }
}

PeerConnection.prototype.receiveDataChannelMessage = function(event) {
  var message = event.data;
  if(this.cryptoClient_) {
    message = this.cryptoClient_.decrypt(message);
  }
  if(this.log_level >= 3) {
    console.log('[pc]: received message from ' + this.peerId + ' :: ' + message);
  }
  if(this.ondatachannelmessage) {
    this.ondatachannelmessage(message);
  }
}

PeerConnection.prototype.restartIce = function() {
  this.pc_.restartIce();
}