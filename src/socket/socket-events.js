module.exports = {
	onConnection: 'connection',
	onDisconnect: 'disconnect',
	onAuthenticate: 'onAuthenticate',
	onError: 'onClientError',

	onMessageSend: 'onMessageSend',
	onLoadUnreadMessages: 'onLoadUnreadMessages',
	onLoadMessages: 'onLoadMessages',

	onMessageReceived: 'onMessageReceive',

	onNewConversation: 'onNewConversation',
	onDeleteConversations: 'onDeleteConversations',
	onLoadAllConversations: 'onLoadAllConversations',
	onLoadUnloadConversation: 'onLoadUnloadConversation',

	onUpdateMessageSentStatus: 'onUpdateMessageSentStatus'
};