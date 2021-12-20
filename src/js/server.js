const Tools = require('./tools.js');
const WebSocket = require('ws');

console.log("Creating websocket server");
const server = new WebSocket.Server({ port: 7042 });

console.log("Initializing websocket event handlers");
let pending_sockets = [];
let registered_sockets = {};

server.on('connection', function(socket) {
  console.log("Connection received");
  
  pending_sockets.push(socket);
  
  socket.on('message', function(msg) {
    
    var data = JSON.parse(msg);
    
    if (data['type'] == 'register') {
      console.log("Registering");
      if ( data['client_id'] ) {
        registered_sockets[data['client_id']] = socket;
        socket.send(JSON.stringify({"type": "register", "success": true}));
        
        //Impetus to connect is on the new client
        //Thus, notify the connecting client of the others
        for (const key in registered_sockets) {
          if (key != data['client_id']) {
            socket.send(JSON.stringify({"type": "new_peer", "peer_id": key}));
          }
        }
        
      } else {
        socket.send(JSON.stringify({"error": "invalid client id"}));
        socket.close();
      }
    } else if ((data['type'] == 'keep_alive') || (data['message']['type'] == 'keep_alive')) {
      socket.send(JSON.stringify(data['message'])); //ping back keep-alive signal
    } else {
      console.log("receive: "+msg);
      
      var sender = data.message['client_id'];
      var receiver = data.message['peer_id'];
      if (registered_sockets[receiver]) {
        registered_sockets[receiver].send(JSON.stringify({"type": "message", "contents": data.message}));
      } else {
        console.log("Unable to forward message from "+sender+". "+receiver+" does not exist.");
        socket.send(JSON.stringify({"type": "peer_not_found", "peer_id": receiver }));
      }
    }
  });
  
  socket.on('close', function() {
    console.log("Connection closed");
    if(pending_sockets.includes(socket)) {
      pending_sockets = pending_sockets.filter(s => s !== socket);
    }
    Object.keys(registered_sockets).forEach((key, idx) => {
      if( registered_sockets[key] == socket ) {
        const { [key]: tmp, ...remaining_sockets } = registered_sockets;
        registered_sockets = remaining_sockets;
      }
    });
  });

});

console.log("Websocket server is ready!");
