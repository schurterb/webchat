
/* globals SignalServerConnector */
/* exported WebchatSignalChannel */

'use strict';

var WebchatSignalChannel = function(clientId, log_level=0) {
  this.clientId_ = clientId;
  this.log_level = log_level
  if (!this.clientId_) {
    if(this.log_level >= 1) { 
      console.log('[ws-channel][error]: missing clientId.');
    }
    return;
  }

  this.onerror = null;
  this.onmessage = null;
  this.start_time = null;
  this.registered_ = false;
  
  this.connection = null;
  this.keep_alive = null;
  this.keep_alive_interval = 15000; // 15 seconds
  this.server_latency = 0;
  
  this.connection = new SignalServerConnector(this.clientId_);

  this.connection.message_handler = function( message ) {
    if (message.type == 'keep_alive') {
      var current_time = (new Date()).getTime();
      this.server_latency = (current_time - message.timestamp) / 2
    } else {
      if (this.onmessage) {
        this.onmessage( message );
      }
    }
  }.bind(this);
};

WebchatSignalChannel.prototype.open = function() {
  if ( !this.registered_ || this.clientId_ ) {
    if(this.log_level >= 2) { 
      console.log('[ws-channel]: Opening signaling channel.');
    }
    this.start_time = (new Date()).getTime();
    this.register();
  } else if (this.registered_) {
    if(this.log_level >= 1) { 
      console.log('[ws-channel][error]: WebchatSignalChannel has already opened.');
    }
  } else {
    if(this.log_level >= 1) { 
      console.log('[ws-channel][error]: missing clientId.');
    }
  }
};

WebchatSignalChannel.prototype.register = function() {
  if (this.registered_) {
    if(this.log_level >= 1) { 
      console.log('[ws-channel][error]: WebchatSignalChannel has already registered.');
    }
    return;
  }
  this.connection.connect();
  this.registered_ = true;
  this.keep_alive = setInterval( function() {
    this.connection.send({type: "keep_alive", timestamp: (new Date()).getTime()})
  }.bind(this), this.keep_alive_interval, this.keep_alive_interval);
  if(this.log_level >= 2) { 
    console.log('[ws-channel]: Signaling channel registered.');
  }
};

WebchatSignalChannel.prototype.close = async function(async) {
  this.connection.disconnect();
  this.registered_ = false;
  clearInterval(this.keep_alive);
  if(this.log_level >= 2) { 
    console.log('[ws-channel]: Signaling channel registered.');
  }
};

WebchatSignalChannel.prototype.send = function(message, peerId) {
  if( this.registered_ ) {
    var data = {
      "client_id": this.clientId_,
      "peer_id": peerId,
      "message": message
    };
    this.connection.send(data);
  } else {
    if(this.log_level >= 1) { 
      console.log('[ws-channel][error]: WebchatSignalChannel not registered.');
    }
  }
};
