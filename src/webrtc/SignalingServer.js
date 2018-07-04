const uuid = require('node-uuid')
const https = require('https')

class SignalingServer {
    constructor(server, client, config) {
        this._server = server
        this._client = client
        this._config = config

        this._client.resources = {
            screen: false,
            video: true,
            audio: false
        }

        this.registerEvents()
    }

    requestIce() {
        let xirsys = this._config.xirsys
        let origin = this._client.handshake.origin
        let options = {
            host: xirsys.host,
            path: `/_turn/${xirsys.channel}`,
            method: 'PUT',
            headers: {
                'Authorization': 'Basic ' + new Buffer(xirsys.info.ident + ':' + xirsys.info.secret)
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
        this._client.on('message', this.onMessage.bind(this))

        this._client.on('join', this.onJoin.bind(this))

        this._client.on('create', this.onCreate.bind(this))

        this._client.on('leave', () => {
            this.removeFeed()
        })

        this._client.on('trace', function (data) {
            console.log('trace', JSON.stringify(
                [data.type, data.session, data.prefix, data.peer, data.time, data.value]
            ));
        });
    }

    removeFeed() {
        if (this._client.room) {
            this._server.broadcastToRoom(client.room, 'remove', {
                id: this._client.id,
                type: type
            })
            if (!type) {
                this._client.leave(this._client.room, (err) => {})
                this._client.room = undefined
            }
        }
    }

    describeRoom(name) {
        let adapter = this._server.nsps['/'].adapter
        let clients = adapter.rooms[name] || {}
        let result = {
            clients: {}
        }
        Object.keys(clients).forEach(function (id) {
            result.clients[id] = adapter.nsp.connected[id].resources
        })
        return result
    }

    onMessage(details) {
        if (!details) return

        let otherClient = this._server.to(details.to)

        if (!otherClient) return

        details.from =  this._client.id
        otherClient.emit('message', details)
    }

    onJoin(name, callback) {
        if (typeof name !== 'string') return
        if (this._config.rooms && this._config.rooms.maxClients > 0 &&
        this._server.getNumberOfClientsInRoom(name) >= this._config.rooms.maxClients) {
            safeCb(callback)('full')
        }
        this.removeFeed()
        safeCb(callback)(null, this.describeRoom(name))
        this._client.join(name)
        this._client.room = name
    }

    onCreate(name, cb) {
        if (arguments.length === 2) {
            cb = safeCb(cb)
            name = name || uuid();
        } else {
            cb = name;
            name = uuid();
        }

        let room = this._client.nsps['/'].adapter.rooms[name];
        if (room && room.length) {
            safeCb(cb)('taken');
        } else {
            this.onJoin(name);
            safeCb(cb)(null, name);
        }
    }
}

const safeCb = (cb) => typeof cb === 'function' ? cb : function() {};

module.exports = SignalingServer