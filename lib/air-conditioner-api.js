const events = require('events');
const util = require('util');
const tls = require('tls');
const carrier = require('carrier');
const fs = require('fs');
const path = require('path');
const shortid = require('shortid');

const port = 2878;

function AirConditionerApi(ipAddress, duid, token, log) {
    this.ipAddress = ipAddress;
    this.duid = duid;
    this.token = token;
    this.log = log;
};

AirConditionerApi.prototype = {
    connect: function () {
        this.log('Connecting...');

        this.controlCallbacks = {};
        this.stateCallbacks = {};

        const pfxPath = path.join(__dirname, '../res/ac14k_m.pfx')

        const options = {
            pfx: fs.readFileSync(pfxPath),
            port: port,
            host: this.ipAddress,
            rejectUnauthorized: false,
            ciphers: 'HIGH:!DH:!aNULL'
        };

        this.socket = tls.connect(options, function () {
            this.log('Connected');
            // All responses from AC are received here as lines
            carrier.carry(this.socket, this._readLine.bind(this));
        }.bind(this))

        this.socket
            .on('end', this._connectionEnded.bind(this))
            .on('close', this._connectionClosed.bind(this))
            .on('error', this.log);
    },

    deviceControl: function (key, value, callback) {
        if (!this.socket) throw new Error('not logged in');

        // Create id for callback. It will be passed to request and returned by AC in response
        // It allows us to match callbacks to responses received in `carrier.carry` callback above
        const id = shortid.generate()

        if (!!callback) this.controlCallbacks[id] = callback;

        this._send(
            '<Request Type="DeviceControl"><Control CommandID="' + id + '" DUID="' + this.duid + '"><Attr ID="' + key + '" Value="' + value + '" /></Control></Request>'
        );
    },

    _send: function (line) {
        this.log('Write: ', line);
        this.socket.write(line + "\r\n");
    },

    _readLine: function (line) {
        if (line.match(/Update Type="InvalidateAccount"/)) { // Returned in the beginning of connection. We need to send auth request with token.
            this._handleInvalidateAccount();
        } else if (line.match(/Response Type="AuthToken" Status="Okay"/)) { // Auth success
            this._handleAuthSuccessResponse();
        } else if (line.match(/Update Type="Status"/)) { // Status update received - AC sends them when some setting is changed via remote. 
            this._handleDeviceStatusUpdate(line);
        } else if (line.match(/Response Type="DeviceState" Status="Okay"/)) { // Status response received - AC sends it after receiving request for status
            this._handleDeviceStateResponse(line);
        } else if (line.match(/Response Type="DeviceControl" Status="Okay"/)) { // Control confirmation received - AC sends it to confirm control success
            this._handleDeviceControlResponse(line);
        };
    },

    _handleInvalidateAccount: function() {
        this.log("Auth request received - Authenticating...");

        this._send('<Request Type="AuthToken"><User Token="' + this.token + '"/></Request>');
    },

    _handleAuthSuccessResponse: function() {
        this.log("Authentication succeeded");
        this.log("Requesting full state summary...");

        this._send('<Request Type="DeviceState" DUID="' + this.duid + '"></Request>');
    },

    _handleDeviceStateResponse: function (line) {
        this.log("Full state summary received");

        const attributes = line.split("><");
        const state = {};
        attributes.forEach(function (attr) {
            if ((matches = attr.match(/Attr ID="(.*)" Type=".*" Value="(.*)"/))) {
                const id = matches[1];
                state[id] = matches[2];
            }
        }.bind(this));

        this.emit('stateUpdate', state);
    },

    _handleDeviceControlResponse: function (line) {
        if ((matches = line.match(/CommandID="(.*)"/))) {
            id = matches[1];

            if (!this.controlCallbacks[id]) return;
            callback = this.controlCallbacks[id];
            delete (this.controlCallbacks[id]);

            callback(null);
        }
    },

    _handleDeviceStatusUpdate: function(line) {
        if ((matches = line.match(/Attr ID="(.*)" Value="(.*)"/))) {
            const state = {};
            state[matches[1]] = matches[2];

            this.emit('stateUpdate', state);
        }
    },

    _connectionEnded: function () {
        this.log('Connection ended');
    },

    _connectionClosed: function (hadError) {
        this.log('Connection closed' + (hadError ? ' because error occured' : ''));
        this.log('Trying to reconnect in 5s...');

        setTimeout(this.api.connect.bind(this), 5000);
    }
};

util.inherits(AirConditionerApi, events.EventEmitter);

module.exports = AirConditionerApi;