var webchatTools = {
    
  randomString: function(length, chars='aA#') {
    var mask = '';
    if (chars.indexOf('a') > -1) mask += 'abcdefghijklmnopqrstuvwxyz';
    if (chars.indexOf('A') > -1) mask += 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    if (chars.indexOf('#') > -1) mask += '0123456789';
    var result = '';
    for (var i = length; i > 0; --i) result += mask[Math.floor(Math.random() * mask.length)];
    return result;
  },
  
  createRoomLink: function( room_id ) {
    return window.location.href;
  },
  
  getSignalingServer: function() {
    // selected_servers.push(webchatTools.sig_servers[0]);
    return webchatTools.sig_servers[Math.floor(Math.random() * webchatTools.sig_servers.length)];
  },
  
  initPcConfig: function() {
    var iceServers = webchatTools.getIceServers();
    var pc_config = {
      "rtcpMuxPolicy": "require",
      "bundlePolicy": "max-bundle",
      "iceServers": iceServers
    };
    
    return pc_config;
  },
  
  getIceServers: function(number_of_servers = 2) {
      var selected_servers = [];
      selected_servers.push(webchatTools.turn_servers[0]);
      selected_servers.push(webchatTools.stun_servers[Math.floor(Math.random() * webchatTools.stun_servers.length)]);
      return selected_servers
  },
    
  stun_servers: [
    {
      urls: 'stun:52.202.87.135'
    },
    {urls:'stun:stun.l.google.com:19302'},
    {urls:'stun:stun1.l.google.com:19302'},
    {urls:'stun:stun2.l.google.com:19302'},
    {urls:'stun:stun3.l.google.com:19302'},
    {urls:'stun:stun4.l.google.com:19302'},
    {urls:'stun:stun01.sipphone.com'},
    {urls:'stun:stun.ekiga.net'},
    {urls:'stun:stun.fwdnet.net'},
    {urls:'stun:stun.ideasip.com'},
    {urls:'stun:stun.iptel.org'},
    {urls:'stun:stun.rixtelecom.se'},
    {urls:'stun:stun.schlund.de'},
    {urls:'stun:stunserver.org'},
    {urls:'stun:stun.softjoys.com'},
    {urls:'stun:stun.voiparound.com'},
    {urls:'stun:stun.voipbuster.com'},
    {urls:'stun:stun.voipstunt.com'},
    {urls:'stun:stun.voxgratia.org'},
    {urls:'stun:stun.xten.com'},
    {urls:'stun:numb.viagenie.ca'}
  ],
  
  turn_servers: [
    {
      urls: 'turn:52.202.87.135',
      credential: 'qwerty42',
      username: 'webchat'
    }
  ],
  
  sig_servers: [
    {
      url: 'wss://52.202.87.135/signalling'
    }
  ]
}