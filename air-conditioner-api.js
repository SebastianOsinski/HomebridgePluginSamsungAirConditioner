var events = require('events');
var util = require('util');
var tls = require('tls');
var carrier = require('carrier');
var fs = require('fs');
var path = require('path');

const port = 2878;

function AirConditionerApi(ipAddress, mac, token, log) {
    this.ipAddress = ipAddress;
    this.mac = mac;
    this.token = token;
    this.log = log;
}

util.inherits(AirConditionerApi, events.EventEmitter);

AirConditionerApi.prototype.connect = function(loginSuccessCallback) {
    this.callbacks = {};
  
    var pfxPath = path.join(__dirname, 'ac14k_m.pfx')

    this.socket = tls.connect({ pfx: fs.readFileSync(pfxPath), port: port, host: this.ipAddress, rejectUnauthorized: false }, function() {  
      this.log('connected', { ipaddr: this.ipAddress, port: port, tls: true });
  
      this.socket.setEncoding('utf8');
      carrier.carry(this.socket, function(line) {
        var callback, id, state;
  
        if (line === 'DRC-1.00') {
          return;
        }
  
        if (line === '<?xml version="1.0" encoding="utf-8" ?><Update Type="InvalidateAccount"/>') {
          return this._send('<Request Type="AuthToken"><User Token="' + this.token + '" /></Request>');
        }
  
        if (line.match(/Response Type="AuthToken" Status="Okay"/)) {
           this.emit('loginSuccess');

            loginSuccessCallback()
        }
  
        this.log('read', { line: line });
  
        // Other events
        if (line.match(/Update Type="Status"/)) {
          if ((matches = line.match(/Attr ID="(.*)" Value="(.*)"/))) {
            state = {};
            state[matches[1]] = matches[2];
  
            this.emit('stateChange', state);
          }
        }
  
        if (line.match(/Response Type="DeviceState" Status="Okay"/)) {
            state = {};
  
            var attributes = line.split("><");
            attributes.forEach(function(attr) {
              if ((matches = attr.match(/Attr ID="(.*)" Type=".*" Value="(.*)"/))) {
                state[matches[1]] = matches[2];
              }
            });
  
            this.emit('stateChange', state);
        }

        if (line.match(/Response Type="DeviceControl" Status="Okay"/)) {
            if ((matches = line.match(/CommandID="cmd(.*)"/))) {
                id = matches[1];
            }
        }
  
        this.log(id);
        if (!this.callbacks[id]) return;
        callback = this.callbacks[id];
        delete(this.callbacks[id]);

        callback(null, line);
      }.bind(this));
    }.bind(this)).on('end', function() {
      this.emit('end');
    }.bind(this)).on('error', function(err) {
      this.emit('error', err);
    }.bind(this));
};

AirConditionerApi.prototype._device_control = function(key, value, callback) {
    var id;
  
    if (!this.socket) throw new Error('not logged in');
  
    id = Math.round(Math.random() * 10000);

    if (!!callback) this.callbacks[id] = callback;
  
    this._send(
      '<Request Type="DeviceControl"><Control CommandID="cmd' + id + '" DUID="' + this.mac + '"><Attr ID="' + key + '" Value="' + value + '" /></Control></Request>'
    );
};
  
AirConditionerApi.prototype._send = function(xml) {  
    this.log('write', { line: xml });
    this.socket.write(xml + "\r\n");
  
    return this;
};

AirConditionerApi.prototype.onoff = function(onoff, callback) {
    this._device_control('AC_FUN_POWER', onoff ? 'On' : 'Off', callback);
};
  
module.exports = AirConditionerApi;