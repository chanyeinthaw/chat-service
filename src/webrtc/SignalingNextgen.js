class SignalingNextgen {
    constructor(io, client) {
        this.io = io
        this.client = client

        this.registerEvents(client)
    }

    requestIce(config) {
        let xirsys = config.xirsys
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

                this.client.emit('iceServers', iceServers)
            })
        })

        httpreq.end()
    }

    registerEvents(client) {
        client.on('subscribe', this.onSubscribe.bind(this))

        client.on('publish', this.onPublish.bind(this))
    }

    publish(channel, message) {
        this.io.sockets.in(channel).emit('event', message)
    }

    onPublish(data) {
        this.publish(data.channel, data.message)
    }

    onSubscribe(channel) {
        this.client.join(channel)
    }
}

module.exports = SignalingNextgen