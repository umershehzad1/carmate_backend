'use strict'

let jwt = require('jsonwebtoken');

const base64id = require('base64id')

let config = {}
config.app = require('../config/app');

/* Controllers */
let socketCtrl = require("../app/Http/Controllers/v1/SocketController");

/*
|--------------------------------------------------------------------------
| Reuse SocketId
|--------------------------------------------------------------------------
|
| Override thw actuall socket.io engine gernerate Id function
| If user pass the existing socket id it will override the existing one.
|
*/

io.engine.generateId = req => {
    let query = require('url').parse(req.url,true).query;
    const prevId = query['socketId'];
    // prevId is either a valid id or an empty string
    if (prevId) {
      return prevId
    }
    return base64id.generateId()
  }

/*
|--------------------------------------------------------------------------
| Socket Routes
|--------------------------------------------------------------------------
|
| Here is where you can register Socket routes for your application. These
| routes are loaded by the RouteServiceProvider within a group which
| is assigned the "socket" middleware group. Enjoy building your Socket Paths!
|
*/

io.use(function(socket, next){
    
    if(!socket.handshake.query || !socket.handshake.query.token){
        
        return next(new Error('Authentication error'));
    }
    
    let token = socket.handshake.query.token;

    jwt.verify(token, config.app.key, function(err, decoded){

        if(err){
            return next(new Error('Authentication error'));
        }

        next();
        
    });
}).on('connect', function(socket){
    console.log('User Connected: ', socket.id);
    console.log('User Profile: ', socket.decoded);

    socket.on('disconnect', function() { console.log("User Disconnected: ", socket.id); });
})

io.of("/admin").use(function(socket, next){
    next();
}).on('connect', socket => {
    console.log(Object.keys(io.sockets.connected).length);
    socket.on('stats', () => {socketCtrl.stats(socket) });
});
