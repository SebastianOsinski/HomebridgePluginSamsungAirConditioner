var AirConditionerApi = require('./air-conditioner-api').AirConditionerApi;
var ACFun = require('./air-conditioner-api').ACFun

var Service, Characteristic;

module.exports = function(homebridge) {
    Service = homebridge.hap.Service;
    Characteristic = homebridge.hap.Characteristic;
    homebridge.registerAccessory("homebridge-samsung-air-conditioner", "Samsung AirConditioner", AirConditioner);
};

function AirConditioner(log, config) {
    this.log = log;
    this.name = config["name"];
    this.api = new AirConditionerApi(config["ip_address"], config["mac"], config["token"], log);

    this._targetTemperature = 15;
    this._targetState = Characteristic.TargetHeaterCoolerState.COOL; // or HEAT or AUTO
}

AirConditioner.prototype = {

    getServices: function() {
        this.log('Connecting...');

        this.api
            .on('error', this.log)
            .on('authSuccess', function() { this.log("Connected") }.bind(this))
            .on('statusChange', this.statusChanged.bind(this));

        this.api.connect();

        this.acService = new Service.HeaterCooler(this.name);

        // ACTIVE STATE
        this.acService
            .getCharacteristic(Characteristic.Active)
            .on('get', this.getActive.bind(this))
            .on('set', this.setActive.bind(this));

        // CURRENT TEMPERATURE
        this.acService
            .getCharacteristic(Characteristic.CurrentTemperature)
            .setProps({
                minValue: 0,
                maxValue: 100,
                minStep: 1
            })
            .on('get', this.getCurrentTemperature.bind(this));

        // TARGET TEMPERATURE
        this.acService
            .getCharacteristic(Characteristic.CoolingThresholdTemperature)
            .setProps({
                minValue: 16,
                maxValue: 30,
                minStep: 1
            })
            .on('get', this.getTargetTemperature.bind(this))
            .on('set', this.setTargetTemperature.bind(this));

        // TARGET STATE
        this.acService
            .getCharacteristic(Characteristic.TargetHeaterCoolerState)
            .on('get', this.getTargetState.bind(this))
            .on('set', this.setTargetState.bind(this));

        // CURRENT STATE
        this.acService
            .getCharacteristic(Characteristic.CurrentHeaterCoolerState)
            .on('get', this.getCurrentState.bind(this))

        return [this.acService];
    },

    // ACTIVE STATE
    getActive: function(callback) {
        this.log('Getting active...');

        this.api.deviceState(ACFun.Power, function(err, power) {
            var isActive = power === 'On';
            this.log('Is active: ' + isActive);
            callback(null, isActive);
        }.bind(this));
    },

    setActive: function(isActive, callback) {
        this.log('Setting active: ' + isActive);

        this.api.deviceControl(ACFun.Power, isActive ? "On" : "Off", function(err, line) {
            this.log('Active set')
            callback();
        }.bind(this));
    },

    // CURRENT TEMPERATURE
    getCurrentTemperature: function(callback) {
        this.log('Getting current temperature...');
        
        this.api.deviceState(ACFun.TempNow, function(err, currentTemperature) {
            this.log('Current temperature: ' + currentTemperature);
            callback(null, currentTemperature);
        }.bind(this));
    },

    // TARGET TEMPERATURE
    getTargetTemperature: function(callback) {
        this.log('GET TARGET TEMPERATURE: ' + this._targetTemperature);
        callback(null, this._targetTemperature);
    },

    setTargetTemperature: function(temperature, callback) {
        this.log('SET TARGET TEMPERATURE: ' + temperature);
        this._targetTemperature = temperature;

        callback();
    },

    // TARGET STATE
    getTargetState: function(callback) {
        this.log('GET TARGET STATE: ' + this._targetState);
        callback(null, this._targetState);
    },

    setTargetState: function(state, callback) {
        this.log('SET TARGET STATE: ' + state);
        this._targetState = state
        callback(); // or HEAT or AUTO
    },

    // CURRENT STATE
    getCurrentState: function(callback) {
        this.log('GET CURRENT STATE');
        callback(null, Characteristic.CurrentHeaterCoolerState.COOLING);
    },

    // STATUS CHANGE
    statusChanged: function(status) {
        this.log('Status change: ', status);

        var characteristic;
        switch(status.name) {
        case ACFun.Power:
            characteristic = Characteristic.Active;
            break;
        case ACFun.TempSet:
            characteristic = Characteristic.CoolingThresholdTemperature;
            break;
        case ACFun.TempNow:
            characteristic = Characteristic.CurrentTemperature;
            break;
        }

        if(!!characteristic) {
            this.acService.getCharacteristic(characteristic).updateValue(status.value)
        }
    }
};