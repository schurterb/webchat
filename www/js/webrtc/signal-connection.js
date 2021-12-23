
/* globals webchatTools */
/* exported SignalServerConnector */

'use strict';

var SignalServerConnector = function(clientId, log_level=1) {
  this.client_id = clientId;
  this.log_level = log_level
  this.server_data = webchatTools.getSignalingServer();
  this.onerror = null;
  this.message_handler = null;
  this.registered_ = false;
};

SignalServerConnector.prototype.connect = function() {
  this.socket = new WebSocket(this.server_data.url);
  this.socket.onopen = function(e) {
    if(this.log_level >= 2) { console.log(`[ws][open]: Connecting to ${this.server_url} as ${this.client_id}`); }
    this.socket.send(JSON.stringify({"type": "register", "client_id": this.client_id}));
  }.bind(this);
  
  this.socket.onmessage = function(message) {
    if (message.data instanceof Blob) {
      let reader = new FileReader();
      reader.onload = function() {
        var str_data = reader.result;
        
        this.handleString(str_data);
      }
      reader.readAsText(message.data);
    } else if (message.data instanceof Object) {
      this.handleObject(message.data);
    } else {
      this.handleString(message.data);
    }
  }.bind(this);
  
  this.socket.onclose = function(event) {
    if (event.wasClean) {
      if(this.log_level >= 2) { console.log(`[ws][close]: Connection closed cleanly, code=${event.code} reason=${event.reason}`); }
    } else {
      // e.g. server process killed or network down - event.code is usually 1006 in this case
      if(this.log_level >= 2) { console.log(`[ws][close]: Connection died. code=${event.code} reason=${event.reason}`); }
    }
    this.registered_ = false;
  };
  
  this.socket.onerror = function(error) {
    if(this.log_level >= 1) { console.log("[ws][error]: "+JSON.stringify(error, null, 2)); }
    if(this.onerror) {
      this.onerror(event);
    }
  }.bind(this);
};

SignalServerConnector.prototype.handleString = function( string_data ) {
  this.handleObject(JSON.parse(string_data));
}

SignalServerConnector.prototype.handleObject = function( data ) {
  if(this.log_level >= 3) { console.log("[ws] received: ",data); }
  if( !this.registered_ ) {
    if(data['type'] == 'register') {
      if (data['success']) {
        if(this.log_level >= 2) { console.log("[ws] Successfully registered client connection with signalling server."); }
        this.registered_ = true;
      } else {
        if(this.log_level >= 2) { console.log("[ws] Failed to register client connection with signalling server."); }
        this.socket.close();
      }
    }
  } else {
    if(this.message_handler) {
      this.message_handler(data);
    }
  }
}

SignalServerConnector.prototype.disconnect = function() {
  if(this.socket) {
    this.socket.close();
    this.socket = null;
  }
}

SignalServerConnector.prototype.joinRoom = function( room_id, room_key ) {
  this.room_id = room_id;
  this.room_key = room_key;
  //TODO: close current connections and open new ones
};

SignalServerConnector.prototype.send = function(message) {
  if(message) {
    var request = {
      "room_id": this.room_id,
      "room_key": this.room_key,
      "message": message
    }
    if(this.log_level >= 3) { console.log("[ws] sending: ",message); }
    this.socket.send(JSON.stringify(request));
  }
};