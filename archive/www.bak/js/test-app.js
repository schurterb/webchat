
/* globals setUpFullScreen, isFullScreen, Login, $, 
           webchatServerless, UI_CONSTANTS, WebRTCPinger,
           WebchatServerlessChannel, WebchatService */

/* exported TestApp */

'use strict';

// The controller that connects the Call with the UI.
var TestApp = function(loadingParams) {
  
  this.rejoinButton_ = $(UI_CONSTANTS.rejoinButton);
  this.newRoomButton_ = $(UI_CONSTANTS.newRoomButton);
  this.rejoinButton_.addEventListener('click', this.onRejoinClick_.bind(this), false);
  this.newRoomButton_.addEventListener('click', this.onNewRoomClick_.bind(this), false);
  
  this.muteAudioIconSet_ = new TestApp.IconSet_(UI_CONSTANTS.muteAudioSvg);
  this.muteVideoIconSet_ = new TestApp.IconSet_(UI_CONSTANTS.muteVideoSvg);
  this.fullscreenIconSet_ = new TestApp.IconSet_(UI_CONSTANTS.fullscreenSvg);

  this.loadingParams_ = loadingParams;
  
  this.wcService = new WebchatService(loadingParams, new WebchatServerlessChannel());
  
  this.wcService.onError_ = this.displayError_.bind(this);
  this.wcService.onRemoteHangup_ = this.onRemoteHangup_.bind(this);
  this.wcService.onRemoteSdpSet_ = this.onRemoteSdpSet_.bind(this);
  this.wcService.onRemoteStreamAdded_ = this.onRemoteStreamAdded_.bind(this);
  this.wcService.onLocalStreamAdded_ = this.onLocalStreamAdded_.bind(this);
  
  this.rtcPinger = new WebRTCPinger(this.loadingParams_.clientId);
  this.rtcPinger.sendPing = this.wcService.sendDataChannelMessage.bind(this.wcService);
  this.wcService.addDataChannelMessageHandler(this.rtcPinger.receivePing);
  this.rtcPinger.start();
  
  this.showLogin_();
};

TestApp.prototype.showLogin_ = function() {
  var roomSelectionDiv = $(UI_CONSTANTS.roomSelectionDiv);
  this.roomSelection_ = new Login(roomSelectionDiv);
  this.show_(roomSelectionDiv);
};

TestApp.prototype.setupUi_ = function() {
  this.iconEventSetup_();
  document.onkeypress = this.onKeyPress_.bind(this);
  window.onmousemove = this.showIcons_.bind(this);

  $(UI_CONSTANTS.muteAudioSvg).onclick = this.toggleAudioMute_.bind(this);
  $(UI_CONSTANTS.muteVideoSvg).onclick = this.toggleVideoMute_.bind(this);
  $(UI_CONSTANTS.fullscreenSvg).onclick = this.toggleFullScreen_.bind(this);
  $(UI_CONSTANTS.hangupSvg).onclick = this.hangup_.bind(this);

  setUpFullScreen();
};

TestApp.prototype.finishCallSetup_ = function(roomId) {
  this.setupUi_();
  
  window.onbeforeunload = function() {
    this.wcService.hangup(false);
  }.bind(this);
};

TestApp.prototype.hangup_ = function() {
  console.log('Hanging up.');
  this.hide_($(UI_CONSTANTS.icons));
  this.displayStatus_('Hanging up');
  this.transitionToDone_();

  this.wcService.hangup(true);
  
  document.onkeypress = null;
  window.onmousemove = null;
};

TestApp.prototype.onRemoteHangup_ = function() {
  this.displayStatus_('The remote side hung up.');
  this.transitionToWaiting_();

  this.wcService.onRemoteHangup();
};

TestApp.prototype.onRemoteSdpSet_ = function(hasRemoteVideo) {
  if (hasRemoteVideo) {
    console.log('Waiting for remote video.');
    this.waitForRemoteVideo_();
  } else {
    console.log('No remote video stream; not waiting for media to arrive.');
    this.transitionToActive_();
  }
};

TestApp.prototype.waitForRemoteVideo_ = function() {
  // Wait for the actual video to start arriving before moving to the active call state.
  if ($(UI_CONSTANTS.remoteVideo).readyState >= 2) {
    console.log('Remote video started; currentTime: ' +
          $(UI_CONSTANTS.remoteVideo).currentTime);
    this.transitionToActive_();
  } else {
    $(UI_CONSTANTS.remoteVideo).oncanplay = this.waitForRemoteVideo_.bind(this);
  }
};

TestApp.prototype.onRemoteStreamAdded_ = function(stream) {
  this.deactivate_($(UI_CONSTANTS.sharingDiv));
  this.displayTurnStatus_('');
  console.log('Remote stream added.');
  $(UI_CONSTANTS.remoteVideo).srcObject = stream;

  if (this.remoteVideoResetTimer_) {
    clearTimeout(this.remoteVideoResetTimer_);
    this.remoteVideoResetTimer_ = null;
  }
};

TestApp.prototype.onLocalStreamAdded_ = function(stream) {
  console.log('User has granted access to local media.');
  this.localStream_ = stream;

  if (!this.roomSelection_) {
    this.attachLocalStream_();
  }
};

TestApp.prototype.attachLocalStream_ = function() {
  console.log('Attaching local stream.');
  $(UI_CONSTANTS.localVideo).srcObject = this.localStream_;

  this.displayStatus_('');
  this.activate_($(UI_CONSTANTS.localVideo));
  this.show_($(UI_CONSTANTS.icons));
  if (this.localStream_.getVideoTracks().length === 0) {
    this.hide_($(UI_CONSTANTS.muteVideoSvg));
  }
  if (this.localStream_.getAudioTracks().length === 0) {
    this.hide_($(UI_CONSTANTS.muteAudioSvg));
  }
};

TestApp.prototype.transitionToActive_ = function() {
  // Stop waiting for remote video.
  $(UI_CONSTANTS.remoteVideo).oncanplay = undefined;
  var connectTime = window.performance.now();
  console.log('Call setup time: ' + (connectTime - this.wcService.startTime).toFixed(0) +  'ms.');

  // Prepare the remote video and PIP elements.
  console.log('reattachMediaStream: ' + $(UI_CONSTANTS.localVideo).srcObject);
  $(UI_CONSTANTS.miniVideo).srcObject = $(UI_CONSTANTS.localVideo).srcObject;

  // Transition opacity from 0 to 1 for the remote and mini videos.
  this.activate_($(UI_CONSTANTS.remoteVideo));
  this.activate_($(UI_CONSTANTS.miniVideo));
  // Transition opacity from 1 to 0 for the local video.
  this.deactivate_($(UI_CONSTANTS.localVideo));
  $(UI_CONSTANTS.localVideo).srcObject = null;
  // Rotate the div containing the videos 180 deg with a CSS transform.
  this.activate_(this.videosDiv_);
  this.show_($(UI_CONSTANTS.hangupSvg));
  this.displayStatus_('');
};

TestApp.prototype.transitionToWaiting_ = function() {
  // Stop waiting for remote video.
  $(UI_CONSTANTS.remoteVideo).oncanplay = undefined;

  this.hide_($(UI_CONSTANTS.hangupSvg));
  // Rotate the div containing the videos -180 deg with a CSS transform.
  this.deactivate_(this.videosDiv_);

  if (!this.remoteVideoResetTimer_) {
    this.remoteVideoResetTimer_ = setTimeout(function() {
      this.remoteVideoResetTimer_ = null;
      console.log('Resetting remoteVideo src after transitioning to waiting.');
      $(UI_CONSTANTS.remoteVideo).srcObject = null;
    }.bind(this), 800);
  }

  // Set localVideo.srcObject now so that the local stream won't be lost if the
  // call is restarted before the timeout.
  $(UI_CONSTANTS.localVideo).srcObject = $(UI_CONSTANTS.miniVideo).srcObject;

  // Transition opacity from 0 to 1 for the local video.
  this.activate_($(UI_CONSTANTS.localVideo));
  // Transition opacity from 1 to 0 for the remote and mini videos.
  this.deactivate_($(UI_CONSTANTS.remoteVideo));
  this.deactivate_($(UI_CONSTANTS.miniVideo));
};

TestApp.prototype.transitionToDone_ = function() {
  // Stop waiting for remote video.
  $(UI_CONSTANTS.remoteVideo).oncanplay = undefined;
  this.deactivate_($(UI_CONSTANTS.localVideo));
  this.deactivate_($(UI_CONSTANTS.remoteVideo));
  this.deactivate_($(UI_CONSTANTS.miniVideo));
  this.hide_($(UI_CONSTANTS.hangupSvg));
  this.activate_($(UI_CONSTANTS.rejoinDiv));
  this.show_($(UI_CONSTANTS.rejoinDiv));
  this.displayStatus_('');
  this.displayTurnStatus_('');
};

TestApp.prototype.onRejoinClick_ = function() {
  this.deactivate_($(UI_CONSTANTS.rejoinDiv));
  this.hide_($(UI_CONSTANTS.rejoinDiv));
  this.wcService.restart();
  this.setupUi_();
};

TestApp.prototype.onNewRoomClick_ = function() {
  this.deactivate_($(UI_CONSTANTS.rejoinDiv));
  this.hide_($(UI_CONSTANTS.rejoinDiv));
  this.showLogin_();
};

// Spacebar, or m: toggle audio mute.
// c: toggle camera(video) mute.
// f: toggle fullscreen.
// i: toggle info panel.
// q: quit (hangup)
// Return false to screen out original Chrome shortcuts.
TestApp.prototype.onKeyPress_ = function(event) {
  switch (String.fromCharCode(event.charCode)) {
    case ' ':
    case 'm':
      if (this.wcService) {
        this.wcService.toggleAudioMute();
        this.muteAudioIconSet_.toggle();
      }
      return false;
    case 'c':
      if (this.wcService) {
        this.wcService.toggleVideoMute();
        this.muteVideoIconSet_.toggle();
      }
      return false;
    case 'f':
      this.toggleFullScreen_();
      return false;
    case 'q':
      this.hangup_();
      return false;
    case 'l':
      this.toggleMiniVideo_();
      return false;
    default:
      return;
  }
};

// Change this to an if isInitiator, then display situation
TestApp.prototype.displaySharingInfo_ = function(roomId, roomLink) {
  // $(UI_CONSTANTS.roomLinkHref).href = roomLink;
  // $(UI_CONSTANTS.roomLinkHref).text = roomLink;
  $(UI_CONSTANTS.roomIdHref).text = roomId;
  $(UI_CONSTANTS.roomKeyHref).text = webchatServerless.room_password;
  this.roomLink_ = roomLink;
  this.activate_($(UI_CONSTANTS.sharingDiv));
};

TestApp.prototype.displayStatus_ = function(status) {
  if (status === '') {
    this.deactivate_($(UI_CONSTANTS.statusDiv));
  } else {
    this.activate_($(UI_CONSTANTS.statusDiv));
  }
  $(UI_CONSTANTS.statusDiv).innerHTML = status;
};

TestApp.prototype.displayTurnStatus_ = function(status) {
  if (status === '') {
    this.deactivate_($(UI_CONSTANTS.turnInfoDiv));
  } else {
    this.activate_($(UI_CONSTANTS.turnInfoDiv));
  }
  $(UI_CONSTANTS.turnInfoDiv).innerHTML = status;
};

TestApp.prototype.displayError_ = function(error) {
  console.log(error);
};

TestApp.prototype.toggleAudioMute_ = function() {
  this.wcService.toggleAudioMute();
  this.muteAudioIconSet_.toggle();
};

TestApp.prototype.toggleVideoMute_ = function() {
  this.wcService.toggleVideoMute();
  this.muteVideoIconSet_.toggle();
};

TestApp.prototype.toggleFullScreen_ = function() {
  if (isFullScreen()) {
    console.log('Exiting fullscreen.');
    document.querySelector('svg#fullscreen title').textContent =
        'Enter fullscreen';
    document.cancelFullScreen();
  } else {
    console.log('Entering fullscreen.');
    document.querySelector('svg#fullscreen title').textContent =
        'Exit fullscreen';
    document.body.requestFullScreen();
  }
  this.fullscreenIconSet_.toggle();
};

TestApp.prototype.toggleMiniVideo_ = function() {
  if ($(UI_CONSTANTS.miniVideo).classList.contains('active')) {
    this.deactivate_($(UI_CONSTANTS.miniVideo));
  } else {
    this.activate_($(UI_CONSTANTS.miniVideo));
  }
};

TestApp.prototype.hide_ = function(element) {
  element.classList.add('hidden');
};

TestApp.prototype.show_ = function(element) {
  element.classList.remove('hidden');
};

TestApp.prototype.activate_ = function(element) {
  element.classList.add('active');
};

TestApp.prototype.deactivate_ = function(element) {
  element.classList.remove('active');
};

TestApp.prototype.showIcons_ = function() {
  if (!$(UI_CONSTANTS.icons).classList.contains('active')) {
    this.activate_($(UI_CONSTANTS.icons));
    this.setIconTimeout_();
  }
};

TestApp.prototype.hideIcons_ = function() {
  if ($(UI_CONSTANTS.icons).classList.contains('active')) {
    this.deactivate_($(UI_CONSTANTS.icons));
  }
};

TestApp.prototype.setIconTimeout_ = function() {
  if (this.hideIconsAfterTimeout) {
    window.clearTimeout.bind(this, this.hideIconsAfterTimeout);
  }
  this.hideIconsAfterTimeout = window.setTimeout(function() {
    this.hideIcons_();
  }.bind(this), 5000);
};

TestApp.prototype.iconEventSetup_ = function() {
  $(UI_CONSTANTS.icons).onmouseenter = function() {
    window.clearTimeout(this.hideIconsAfterTimeout);
  }.bind(this);

  $(UI_CONSTANTS.icons).onmouseleave = function() {
    this.setIconTimeout_();
  }.bind(this);
};

TestApp.IconSet_ = function(iconSelector) {
  this.iconElement = document.querySelector(iconSelector);
};

TestApp.IconSet_.prototype.toggle = function() {
  if (this.iconElement.classList.contains('on')) {
    this.iconElement.classList.remove('on');
  } else {
    this.iconElement.classList.add('on');
  }
};
