const mysql = require('mysql');

class PromiseDbao {
	constructor(config) {
		this.conn = mysql.createConnection(config);
		this.conn.connect();
	}

	addNewMessageRow(cid, ct, img, doc, sent, suid) {
		let newMessageQuery =
			'INSERT INTO messages SET ?';

		let data = {
			conversation_id: cid,
			content: ct,
			images: img,
			docs: doc,
			sent: sent,
			superuser_id: suid,
			created_at: new Date(),
			updated_at: new Date(),
		};

		return new Promise((resolve, reject) => {
			this.conn.query(newMessageQuery, data, (error, result, fields) => {
				if (error) reject(error);
				else {
					data.id = result.insertId;
					data.affectedRows = result.affectedRows;

					resolve(data);
				}
			});
		});
	}

	loadConversationsForUser(userId) {
		return new Promise((resolve, reject) => {
			let query = 'SELECT * FROM conversations WHERE user_id = ?';

			this.conn.query(query, [userId], function(e, r, f) {
				if (e) reject(e);
				else resolve(r);
			});
		});
	}

    loadAllConversations() {
	    return new Promise((resolve, reject) => {
	        let query = 'SELECT conversations.*, userdetails.* FROM conversations INNER JOIN userdetails ON conversations.user_id = users.id;';
	        this.conn.query(query, function (e, r, f) {
                if (e) reject(e);
                else resolve(r);
            })
        });
    }

	loadUnreadMessageForUser(userId, callback) {
		return new Promise((resolve, reject) => {
			let query =
				`SELECT messages.*,conversations.title as conversationTitle, superusers.name as superuser_name 
			FROM conversations INNER JOIN messages on messages.conversation_id = conversations.id INNER JOIN superusers on messages.superuser_id = superusers.id
			WHERE messages.sent = 0 AND conversations.user_id = ? AND messages.superuser_id IS NOT NULL ORDER BY messages.created_at DESC`;

			this.conn.query(query, [userId], (error, result, fields) => {
				if (error) reject(error);
				else {
					for(let i = 0; i < result.length; i++) {
						let oldResult = result[i];
						oldResult.superuser = {
							id: oldResult.superuser_id,
							name: oldResult.superuser_name
						};

						delete oldResult.superuser_name;

						result[i] = oldResult;
					}

					resolve({
						messages: result
					});
				}
			});
		})
	}

	updateMessageSentStatus(idArray) {
		return new Promise((resolve, reject) => {
			this.conn.query('UPDATE messages SET sent = 2 WHERE id IN (?)', [idArray], (e, r, f) => {
				if (e) reject(e);
				else resolve(r);
			});
		});
	}

	loadMessages(opts) {
		return new Promise((resolve, reject) => {
			let loadMessageQuery =
				'SELECT messages.*, messages.superuser_id as msuid, superusers.name as ssuname ' +
				'FROM messages ' +
				'INNER JOIN conversations ON messages.conversation_id = conversations.id ' +
				'LEFT JOIN superusers ON messages.superuser_id = superusers.id ' +
				'WHERE conversations.user_id = ? AND messages.conversation_id = ? ' +
				'ORDER BY messages.created_at DESC LIMIT ' + opts.limit + ' OFFSET ' + opts.skip;

			this.conn.query(loadMessageQuery,
			[opts.userId, opts.conversationId], (error, result, fields) => {
				if (error) reject(error);
				else {
					for(let i = 0; i < result.length; i++) {
						let oldResult = result[i];

						if (oldResult.msuid === null) {
							oldResult.superuser = null;
						} else {
							oldResult.superuser = {
								id: oldResult.msuid,
								name: oldResult.ssuname
							};
						}

						delete oldResult.msuid;
						delete oldResult.ssuname;

						result[i] = oldResult;
					}

					resolve({
						messages: result
					});
				}
			});
		})
	}
}

module.exports = PromiseDbao;