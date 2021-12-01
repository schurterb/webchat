/* globals CryptoJS */

/* exported PeerConnection */

'use strict';

var Crypto = function(key) {
    this.cipherkey=key;
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