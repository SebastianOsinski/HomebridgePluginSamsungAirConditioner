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
}

util.inherits(AirConditionerApi, events.EventEmitter);

const ACFun = {
    Power: 'AC_FUN_POWER',
    TempNow: 'AC_FUN_TEMPNOW',
    TempSet: 'AC_FUN_TEMPSET',
    OpMode: 'AC_FUN_OPMODE',
    Direction: 'AC_FUN_DIRECTION'
}

const OpMode = {
    Cool: 'Cool',
    Heat: 'Heat',
    Wind: 'Wind',
    Dry: 'Dry',
    Auto: 'Auto'
}

const Direction = {
    SwingUpDown: 'SwingUD',
    Fixed: 'Fixed'
}

AirConditionerApi.prototype.connect = function () {
    this.controlCallbacks = {};
    this.stateCallbacks = {};

    const pfxPath = path.join(__dirname, 'ac14k_m.pfx')

    const options = {
        pfx: fs.readFileSync(pfxPath),
        port: port,
        host: this.ipAddress,
        rejectUnauthorized: false,
        ciphers: 'HIGH:!DH:!aNULL'
    };

    const self = this;

    this.socket = tls.connect(options, function () {
        this.log('Connected');
        
        // All responses from AC are received here as lines
        carrier.carry(this.socket, this._readLine.bind(this));
    }.bind(this))
    .on('end', function () { self.emit('end'); })
    .on('error', function (err) { self.emit('error', err); })
    .on('close', function (hadError) { self.emit('close', hadError); });
};

AirConditionerApi.prototype.deviceControl = function (key, value, callback) {
    if (!this.socket) throw new Error('not logged in');

    // Create id for callback. It will be passed to request and returned by AC in response
    // It allows us to match callbacks to responses received in `carrier.carry` callback above
    const id = shortid.generate()

    if (!!callback) this.controlCallbacks[id] = callback;

    this._send(
        '<Request Type="DeviceControl"><Control CommandID="' + id + '" DUID="' + this.duid + '"><Attr ID="' + key + '" Value="' + value + '" /></Control></Request>'
    );
};

AirConditionerApi.prototype.deviceState = function (key, callback) {
    if (!this.socket) throw new Error('not logged in');

    if (!!callback) {
        // Requests for DeviceState do not support passing command ids. So we don't have ids to match callbacks to responses
        // Using key as id is not sufficient, because there might be possibility to send two requests with same key and second callback
        // will overwrite first one, making first callback not getting called at all - this causes issues in HomeKit. 
        // To fix that, we store array of callbacks for given key and in `carrier.carry` we call the oldest one (first one in array) and then remove it.
        if (!this.stateCallbacks[key]) {
            this.stateCallbacks[key] = [];
        }
        this.stateCallbacks[key].push(callback);
    }

    this._send(
        '<Request Type="DeviceState"><DUID="' + this.duid + '"><Attr ID="' + key + '" /></Request>'
    );
};

AirConditionerApi.prototype._send = function (line) {
    this.log('Write: ', line);
    this.socket.write(line + "\r\n");
};

AirConditionerApi.prototype._readLine = function (line) {
    this.log('Read: ', line);

    // Returned in the beginning of connection. We need to send auth request with token.
    if (line === '<?xml version="1.0" encoding="utf-8" ?><Update Type="InvalidateAccount"/>') {
        return this._send('<Request Type="AuthToken"><User Token="' + this.token + '"/></Request>');
    }

    // Auth success
    if (line.match(/Response Type="AuthToken" Status="Okay"/)) {
        this.emit('authSuccess');
        return;
    }

    // Status update received - AC sends them when some setting is changed via remote. 
    if (line.match(/Update Type="Status"/)) {
        if ((matches = line.match(/Attr ID="(.*)" Value="(.*)"/))) {
            const status = {};
            status.name = matches[1];
            status.value = matches[2];

            this.emit('statusChange', status);
        }
    }

    // Response for device state call received.
    if (line.match(/Response Type="DeviceState" Status="Okay"/)) {
        const attributes = line.split("><");
        const status = {};
        attributes.forEach(function (attr) {
            if ((matches = attr.match(/Attr ID="(.*)" Type=".*" Value="(.*)"/))) {
                const id = matches[1];
                status.name = matches[1];
                status.value = matches[2];

                if (!this.stateCallbacks[id]) return;
                const callback = this.stateCallbacks[id].shift();
                callback(null, status.value);
            }
        }.bind(this));

        this.emit('statusChange', status);
    }

    // Response for device control received
    if (line.match(/Response Type="DeviceControl" Status="Okay"/)) {
        if ((matches = line.match(/CommandID="(.*)"/))) {
            id = matches[1];

            if (!this.controlCallbacks[id]) return;
            callback = this.controlCallbacks[id];
            delete (this.controlCallbacks[id]);

            callback(null);
        }
    }
};

module.exports = {
    AirConditionerApi: AirConditionerApi,
    ACFun: ACFun,
    OpMode: OpMode,
    Direction: Direction
}