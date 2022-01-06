/* globals webchatTools */

/* exported MeshnetService */

var MeshnetService = function(webrtcService, args, log_level=3) {
    this.webrtcService_ = webrtcService;
    
    this.timeout_ = 5000; // 5 seconds
    if(args.timeout) {
        this.timeout_ = args.timeout;
    }
    
    this.handlers = {};
    this.peers = {};
    
    this.mainHandlerId = null;
    this.mainHandler = function(message) {
        
    };
    
    this.webrtcService_.addDataChannelMessageHandler( function(message) {
        if(log_level >= 3) {
            console.log("[meshnet]: message: ",message);
        }
        for(let i=0; i<this.handlers.length; i++) {
            try {
                this.handlers[i](message);
            } catch(e) {
                if(log_level >= 1) {
                    console.log("[meshnet][error]: Error handling message - ",e);
                }
            }
        }
    });
}

MeshnetService.prototype.createHandlerId_ = function() {
    return webchatTools.randomString(16);
}

MeshnetService.prototype.start = function() {
    this.mainHandlerId = this.handlers.addHandler( this.mainHandler );
}

MeshnetService.prototype.stop = function() {
    
}

MeshnetService.prototype.listPeers = function() {
    return Object.keys(this.peers);
}

MeshnetService.prototype.getPeer = function( peerId ) {
    return this.peers[peerId];
}

MeshnetService.prototype.sendAll = function( message, peerIds=null ) {
    if(peerIds == null) {
        peerIds = this.listPeers();
    }
    for(let i=0; i<peerIds.length; i++) {
        this.send(message, peerIds[i]);
    }
}

MeshnetService.prototype.send = function( message, peerId ) {
    this.webrtcService_.sendDataChannelMessage(message, [peerId]);
}

MeshnetService.prototype.addHandler = function( handler ) {
    var handlerId = this.createHandlerId_();
    this.handlers[handlerId] = handler;
    return handlerId;
}

MeshnetService.prototype.removeHandler = function( handlerId ) {
    if(this.handlers[handlerId]) {
        delete this.handlers[handlerId];
    }
}