var events = require('events');
var util = require('util');
var tls = require('tls');
var carrier = require('carrier');
var fs = require('fs');
var path = require('path');
var shortid = require('shortid');

const port = 2878;

function AirConditionerApi(ipAddress, mac, token, log) {
    this.ipAddress = ipAddress;
    this.mac = mac;
    this.token = token;
    this.log = log;
}

util.inherits(AirConditionerApi, events.EventEmitter);

var ACFun = {
    Power: 'AC_FUN_POWER',
    TempNow: 'AC_FUN_TEMPNOW',
    TempSet: 'AC_FUN_TEMPSET',
    OpMode: 'AC_FUN_OPMODE',
    WindLevel: 'AC_FUN_WINDLEVEL'
}

var OpMode = {
    Cool: 'Cool',
    Heat: 'Heat',
    Wind: 'Wind',
    Dry: 'Dry',
    Auto: 'Auto'
}

AirConditionerApi.prototype.connect = function() {
    this.controlCallbacks = {};
    this.stateCallbacks = {};
  
    var pfxPath = path.join(__dirname, 'ac14k_m.pfx')

    var options = {
        pfx: fs.readFileSync(pfxPath), 
        port: port, 
        host: this.ipAddress,
        rejectUnauthorized: false
    };

    this.socket = tls.connect(options, function() {  
      this.log('Connected');
  
      this.socket.setEncoding('utf8');
      carrier.carry(this.socket, function(line) {
        var callback, status;
  
        if (line === 'DRC-1.00') {
          return;
        }
  
        if (line === '<?xml version="1.0" encoding="utf-8" ?><Update Type="InvalidateAccount"/>') {
          return this._send('<Request Type="AuthToken"><User Token="' + this.token + '" /></Request>');
        }
  
        if (line.match(/Response Type="AuthToken" Status="Okay"/)) {
           this.emit('authSuccess');
        }
  
        this.log('Read: ', line);
  
        if (line.match(/Update Type="Status"/)) {
          if ((matches = line.match(/Attr ID="(.*)" Value="(.*)"/))) {
            status = {};
            status.name = matches[1];
            status.value = matches[2];
  
            this.emit('statusChange', status);
          }
        }
  
        if (line.match(/Response Type="DeviceState" Status="Okay"/)) {
            status = {};
  
            var attributes = line.split("><");
            attributes.forEach(function(attr) {
              if ((matches = attr.match(/Attr ID="(.*)" Type=".*" Value="(.*)"/))) {
                id = matches[1];
                status.name = matches[1];
                status.value = matches[2];
                
                if (!this.stateCallbacks[id]) return;
                callback = this.stateCallbacks[id].shift();
                callback(null, status.value);
              }
            }.bind(this));
  
            this.emit('statusChange', status);
        }

        if (line.match(/Response Type="DeviceControl" Status="Okay"/)) {
            if ((matches = line.match(/CommandID="(.*)"/))) {
                id = matches[1];

                if (!this.controlCallbacks[id]) return;
                callback = this.controlCallbacks[id];
                delete(this.controlCallbacks[id]);
        
                callback(null);
            }
        }
      }.bind(this));
    }.bind(this)).on('end', function() {
      this.emit('end');
    }.bind(this)).on('error', function(err) {
      this.emit('error', err);
    }.bind(this));
};

AirConditionerApi.prototype._send = function(line) {  
    this.log('Write: ', line);
    this.socket.write(line + "\r\n");
};

AirConditionerApi.prototype.deviceControl = function(key, value, callback) {
    if (!this.socket) throw new Error('not logged in');
  
    var id = shortid.generate()

    if (!!callback) this.controlCallbacks[id] = callback;
  
    this._send(
      '<Request Type="DeviceControl"><Control CommandID="' + id + '" DUID="' + this.mac + '"><Attr ID="' + key + '" Value="' + value + '" /></Control></Request>'
    );
};

AirConditionerApi.prototype.deviceState = function(key, callback) {
    if (!this.socket) throw new Error('not logged in');

    if (!!callback) {
        if (!this.stateCallbacks[key]) {
            this.stateCallbacks[key] = [];
        }
        this.stateCallbacks[key].push(callback);

        console.log(this.stateCallbacks);
    }
  
    this._send(
      '<Request Type="DeviceState"><DUID="' + this.mac + '"><Attr ID="' + key + '" /></Request>'
    );
};
  
module.exports = {
    AirConditionerApi: AirConditionerApi,
    ACFun: ACFun,
    OpMode: OpMode
}