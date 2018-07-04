class SocketClient {
    constructor(socket) {
        this._userId = null
        this._socket = socket
        this._socketId = socket.id
        this._isAuthorized = false
        this._isSuperuser = false
        this._isAdmin = false;
    }

    authorize() {
        this._isAuthorized = true
    }

    revoke() {
        this._isAuthorized = false
    }

    makeSuperuser() {
        this._isSuperuser = true
    }

    revokeSuperuser() {
        this._isSuperuser = false
    }

    makeAdmin() {
        this._isAdmin = true
    }

    revokeAdmin() {
        this._isAdmin = false
    }

    set userId(value) {
        this._userId = value
    }

    get userId() {
        return this._userId
    }

    get socketId() {
        return this._socketId
    }

    get socket() {
        return this._socket
    }

    get isAdmin() {
        return this._isAdmin
    }

    get isSuperuser() {
        return this._isSuperuser
    }

    get isAuthorized() {
        return this._isAuthorized
    }
}

module.exports = SocketClient