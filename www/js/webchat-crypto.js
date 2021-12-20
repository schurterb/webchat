/* globals CryptoJS */

/* exported PeerConnection */

'use strict';

var Crypto = function(key, log_level=0) {
    this.cipherkey=key;
    this.log_level=log_level;
}

Crypto.prototype.encrypt = function(plaintext) {
    var cipher = CryptoJS.Rabbit.encrypt(plaintext, this.cipherkey);
    // return CryptoJS.enc.Base64.stringify(cipher.toString(CryptoJS.enc.Utf8));
    return cipher.toString();
}

Crypto.prototype.decrypt = function(ciphertext) {
    // ciphertext = CryptoJS.enc.Base64.parse(ciphertext);
    var decipher = CryptoJS.Rabbit.decrypt(ciphertext, this.cipherkey);
    return decipher.toString(CryptoJS.enc.Utf8);
}