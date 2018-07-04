const request = require('sync-request');
const config = require('../config/chat.js');

const authURL = `http://${config.server.host}:${config.server.port}/api/io-auth`;
const requestMethod = 'GET';

module.exports = function(sessionId) {
	let res = request(requestMethod, `${authURL}?session_id=${sessionId}`);

	if (res.statusCode === 200) {
		return JSON.parse(res.getBody());
	}

	return {success: false};
};