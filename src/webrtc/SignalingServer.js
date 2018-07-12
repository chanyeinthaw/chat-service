const uuid = require('node-uuid')
const os = require('os')
const https = require('https')

const EVENTS = {
    receive: {
        onMessage: 'message',
        onCreateOrJoin: 'join',
        onIpAddress: 'ipaddr',
        onBye: 'bye',
        adminList: 'adminList',
        incomingCall: 'incomingCall',
        callAnswered: 'callAswered'
    },

    emit: {
        message: 'message',
        log: 'log',
        joined: 'joined',
        created: 'created',
        full: 'full',
        ipAddr: 'ipaddr',
        ready: 'ready'
    }
}

let admins = []

class SignalingServer {
    constructor(server, client, config) {
        this._server = server
        this._client = client
        this._config = config


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
        this._client.on('admin', (available) => {
            let info = {
                id: this._client.id,
                available: available
            }

            admins.push(info)

            console.log(`Push ${info}`)
            console.log(`Admins: ${JSON.stringify(admins)}`)

            this._server.broadcast(EVENTS.receive.adminList, info)
        })

        this._client.on('available', () => {
            console.log(`Admin available`)
            for(let i in admins) {
                let admin = admins[i]
                if (admin.id === this._client.id) {
                    admins[i].available = true

                    this._server.broadcast(EVENTS.receive.adminList, {
                        id: this._client.id,
                        available: true
                    })
                }
            }
        })

        this._client.on(EVENTS.receive.onMessage, this.onMessage.bind(this))

        this._client.on(EVENTS.receive.onCreateOrJoin, this.onCreateOrJoin.bind(this))

        this._client.on(EVENTS.receive.onBye, this.onBye.bind(this))

        this._client.on(EVENTS.receive.onIpAddress, this.onIpAddress.bind(this))

        this._client.on(EVENTS.receive.callAnswered, (data) => {
            console.log(`Admin call answered`)
            for(let i in admins) {
                let admin = admins[i]
                if (admin.id === this._client.id) {
                    admins.available = false

                    this._server.broadcast(EVENTS.receive.adminList, {
                        id: this._client.id,
                        available: false
                    })

                    break;
                }
            }
        })

        this._client.on(EVENTS.receive.incomingCall, (data) => {
            console.log(`Admins: ${admins}`)

            for(let admin of admins) {
                if (admin.available === true) {
                    console.log(`Sending call to ${admin.id}`)
                    this._server.server.to(admin.id).emit(EVENTS.receive.incomingCall, data)

                    break;
                }
            }
        })

        this._client.on('disconnect', () => {
            console.log(`Signaling client ${JSON.stringify(this._client.resources)}`)
            console.log(`Signaling Client disconnected from ${this._client.resources.room}`)

            for(let i in admins) {
                let admin = admins[i]
                if (admin.id === this._client.id) {
                    admins.available = false

                    this._server.broadcast(EVENTS.receive.adminList, {
                        id: this._client.id,
                        available: false
                    })

                    admins.splice(i, 1)

                    break;
                }
            }

            this._server.broadcastToRoom(this._client.resources.room, EVENTS.emit.message , 'bye')
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

            this.log('Client roomCreated: ' + this._client.id, ' Room: ', room, ' Res: ', JSON.stringify(this._client.resources))
            this._client.emit(EVENTS.emit.created, room, this._client.id)
        } else  {
            if (numClients >= this._config.rooms.maxClients) {
                this._client.emit(EVENTS.emit.full, room)
            } else {
                this._client.resources.room = room
                this._client.join(room)

                this.log('Client roomJoined: ' + this._client.id, ' Room: ', room)
                this._client.emit(EVENTS.emit.joined, room, this._client.id)
                // this._server.broadcastToRoom(EVENTS.emit.joined, room)
                this._server.broadcastToRoom(room, EVENTS.emit.ready, {})
            }
        }
    }

    onBye(name) {
        this._client.leave(name, () => {})

        this._server.broadcastToRoom(name, 'bye', name)
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