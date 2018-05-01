const SocketEndpoint = require('./src/socket/socket-endpoint.js');
const Dbao = require('./src/database/dbao.js');
const config = require('./config.js');

new SocketEndpoint(config.port, new Dbao(config.mysql), config.ioConfig);