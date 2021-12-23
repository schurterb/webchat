
/* globals webchatTools */

'use strict';

window.onload = start;

function joinRoom() {
  var clientId = webchatTools.randomString(16);
  var roomId = document.getElementById('room-id-input').value.trim();
  var roomKey = document.getElementById('room-key-input').value.trim();
  window.location = "./webrtc-test.html?clientId="+clientId+"&room="+roomId+"&key="+roomKey;
};

function start() {
    console.log("Initializing webchat system.");
    initialize();
}

function initialize() {
  // For Chrome prerendering
  if (document.visibilityState === 'prerender') {
    document.addEventListener('visibilitychange', onVisibilityChange);
    return;
  }

  let roomIdInput = document.getElementById('room-id-input');
  let roomKeyInput = document.getElementById('room-key-input');
  roomIdInput.value = webchatTools.randomString(8);
  roomKeyInput.value = webchatTools.randomString(4, 'a')+webchatTools.randomString(4, 'A')+webchatTools.randomString(2, '#');
}

function onVisibilityChange() {
  if (document.visibilityState === 'prerender') {
    return;
  }
  document.removeEventListener('visibilitychange', onVisibilityChange);
  initialize();
}