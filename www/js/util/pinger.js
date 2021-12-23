 
/* exported WebRTCPinger */

'use strict';

// A simple pinger to verify connectivity with other clients
var WebRTCPinger = function(clientId, pingInterval=60000, log_level=0) {
    this.clientId_ = clientId;
    this.interval_ = pingInterval;
    this.log_level = log_level;
    
    this.onping = null;
    this.onpong = null;
    
    // Set up pong reply channel
    this.receivePing = function(message) {
        var receive_time = Date.now();
        message = JSON.parse(message);
        if(message.is_ping) {
            if(this.log_level >= 3) {
                console.log("[pinger]["+this.clientId_+"]: received ping from "+message.from);
            }
            if(this.onping) {
                this.onping(message);
            }
            this.sendPong_(message);
        } else {
            message['latency'] = (receive_time - message.sent_timestamp) / 2; // Measure round-trip
            if(this.log_level >= 3) {
                if(message.to == this.clientId_) {
                    console.log("[pinger]["+this.clientId_+"]: received pong from "+message.from+" for self :: latency = "+message.latency);
                } else {
                    console.log("[pinger]["+this.clientId_+"]: received pong from "+message.from+" for "+message.to);
                }
            }
            if(this.onpong) {
                this.onpong(message);
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
        "from": this.clientId_,
        "timestamp": Date.now()
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
        "to": message.from,
        "sent_timestamp": message.timestamp
    };
    if(this.log_level >= 3) {
        console.log("[pinger]["+this.clientId_+"]: sending pong to "+message.from);
    }
    this.sendPing(JSON.stringify(data), [message.from]);
};
