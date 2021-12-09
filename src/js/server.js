const WebSocket = require('ws');

console.log("Creating websocket server");
const server = new WebSocket.Server({ port: 7042 });

console.log("Initializing websocket event handlers");
let sockets = [];

server.on('connection', function(socket) {
  console.log("Connection received");
  sockets.push(socket);
  
  socket.on('message', function(msg) {
    console.log("receive: "+msg);
    
    sockets.forEach( function(s) {
      console.log("send: "+msg);
      s.send(msg);
    });
  });
  
  socket.on('close', function() {
    console.log("Connection closed");
    sockets = sockets.filter(s => s !== socket);
  });

});

console.log("Websocket server is ready!");