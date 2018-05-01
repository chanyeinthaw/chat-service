const mysql = require('mysql');

class Dbao {
	constructor(config) {
		this.conn = mysql.createConnection(config);

		this.conn.connect();
	}

	loadUnreadMessagesForUser(userId, callback) {
		let query =
			`SELECT messages.id, messages.conversation_id as conversationId, conversations.title,
			messages.content, messages.images, messages.docs, messages.superuser_id as superuserId
			FROM conversations INNER JOIN messages on messages.conversation_id = conversations.id
			WHERE messages.sent = 0 AND conversations.user_id = ?`;

		let updateQuery =
			`UPDATE messages SET sent = 2 WHERE id IN (?)`;

		this.conn.query(query, [userId], function(error, result, fields) {
			if (error) callback(error, null);
			else {
				callback(null, result);

				let idArray = [];

				for(let i = 0; i < result.length; i++) {
					idArray.push(result[i].id);
				}

				this.conn.query(updateQuery, [idArray], (e,r,f) => {});
			}
		}.bind(this));
	}
}

module.exports = Dbao;