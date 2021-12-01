window.onload=start;

/* global webchatTools, webchatServerless, TestApp */

var webchat;

var loadingParams = {
  clientId: webchatTools.randomString(8),
  isLoopback: false,
  mediaConstraints: {"video": true, "audio": true},
  offerOptions: {},
  peerConnectionConfig: webchatTools.initPcConfig(),
  peerConnectionConstraints: {"optional": []}
};

function start() {
    console.log("Logging in as unauth user.");
    webchatServerless.initialize();
    
    console.log("Initializing serverless webchat system.");
    initialize();
}

function initialize() {
  // For Chrome prerendering
  if (document.visibilityState === 'prerender') {
    document.addEventListener('visibilitychange', onVisibilityChange);
    return;
  }
  webchat = new TestApp(loadingParams);
}

function onVisibilityChange() {
  if (document.visibilityState === 'prerender') {
    return;
  }
  document.removeEventListener('visibilitychange', onVisibilityChange);
  initialize();
}