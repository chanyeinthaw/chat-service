const fs = require('fs')
const Routes = require('./Routes')

class HTTPServer {
    constructor(express, config, ssl) {
        this._express = express
        this._config = config

        this.configure()

        if (config.secure) {
            this._secureServer = require('https').createServer( {
                key: fs.readFileSync(ssl.key),
                cert: fs.readFileSync(ssl.cert)
            }, this._express)

            this._unSecureServer = require('http').createServer(this._express)
        } else {
            this._unSecureServer = require('http').createServer(this._express)
        }
    }

    configure() {
        this._express.use(function(req, res, next) {
            res.header("Access-Control-Allow-Origin", req.headers.origin);
            res.header('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE,OPTIONS');
            res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
            res.header("Access-Control-Allow-Credentials", "true")
            next();
        });

        new Routes(this._express)
    }

    start() {
        let ports = this._config.port
        let port = ports.secure
        let unsecurePort = ports.unsecure
        let host = this._config.host

        if (host) {
            if (this._config.secure) {
                this._secureServer.listen(port, host, this._serverErrorHandler)
                this._unSecureServer.listen(unsecurePort, host, this._serverErrorHandler)
            } else {
                this._unSecureServer.listen(unsecurePort, host, this._serverErrorHandler)
            }
        } else {
            if (this._config.secure) {
                this._secureServer.listen(port, this._serverErrorHandler)
                this._unSecureServer.listen(unsecurePort, this._serverErrorHandler)
            } else {
                this._unSecureServer.listen(unsecurePort, this._serverErrorHandler)
            }
        }

        console.log(`HTTPS Server Started ${host ? host : ':'}:${this._config.secure ? port : unsecurePort}`)
    }

    get serverSecure() {
        return this._secureServer
    }

    get serverUnsecure() {
        return this._unSecureServer
    }

    set serverErrorHandler (value) {
        this._serverErrorHandler = value
    }
}

module.exports = HTTPServer