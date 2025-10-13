'use strict'

require('dotenv').config();
const { port } = require('./config/app');
const { database } = require('./config/database');
require('./config/connection')
const apiRoutes = require('./routes/api');
/*
 |--------------------------------------------------------------------------
 | Node_framwork - A Node Framework For Website & apis
 |--------------------------------------------------------------------------
 |
 | This file allows us to Starts server & gave functionality from the
 | built-in Node web server. 
 |
 */

const express = require('express');
const autoload = require('./bootstrap/autoload');

let app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use('/', autoload);
app.use('/api/v1', apiRoutes);
let http = require('http').Server(app);
global.io = require('socket.io')(http, { path: '/socket.io', });
require('./routes/socket');

http.listen(port, () => {
    console.log('Server Running on port ' + port);
});

app.on('error', onError);
app.on('listening', onListening);

/**
* Event listener for HTTP server "error" event.
*/

function onError(error) {
    if (error.syscall !== 'listen') {
        throw error;
    }

    let bind = typeof port === 'string'
        ? 'Pipe ' + port
        : 'Port ' + port;

    // handle specific listen errors with friendly messages
    switch (error.code) {
        case 'EACCES':
            console.error(bind + ' requires elevated privileges');
            process.exit(1);
            break;
        case 'EADDRINUSE':
            console.error(bind + ' is already in use');
            process.exit(1);
            break;
        default:
            throw error;
    }
}

/**
* Event listener for HTTP server "listening" event.
*/

function onListening() {
    let addr = server.address();
    let bind = typeof addr === 'string'
        ? 'pipe ' + addr
        : 'port ' + addr.port;
    debug('Listening on ' + bind);
}