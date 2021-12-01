
/* globals webchatTools, webchatServerless */
/* exported WebchatServerlessChannel */

'use strict';

var WebchatServerlessChannel = function() {
  this.roomId_ = null;
  this.clientId_ = null;
  this.knownPeers_ = {};
  this.registered_ = false;

  this.onerror = null;
  this.onmessage = null;
  
  this.message_in_progress = false;
  this.message_queue = [];
};

WebchatServerlessChannel.prototype.open = function(startTime) {
  if (this.registered_) {
    console.log('ERROR: WebchatServerlessChannel has already opened.');
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

WebchatServerlessChannel.prototype.register = async function(roomId, clientId, startTime) {
  if (this.registered_) {
    console.log('ERROR: WebchatServerlessChannel has already registered.');
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
  this.connectionFile_ = this.clientId_;
  var data = {
    "start_time": startTime
  }
  var output = await webchatServerless.createFile(this.connectionFile_, JSON.stringify(data));
  this.registered_ = true; //TODO: Verify that we can write to the file place...
  console.log('Signaling channel registered.');
  
  console.log('Starting listener');
  var interval_id = setInterval(async function() {
    if (this.onmessage && this.registered_ && !this.message_in_progress) {
      this.message_in_progress = true;
      
      var files = await webchatServerless.listFiles();
      for(var i=0; i<files.length; i++) {
        if(files[i] != this.clientId_) {
          
          var contents = await webchatServerless.getFile(files[i]);
          var messages = JSON.parse(contents.Body);
          
          // Initialize peer map
          if(Object.keys(this.knownPeers_).indexOf(files[i]) == -1) {
            console.log("Found new peer: "+files[i]);
            this.knownPeers_[files[i]] = 0;
            this.onmessage({data: "", peer: files[i], start_time: messages["start_time"]});
          }
          
          if((Object.keys(messages).indexOf(this.clientId_) >= 0) && (this.knownPeers_[files[i]] < messages[this.clientId_].length)) {
            
            for(let j = this.knownPeers_[files[i]]; j<messages[this.clientId_].length; j++) {
              this.onmessage({data: messages[this.clientId_][j], peer: files[i], start_time: messages["start_time"]});
            }
            
            this.knownPeers_[files[i]] = messages[this.clientId_].length;
          }
        }
      }
      
      this.message_in_progress = false;
    }
  }.bind(this), 10000, 10000);
};

WebchatServerlessChannel.prototype.close = async function(async) {
  if (!this.clientId_ || !this.roomId_) {
    return;
  }
  
  var output = await webchatServerless.deleteFile(this.connectionFile_);
  this.connectionFile_ = null;
};

WebchatServerlessChannel.prototype.send = function(message, peerId) {
  if (!this.roomId_ || !this.clientId_) {
    console.log('ERROR: WebchatServerlessChannel has not registered.');
    return;
  }
  
  var message_id = webchatTools.randomString(20);
  this.message_queue.push(message_id);
  
  var interval_id = setInterval(async function() {
    if( this.registered_ && (this.message_queue[0] == message_id) && !this.message_in_progress ) {
      this.message_in_progress = true;
      var contents = await webchatServerless.getFile(this.connectionFile_);
      var data = JSON.parse(contents.Body);
      if(!data[peerId])
        data[peerId] = [message]
      else
        data[peerId].push(message);
      var msgString = JSON.stringify(data);
      var output = await webchatServerless.updateFile(this.connectionFile_, msgString);
      
      clearInterval(interval_id);
      this.message_queue.shift();
      this.message_in_progress = false;
    }
  }.bind(this), 1000);
};
