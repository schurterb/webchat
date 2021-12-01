
/* globals webchatTools, webchatServerless, UI_CONSTANTS, $ */

/* exported Login */

'use strict';

var Login = function(roomSelectionDiv) {
  this.roomSelectionDiv_ = roomSelectionDiv;
  
  this.roomIdInput_ = this.roomSelectionDiv_.querySelector(UI_CONSTANTS.roomSelectionInput);
  this.roomIdInputLabel_ = this.roomSelectionDiv_.querySelector(UI_CONSTANTS.roomSelectionInputLabel);
  
  this.roomPasswordInput_ = this.roomSelectionDiv_.querySelector(UI_CONSTANTS.roomPasswordInput);
  this.roomPasswordInputLabel_ = this.roomSelectionDiv_.querySelector(UI_CONSTANTS.roomPasswordInputLabel);
      
  this.roomJoinButton_ = this.roomSelectionDiv_.querySelector(UI_CONSTANTS.roomSelectionJoinButton);
  
  this.roomIdInput_.value = webchatTools.randomString(8);
  this.roomPasswordInput_.value = webchatTools.randomString(4, 'a')+webchatTools.randomString(4, 'A')+webchatTools.randomString(2, '#');
  // Validate initial state of input box.
  this.onRoomIdPasswordInput_();

  this.roomIdInputListener_ = this.onRoomIdPasswordInput_.bind(this);
  this.roomIdInput_.addEventListener('input', this.roomIdInputListener_, false);

  this.roomIdKeyupListener_ = this.onRoomIdKeyPress_.bind(this);
  this.roomIdInput_.addEventListener('keyup', this.roomIdKeyupListener_, false);
  
  this.roomPasswordInputListener_ = this.onRoomIdPasswordInput_.bind(this);
  this.roomPasswordInput_.addEventListener('input', this.roomPasswordInputListener_, false);

  this.roomPasswordKeyupListener_ = this.onRoomIdKeyPress_.bind(this);
  this.roomPasswordInput_.addEventListener('keyup', this.roomPasswordKeyupListener_, false);
  
  this.roomJoinButtonListener_ = this.onJoinButton_.bind(this);
  this.roomJoinButton_.addEventListener('click', this.roomJoinButtonListener_, false);
};

Login.prototype.cleanupEventListeners = function() {
  this.roomIdInput_.removeEventListener('input', this.roomIdInputListener_);
  this.roomIdInput_.removeEventListener('keyup', this.roomIdKeyupListener_);
  this.roomPasswordInput_.removeEventListener('input', this.roomPasswordInputListener_);
  this.roomPasswordInput_.removeEventListener('keyup', this.roomPasswordKeyupListener_);
  this.roomJoinButton_.removeEventListener(
      'click', this.roomJoinButtonListener_);
};

Login.prototype.onRoomIdPasswordInput_ = function() {
  // Validate room id and password
  var re = /^([a-zA-Z0-9-_]+)+$/;
  
  var room = this.roomIdInput_.value;
  var room_valid = room.length >= 5;
  room_valid = room_valid && re.exec(room);
  
  var pword = this.roomPasswordInput_.value;
  var pword_valid = pword.length >= 8;
  pword_valid = pword_valid && re.exec(pword);
  
  this.roomJoinButton_.disabled = !(room_valid && pword_valid);
  if(room_valid) {
    this.roomIdInput_.classList.remove('invalid');
    this.roomIdInputLabel_.classList.add('hidden');
  } else {
    this.roomIdInput_.classList.add('invalid');
    this.roomIdInputLabel_.classList.remove('hidden');
  }
  if(pword_valid) {
    this.roomPasswordInput_.classList.remove('invalid');
    this.roomPasswordInputLabel_.classList.add('hidden');
  } else {
    this.roomPasswordInput_.classList.add('invalid');
    this.roomPasswordInputLabel_.classList.remove('hidden');
  }
};

Login.prototype.onRoomIdKeyPress_ = function(event) {
  if (event.which !== 13 || this.roomJoinButton_.disabled) {
    return;
  }
  this.onJoinButton_();
};

Login.prototype.onJoinButton_ = function() {
  this.loadRoom_(this.roomIdInput_.value, this.roomPasswordInput_.value);
};

Login.prototype.loadRoom_ = function(roomName, roomPassword) {
  webchatServerless.joinRoom(roomName, roomPassword);
  
  webchat.hide_($(UI_CONSTANTS.roomSelectionDiv));
  webchat.show_($(UI_CONSTANTS.joiningRoomDiv));
  var interval_id = setInterval(function() {
    if (webchatServerless.is_logged_in) {
      webchat.hide_($(UI_CONSTANTS.joiningRoomDiv));
      webchat.wcService.start(roomName, roomPassword);
      
      webchat.roomSelection_.cleanupEventListeners();
      webchat.roomSelection_ = null;
      if (webchat.localStream_) {
        webchat.attachLocalStream_();
      }
      
      clearInterval(interval_id);
      console.log("Room selected!");
    }
  }, 1000);
};
