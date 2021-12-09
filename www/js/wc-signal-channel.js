
/* globals webchatTools, SignalServerConnector */
/* exported WebchatSignalChannel */

'use strict';

var WebchatSignalChannel = function() {
  this.roomId_ = null;
  this.clientId_ = null;
  this.knownPeers_ = {};
  this.registered_ = false;

  this.onerror = null;
  this.onmessage = null;
  
  this.message_in_progress = false;
  this.message_queue = [];
  
  this.connection = new SignalServerConnector(this.clientId_);
};

WebchatSignalChannel.prototype.open = function(startTime) {
  if (this.registered_) {
    console.log('ERROR: WebchatSignalChannel has already opened.');
    return;
  }
  
  console.log('Opening signaling channel.');
  if(!startTime) {
    startTime = window.performance.now();
  }
  
  if (this.clientId_ && this.roomId_) {
    this.register(this.roomId_, this.clientId_, startTime);
  }
};

WebchatSignalChannel.prototype.register = function(roomId, clientId, startTime) {
  if (this.registered_) {
    console.log('ERROR: WebchatSignalChannel has already registered.');
    return;
  }

  this.roomId_ = roomId;
  this.clientId_ = clientId;

  if (!this.roomId_) {
    console.log('ERROR: missing roomId.');
  }
  if (!this.clientId_) {
    console.log('ERROR: missing clientId.');
  }
  console.log('Registering signaling channel.');
  var data = {
    "start_time": startTime
  }
  
  console.log('Starting listener');
  this.connection.onmessage = function( message ) {
    if (this.onmessage) {
      this.onmessage( message) 
    }
       
      // for(var i=0; i<files.length; i++) {
      //   if(files[i] != this.clientId_) {
          
      //     var contents = await webchatServerless.getFile(files[i]);
      //     var messages = JSON.parse(contents.Body);
          
      //     // Initialize peer map
      //     if(Object.keys(this.knownPeers_).indexOf(files[i]) == -1) {
      //       console.log("Found new peer: "+files[i]);
      //       this.knownPeers_[files[i]] = 0;
      //       this.onmessage({data: "", peer: files[i], start_time: messages["start_time"]});
      //     }
          
      //     if((Object.keys(messages).indexOf(this.clientId_) >= 0) && (this.knownPeers_[files[i]] < messages[this.clientId_].length)) {
            
      //       for(let j = this.knownPeers_[files[i]]; j<messages[this.clientId_].length; j++) {
      //         this.onmessage({data: messages[this.clientId_][j], peer: files[i], start_time: messages["start_time"]});
      //       }
            
      //       this.knownPeers_[files[i]] = messages[this.clientId_].length;
      //     }
      //   }
      // }
      
  }
  
  this.connection.connect();
  console.log('Signaling channel registered.');
  this.registered_ = true;
};

WebchatSignalChannel.prototype.close = async function(async) {
  if (this.clientId_) {
    this.clientId_ = null;
  } 
  if (this.roomId_) {
    this.roomId_ = null;
  }
  webchatServerless.disconnect();
  this.registered_ = false;
};

WebchatSignalChannel.prototype.send = function(message, peerId) {
  if (!this.roomId_ || !this.clientId_) {
    console.log('ERROR: WebchatSignalChannel not connected to a room.');
    return;
  }
  
  var message_id = webchatTools.randomString(20);
  
  if( this.registered_ ) {
    var data = {
      "clientId": this.clientId_,
      "peerId": peerId,
      "message": message
    };
    this.connection.send(JSON.stringify(data));
  } else {
    console.log('ERROR: WebchatSignalChannel not registered.');
  }
};
