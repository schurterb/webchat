 
/* exported WebRTCPinger */

'use strict';

// A simple pinger to verify connectivity with other clients
var WebRTCPinger = function(clientId, pingInterval=60000, log_level=3) {
    this.clientId_ = clientId;
    this.interval_ = pingInterval;
    this.log_level = log_level;
    
    // Set up pong reply channel
    this.receivePing = function(message) {
        message = JSON.parse(message);
        if(message.is_ping) {
            if(this.log_level >= 3) {
                console.log("[pinger]["+this.clientId_+"]: received ping from "+message.from);
            }
            this.sendPong_(message);
        } else {
            if(this.log_level >= 3) {
                if(message.to == this.clientId_) {
                    console.log("[pinger]["+this.clientId_+"]: received pong from "+message.from+" for self");
                } else {
                    console.log("[pinger]["+this.clientId_+"]: received pong from "+message.from+" for "+message.to);
                }
            }
        }
    }.bind(this);
    
    this.sendPing = null;
};

WebRTCPinger.prototype.start = function() {
    if(this.log_level >= 2) {
        console.log("[pinger]: Starting WebRTC Pinger");
    }
    
    // Create pinger interval function
    this.pinger_ = setInterval( function() {
        this.sendPing_();
    }.bind(this), this.interval_);
};

WebRTCPinger.prototype.stop = function() {
    if(this.log_level >= 2) {
        console.log("[pinger]: Stopping WebRTC Pinger");
    }
    clearInterval(this.pinger_);
}

WebRTCPinger.prototype.sendPing_ = function() {
    var data = {
        "is_ping": true,
        "from": this.clientId_
    };
    if(this.log_level >= 3) {
        console.log("[pinger]["+this.clientId_+"]: sending ping to all peers");
    }
    this.sendPing(JSON.stringify(data));
};

WebRTCPinger.prototype.sendPong_ = function(message) {
    var data = {
        "is_ping": false,
        "from": this.clientId_,
        "to": message.from
    };
    if(this.log_level >= 3) {
        console.log("[pinger]["+this.clientId_+"]: sending pong to "+message.from);
    }
    this.sendPing(JSON.stringify(data), [message.from]);
};
