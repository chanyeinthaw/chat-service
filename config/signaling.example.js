module.exports = {
    isDev: true,
    server: {
        port: 8888,
        secure: true,
        key: "./cert/server.key",
        cert: "./cert/server.crt",
        password: null
    },

    rooms: {
        maxClients: 0
    },
    xirsys: {
        gateway: "global.xirsys.net",
        info: {
            ident: "kokoayeminoo",
            secret: "b180ef38-7c94-11e8-9c56-c7092173fc20",
            channel: "bizlaw"
        }
    }
}
