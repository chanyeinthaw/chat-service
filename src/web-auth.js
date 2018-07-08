const request = require('sync-request');

module.exports = function(sessionId, config) {
    let authURL = `http://${config.host}:${config.port}/api/io-auth`;
    let requestMethod = 'GET';

	let res = request(requestMethod, `${authURL}?session_id=${sessionId}`);

	if (res.statusCode === 200) {
		return JSON.parse(res.getBody());
	}

	return {success: false};
};