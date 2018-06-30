const SocketEndpoint = require('./src/socket/SocketEndpoint.js');
const Dbao = require('./src/database');
const config = require('./config.js');

process.on('unhandledRejection', error => {
	console.log('UnhandledRejection', error.code ,error.message);
});


new SocketEndpoint(config.port, new Dbao(config.mysql), config.ioConfig);