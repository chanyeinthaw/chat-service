const uuid = require('node-uuid')
const os = require('os')
const https = require('https')

const EVENTS = {
    receive: {
        onMessage: 'message',
        onCreateOrJoin: 'create or join',
        onIpAddress: 'ipaddr',
        onBye: 'bye'
    },

    emit: {
        message: 'message',
        log: 'log',
        created: 'created',
        join: 'join',
        joined: 'joined',
        full: 'full',
        ipAddr: 'ipaddr',
        ready: 'ready'
    }
}

class SignalingServer {
    constructor(server, client, config) {
        this._server = server
        this._client = client
        this._config = config

        this._rooms = {}

        this._client.resources = {
            screen: false,
            video: true,
            audio: false,
            room: ''
        }

        this.registerEvents()
    }

    joinRoom(name) {
        if (!this._rooms.hasOwnProperty(name)) {
            this._rooms[name] = []
        }

        this._client.resources.room = name
        this._client.join(name)
        this._rooms[name].push(this._client.id)
    }

    leaveRoom(name) {
        if (this._rooms.hasOwnProperty(name)) {
            let index = this._rooms[name].indexOf(this._client.id)

            this._rooms[name].splice(index, 1)
            this._client.leave(name, () => {})
        }
    }

    getNoClientsInRoom(name) {
        return this._rooms.hasOwnProperty(name) ? this._rooms[name].length : 0
    }

    requestIce() {
        let xirsys = this._config.xirsys
        let options = {
            host: xirsys.gateway,
            path: `/_turn/${xirsys.info.channel}`,
            method: 'PUT',
            headers: {
                'Authorization': 'Basic ' + new Buffer(xirsys.info.ident + ':' + xirsys.info.secret).toString('base64')
            }
        }

        let httpreq = https.request(options, (httpres) => {
            let str = ''
            httpres.on("data", (data) => {
                str += data
            })
            httpres.on("error", (e) => {
                console.log("error: ",e)
            })

            httpres.on("end", () => {
                let result = JSON.parse(str)
                let iceServers = result.v.iceServers
                let turnservers = [],
                    stunservers = [];
                iceServers.forEach( (server) => {
                    if(server.url.indexOf("stun:") !== -1){
                        stunservers.push(server);
                    }else{
                        turnservers.push(server);
                    }
                })
                this._client.emit('stunservers', stunservers || []);
                this._client.emit('turnservers', turnservers);
            })
        })

        httpreq.end()
    }

    registerEvents() {
        this._client.on(EVENTS.receive.onMessage, this.onMessage.bind(this))

        this._client.on(EVENTS.receive.onCreateOrJoin, this.onCreateOrJoin.bind(this))

        this._client.on(EVENTS.receive.onBye, this.onBye.bind(this))

        this._client.on(EVENTS.receive.onIpAddress, this.onIpAddress.bind(this))
    }

    onMessage(details) {
        this._server.broadcastToRoom(this._client.resources.room, EVENTS.emit.message, details)
    }

    onCreateOrJoin(room) {
        let numClients = this.getNoClientsInRoom(room)

        if (numClients === 0) {
            this.joinRoom(room)

            this._client.emit(EVENTS.emit.created, room, this._client.id)
        } else  {
            if (numClients >= this._config.rooms.maxClients) {
                this._client.emit(EVENTS.emit.full, room)
            } else {
                this.joinRoom(name)

                this._client.emit(EVENTS.emit.joined, room, this._client.id)
                this._server.broadcastToRoom(room, EVENTS.emit.ready, {})
            }
        }
    }

    onBye(name) {
        this.leaveRoom(name)
    }

    onIpAddress() {
        let ifaces = os.networkInterfaces()

        for (let dev in ifaces) {
            ifaces[dev].forEach((details) => {
                if (details.family === 'IPv4' && details.address !== '127.0.0.1') {
                    this._server.emit(EVENTS.emit.ipAddr, details.address)
                }
            })
        }
    }
}

module.exports = SignalingServer