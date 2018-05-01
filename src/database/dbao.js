const mysql = require('mysql');

const MSGStatus = {
	Unread: 0,
	Pending: 1,
	Read: 2
};

class Dbao {
	constructor(config) {
		this.conn = mysql.createConnection(config);

		this.conn.connect();
	}

	addNewTextMessageRow(cid, ct, suid, callback) {
		this.addNewMessageRow(cid, ct, '', '', MSGStatus.Unread ,suid, callback);
	}

	addNewImageMessageRow(cid, img, suid, callback) {
		//this.addNewMessageRow(cid, '', img, '', suid, callback);
	}

	addNewFileMessageRow(cid, ct, suid, callback) {
		//this.addNewMessageRow(cid, ct, '', '', suid, callback);
	}

	addNewMessageRow(cid, ct, img, doc, sent, suid, callback) {
		let newMessageQuery =
			'INSERT INTO messages SET ?';

		let data = {
			conversation_id: cid,
			content: ct,
			images: img,
			docs: doc,
			sent: sent,
			superuser_id: suid
		};

		this.conn.query(newMessageQuery, data, function(error, result, fields) {
			if (error) callback(error, null);
			else callback(null, result);
		});
	}

	loadUnreadMessagesForUser(userId, callback) {
		let query =
			`SELECT messages.id, messages.conversation_id as conversationId, conversations.title,
			messages.content, messages.images, messages.docs, messages.superuser_id as superuserId
			FROM conversations INNER JOIN messages on messages.conversation_id = conversations.id
			WHERE messages.sent = 0 AND conversations.user_id = ?`;

		this.conn.query(query, [userId], function(error, result, fields) {
			if (error) callback(error, null);
			else {
				callback(null, result);

				let idArray = [];

				for(let i = 0; i < result.length; i++) {
					idArray.push(result[i].id);
				}

				let updateQuery =
					`UPDATE messages SET sent = 2 WHERE id IN (?)`;

				this.conn.query(updateQuery, [idArray], (e,r,f) => {});
			}
		}.bind(this));
	}

	loadMessages(opts, callback) {
		let loadMessageQuery =
			'SELECT messages.*, superusers.id as superuser_id, superusers.name as superuser_name ' +
			'FROM messages ' +
			'INNER JOIN conversations ON messages.conversation_id = conversations.id ' +
			'INNER JOIN superusers ON messages.superuser_id = superusers.id ' +
			'WHERE conversations.user_id = ? AND messages.conversation_id = ? ' +
			'ORDER BY messages.created_at DESC LIMIT ' + opts.limit + ' OFFSET ' + opts.skip;

		this.conn.query(loadMessageQuery,
			[opts.userId, opts.conversationId], (error, result, fields) => {
			if (error) callback(error, null);
			else {
				for(let i = 0; i < result.length; i++) {
					let oldResult = result[i];

					oldResult.superuser = {
						id: oldResult.superuser_id,
						name: oldResult.superuser_name
					};

					delete oldResult.superuser_id;
					delete oldResult.superuser_name;

					result[i] = oldResult;
				}

				callback(null, {
					messages: result
				});
			}
		});
	}
}

module.exports = Dbao;