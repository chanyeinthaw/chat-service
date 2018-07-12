const uuid = require('node-uuid')
const os = require('os')
const https = require('https')

const EVENTS = {
    receive: {
        onMessage: 'message',
        onCreateOrJoin: 'create or join',
        onIpAddress: 'ipaddr',
        onBye: 'bye',
        adminList: 'adminList',
        incomingCall: 'incomingCall',
        callAnswered: 'callAswered'
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

        this._admins = []

        this._client.resources = {
            screen: false,
            video: true,
            audio: false,
            room: '',
            available: true
        }

        this.registerEvents()
    }

    log () {
        let msgs = ['Log Msg']
        msgs.push.apply(msgs, arguments)

        console.log('log', msgs)
        this._client.emit('log', msgs)
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
                // iceServers.forEach( (server) => {
                //     if(server.url.indexOf("stun:") !== -1){
                //         stunservers.push(server);
                //     }else{
                //         turnservers.push(server);
                //     }
                // })
                // this._client.emit('stunservers', stunservers || []);
                // this._client.emit('turnservers', turnservers);

                this._client.emit('iceCandidates', iceServers)
            })
        })

        httpreq.end()
    }

    registerEvents() {
        this._server.broadcast(EVENTS.receive.adminList, {
            adminId: this._client.id,
            available: this._client.resources.available
        })

        this._client.on(EVENTS.receive.onMessage, this.onMessage.bind(this))

        this._client.on(EVENTS.receive.onCreateOrJoin, this.onCreateOrJoin.bind(this))

        this._client.on(EVENTS.receive.onBye, this.onBye.bind(this))

        this._client.on(EVENTS.receive.onIpAddress, this.onIpAddress.bind(this))

        this._client.on(EVENTS.receive.callAnswered, (data) => {
            this._client.resources.available = false

            this._server.broadcast(EVENTS.receive.adminList, {
                adminId: this._client.id,
                available: this._client.resources.available
            })

            this._server.broadcast(EVENTS.receive.callAnswered, data)
        })

        this._client.on(EVENTS.receive.incomingCall, (data) => {
            this._server.broadcast(EVENTS.receive.incomingCall, data)
        })
    }

    onMessage(details) {
        this.log('Client onMessage: ' , details)
        console.log(`Clienet message: ${details}`)

        this._server.broadcastToRoom(this._client.resources.room, EVENTS.emit.message, details)
    }

    onCreateOrJoin(room) {
        this.log('Client onCreateOrJoin: ', room)

        let numClients = this._server.getNumberOfClientsInRoom(room)

        this.log('Room numClients: ', numClients)

        if (numClients === 0) {
            this._client.resources.room = room
            this._client.join(room)
            // this._rooms[name].push(this._client.id)

            this.log('Client roomCreated: ' + this._client.id, ' Room: ', room)
            this._client.emit(EVENTS.emit.created, room, this._client.id)
        } else  {
            if (numClients >= this._config.rooms.maxClients) {
                this._client.emit(EVENTS.emit.full, room)
            } else {
                this._client.resources.room = room
                this._client.join(room)

                this.log('Client roomJoined: ' + this._client.id, ' Room: ', room)
                this._client.emit(EVENTS.emit.joined, room, this._client.id)
                this._server.broadcastToRoom(room, EVENTS.emit.ready, {})
            }
        }
    }

    onBye(name) {
        this._client.leave(name, () => {})
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