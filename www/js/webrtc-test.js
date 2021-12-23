/* globals setUpFullScreen, isFullScreen, Login, $, 
           webchatServerless, UI_CONSTANTS, WebRTCPinger,
           WebchatServerlessChannel, WebchatService,
           SignalServerConnector, WebchatSignalChannel */

'use strict';

window.onload=start;

var clientId = null;
var roomId = null;
var roomKey = null;
var app = null;

function start() {
  loadUrlParams();
  initialize();
}

function loadUrlParams() {
  console.log("Parsing url parameters");
  var url_params = {};
  window.location.search.replace(/[?&]+([^=&]+)=([^&]*)/gi, function(m,key,value) { url_params[key] = value; });
  clientId = (url_params["clientId"] != null) ? url_params["clientId"] : webchatTools.randomString(16);
  roomId = url_params["room"];
  roomKey = url_params["key"];
};

function initialize() {
  
  if( (roomId == null) || (roomKey == null)) {
    console.log("No room or key provided.  Cannot run test.");
    document.getElementById('title-element').innerHTML = "<h1>WebRTC Test :: error</h1><p>No room or key provided.  Cannot run test.</p>"
    return;
  }
  
  document.getElementById('title-element').innerHTML = "<h1>WebRTC Test :: "+clientId+"</h1>"
  
  console.log("Initializing webrtc test app");
  app = new WebRTCTestApp({
    clientId: clientId,
    isLoopback: false,
    mediaConstraints: {"video": true, "audio": true},
    offerOptions: {},
    peerConnectionConfig: webchatTools.initPcConfig(),
    peerConnectionConstraints: {"optional": []}
  });
};

var WebRTCTestApp = function(loadingParams, log_level=3) {
  this.loadingParams_ = loadingParams;
  this.log_level = log_level;
  
  if(this.log_level >= 3) { console.log("[test]: creating signaling channel"); }
  this.channel_ = new WebchatSignalChannel(this.loadingParams_.clientId, 1);
  
  if(this.log_level >= 3) { console.log("[test]: creating webrtc service"); }
  this.wcService = new WebchatService(loadingParams, this.channel_, 1);
  
  this.wcService.onNewConnection = this.newConnectionHandler.bind(this);
  this.wcService.onConnectionChange = this.connectionChangeHandler.bind(this);
  
  if(this.log_level >= 3) { console.log("[test]: joining room"); }
  this.channel_.connection.joinRoom(roomId, roomKey);
  
  if(this.log_level >= 3) { console.log("[test]: starting webrtc service"); }
  this.wcService.start(roomId, roomKey);
  
  if(this.log_level >= 3) { console.log("[test]: starting webrtc pinger utility"); }
  this.rtcPinger = new WebRTCPinger(this.loadingParams_.clientId, 2000, 0);
  this.rtcPinger.sendPing = this.wcService.sendDataChannelMessage.bind(this.wcService);
  this.wcService.addDataChannelMessageHandler(this.rtcPinger.receivePing);
  this.rtcPinger.onpong = function(message) {
    var data = "unknown";
    var audio = "unknown";
    var video = "unknown";
    this.handleUpdate(message.from, null, data, audio, video, message.latency);
  }.bind(this);
  this.rtcPinger.start();
};

WebRTCTestApp.prototype.newConnectionHandler = function(event) {
  this.handleUpdate(event.peerId, "no connection", null, null, null, "n/a");
};

WebRTCTestApp.prototype.connectionChangeHandler = function(event) {
  var data = "unknown";
  var audio = "unknown";
  var video = "unknown";
  this.handleUpdate(event.peerId, event.iceConnectionState, data, audio, video, "unknown");
  
  if( (event.iceConnectionState == 'failed') || (event.iceConnectionState == 'disconnected') ) {
    setTimeout( this.deleteRow(event.peerId), 15);
  }
};

WebRTCTestApp.prototype.handleUpdate = function(peer, status, data, audio, video, latency) {
  if(document.getElementById(peer+"-row")) {
    this.updateRow(peer, status, data, audio, video, latency);
  } else {
    this.createRow(peer, status, data, audio, video, latency);
  }
};

WebRTCTestApp.prototype.createRow = function(peer, status, data, audio, video, latency) {
  var contents = "";
  contents += "<tr id=\""+peer+"-row\">";
  contents += "<td id=\""+peer+"-id\">"+peer+"</td>";
  contents += "<td id=\""+peer+"-status\">"+status+"</td>";
  if( !data ) { data = ""; }
  contents += "<td id=\""+peer+"-data\">"+data+"</td>";
  if( !audio ) { audio = ""; }
  contents += "<td id=\""+peer+"-audio\">"+audio+"</td>";
  if( !video ) { video = ""; }
  contents += "<td id=\""+peer+"-video\">"+video+"</td>";
  contents += "<td id=\""+peer+"-latency\">"+latency+"</td>";
  contents += "<td id=\""+peer+"-actions\"></td>";
  contents += "</tr>";
  document.getElementById("webrtc-connection-table").innerHTML += contents;
};

WebRTCTestApp.prototype.updateRow = function(peer, status, data, audio, video, latency) {
  if(status) {  
    document.getElementById(peer+"-status").innerHTML = status;
  }
  if(data) {  
    document.getElementById(peer+"-data").innerHTML = data;
  }
  if(audio) {  
    document.getElementById(peer+"-audio").innerHTML = audio;
  }
  if(video) {  
    document.getElementById(peer+"-video").innerHTML = video;
  }
  if(latency) { 
    document.getElementById(peer+"-latency").innerHTML = latency;
  }
  //console.log("TODO: update buttons");
};

WebRTCTestApp.prototype.deleteRow = function(peer) {
  document.getElementById(peer+"-row").remove();
};

