 
/* exported WebRTCPinger */

'use strict';

// A simple pinger to verify connectivity with other clients
var WebRTCPinger = function(clientId, pingInterval=60000) {
    this.clientId_ = clientId;
    this.interval_ = pingInterval;
    
    // Set up pong reply channel
    this.receivePing = function(message) {
        message = JSON.parse(message);
        if(message.is_ping) {
            console.log("Pinger : "+this.clientId_+" ::  ping from "+message.from);
            this.sendPong_(message);
        } else {
            console.log("Pinger : "+this.clientId_+" :: pong from "+message.from+" for "+message.to);
        }
    }.bind(this);
    
    this.sendPing = null;
};

WebRTCPinger.prototype.start = function() {
    console.log("Pinger :: Starting WebRTC Pinger");  
    
    // Create pinger interval function
    this.pinger_ = setInterval( function() {
        this.sendPing_();
    }.bind(this), this.interval_);
};

WebRTCPinger.prototype.stop = function() {
    console.log("Pinger :: Stopping WebRTC Pinger");
    clearInterval(this.pinger_);
}

WebRTCPinger.prototype.sendPing_ = function() {
    //console.log("Pinger :: "+this.clientId_+" sending ping");
    var data = {
        "is_ping": true,
        "from": this.clientId_
    };
    this.sendPing(JSON.stringify(data));
};

WebRTCPinger.prototype.sendPong_ = function(message) {
    //console.log("Pinger :: "+this.clientId_+" sending pong to "+message.from);
    var data = {
        "is_ping": false,
        "from": this.clientId_,
        "to": message.from
    };
    this.sendPing(JSON.stringify(data));
};
