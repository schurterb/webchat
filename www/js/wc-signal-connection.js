
/* exported SignalServerConnector */

'use strict';

var SignalServerConnector = function(clientId) {
  this.client_id = clientId;
  this.server_url = "wss://52.202.87.135/signalling";
  this.onerror = null;
  this.onmessage = null;
};

SignalServerConnector.prototype.connect = function() {
  this.socket = new WebSocket(this.server_url);
  // this.socket = new WebSocket(this.server_url, { rejectUnauthorized: false });

  this.socket.onopen = function(e) {
    console.log(`[ws][open]: Connecting to ${this.server_url} as ${this.client_id}`);
    this.socket.send(JSON.stringify({"client_id": this.client_id}));
  };
  
  this.socket.onmessage = function(event) {
    if(this.onmessage) {
      this.onmessage(event);
    }
  }.bind(this);
  
  this.socket.onclose = function(event) {
    if (event.wasClean) {
      console.log(`[ws][close]: Connection closed cleanly, code=${event.code} reason=${event.reason}`);
    } else {
      // e.g. server process killed or network down
      // event.code is usually 1006 in this case
      console.log(`[ws][close]: Connection died. code=${event.code} reason=${event.reason}`);
      // this.connect();
    }
  };
  
  this.socket.onerror = function(error) {
    console.log("[ws][error]: "+JSON.stringify(error, null, 2));
    if(this.onerror) {
      this.onerror(event);
    }
  }.bind(this);
};

SignalServerConnector.prototype.disconnect = function() {
  if(this.socket) {
    this.socket.close();
    this.socket = null;
  }
}

SignalServerConnector.prototype.joinRoom = function( room_id, room_key ) {
  this.room_id = room_id;
  this.room_key = room_key;
};

SignalServerConnector.prototype.send = function(message) {
  if(message) {
    var request = {
      "room_id": this.room_id,
      "room_key": this.room_key,
      "message": message
    }
    this.socket.send(JSON.stringify(request));
  }
};

SignalServerConnector.prototype.listFiles = function() {
};


SignalServerConnector.prototype.getFile = function() {
  
};

SignalServerConnector.prototype.createFile = function() {
  
};

SignalServerConnector.prototype.updateFile = function() {
  
};

SignalServerConnector.prototype.deleteFile = function() {
  
};
