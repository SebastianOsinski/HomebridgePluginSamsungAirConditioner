const API = require('./air-conditioner-api');
const State = require('./state');
const OpMode = require('./op-mode');
const Direction = require('./direction');
const WindLevel = require('./wind-level');
const mapper = require('./mapper');

var Service, Characteristic;

module.exports = function (homebridge) {
    Service = homebridge.hap.Service;
    Characteristic = homebridge.hap.Characteristic;

    mapper.setCharacteristic(Characteristic);

    homebridge.registerAccessory("homebridge-plugin-samsung-air-conditioner", "Samsung Air Conditioner", AirConditioner);
};

function AirConditioner(log, config) {
    this.log = log;
    this.name = config["name"];
    this.duid = config["mac"].replace(/:/g, '').replace(/\-/g, '');
    this.api = new API(config["ip_address"], this.duid, config["token"], log, config["log_socket_activity"] === true);

    this.currentDeviceState = {};

    // Set initial state. Done only to not deal with nulls if getters are called before first connection.
    this.currentDeviceState[State.Active] = 'Off';
    this.currentDeviceState[State.TempNow] = 20;
    this.currentDeviceState[State.TempSet] = 16;
    this.currentDeviceState[State.OpMode] = OpMode.Cool;
    this.currentDeviceState[State.Direction] = Direction.Fixed;
    this.currentDeviceState[State.WindLevel] = WindLevel.Auto;
};

AirConditioner.prototype = {
    getServices: function () {
        this.api.connect();

        this.api
            .on('stateUpdate', this.updateState.bind(this));

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

        this.acService
            .getCharacteristic(Characteristic.HeatingThresholdTemperature)
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
            .on('get', this.getCurrentState.bind(this));

        // SWING MODE
        this.acService
            .getCharacteristic(Characteristic.SwingMode)
            .on('get', this.getSwingMode.bind(this))
            .on('set', this.setSwingMode.bind(this));

        // ROTATION SPEED
        this.acService
            .getCharacteristic(Characteristic.RotationSpeed)
            .on('get', this.getRotationSpeed.bind(this))
            .on('set', this.setRotationSpeed.bind(this));
            

        const package = require('../package.json');
        const informationService = new Service.AccessoryInformation();
        informationService
            .setCharacteristic(Characteristic.SerialNumber, this.duid)
            .setCharacteristic(Characteristic.Manufacturer, package.author)
            .setCharacteristic(Characteristic.Model, package.name)
            .setCharacteristic(Characteristic.FirmwareRevision, package.version);

        return [this.acService, informationService];
    },

    // GETTERS
    getActive: function (callback) {
        this.log('Getting active...');

        const power = this.currentDeviceState[State.Power];
        const isActive = power === 'On';

        callback(null, isActive);
    },

    getCurrentTemperature: function (callback) {
        this.log('Getting current temperature...');

        const currentTemperature = this.currentDeviceState[State.TempNow];

        callback(null, currentTemperature);
    },

    getTargetTemperature: function (callback) {
        this.log('Getting target temperature...');

        const targetTemperature = this.currentDeviceState[State.TempSet];

        callback(null, targetTemperature);
    },

    getTargetState: function (callback) {
        this.log('Getting target state...');

        const opMode = this.currentDeviceState[State.OpMode];
        const targetState = mapper.targetStateFromOpMode(opMode);

        callback(null, targetState);
    },

    getCurrentState: function (callback) {
        callback(null, this.currentHeaterCoolerState());
    },

    getSwingMode: function (callback) {
        this.log('Getting swing mode...');

        const direction = this.currentDeviceState[State.Direction];
        const isOscillating = direction === Direction.SwingUpDown

        callback(null, isOscillating);
    },

    getRotationSpeed: function(callback) {
        this.log('Getting rotation speed...');

        const windLevel = this.currentDeviceState[State.WindLevel];
        const rotationSpeed = mapper.rotationSpeedFromWindLevel(windLevel);

        callback(null, rotationSpeed);
    },

    // SETTERS
    setActive: function (isActive, callback) {
        this.log('Setting active:', isActive);

        this.api.deviceControl(State.Power, isActive ? "On" : "Off", function (err) {
            if (!!err) this.log('Active set');
            callback(err);
        }.bind(this));
    },

    setTargetTemperature: function (temperature, callback) {
        this.log('Setting target temperature:', temperature);

        this.api.deviceControl(State.TempSet, temperature, function (err) {
            if (!!err) this.log('Target temperature set');
            callback(err);
        }.bind(this));
    },

    setTargetState: function (state, callback) {
        this.log('Setting target state:', state);

        this.api.deviceControl(State.OpMode, mapper.opModeFromTargetState(state), function (err) {
            if (!!err) this.log('Target state set');
            callback(err);
        }.bind(this));
    },

    setSwingMode: function (enabled, callback) {
        this.log('Setting swing mode:', enabled);

        this.api.deviceControl(State.Direction, enabled ? Direction.SwingUpDown : Direction.Fixed, function (err) {
            if (!!err) this.log('Swing mode set');
            callback(err);
        }.bind(this));
    },

    setRotationSpeed: function(speed, callback) {
        this.log('Setting rotation speed:', speed);

        this.api.deviceControl(State.WindLevel, mapper.windLevelFromRotationSpeed(speed), function(err) {
            if (!!err) this.log('Rotation speed set');
            callback(err);
        }.bind(this));
    },

    currentHeaterCoolerState: function() {
        const currentTemperature = this.currentDeviceState[State.TempNow];
        const targetTemperature = this.currentDeviceState[State.TempSet];
        const opMode = this.currentDeviceState[State.OpMode];

        var state;

        if (opMode === OpMode.Cool) {
            if(currentTemperature > targetTemperature) {
                state = Characteristic.CurrentHeaterCoolerState.COOLING;
            } else {
                state = Characteristic.CurrentHeaterCoolerState.IDLE;
            }
        } else if (opMode === OpMode.Heat) {
            if(currentTemperature < targetTemperature) {
                state = Characteristic.CurrentHeaterCoolerState.HEATING;
            } else {
                state = Characteristic.CurrentHeaterCoolerState.IDLE;
            }
        }

        return state;
    },

    updateState: function (stateUpdate) {
        this.log("State updated:", JSON.stringify(stateUpdate, Object.values(State)));

        // Merge state update into current device state
        this.currentDeviceState = Object.assign({}, this.currentDeviceState, stateUpdate);

        // Update characteristics which correspond to updated states
        Object.keys(stateUpdate).forEach(function(key) {
            this.updateCharacteristic(key, stateUpdate[key]);
        }.bind(this));

        this.updateDerivedCharacteristics();
    },

    updateCharacteristic: function(name, value) {
        var characteristic;
        var mappedValue;

        switch(name) {
        case State.Power:
            characteristic = Characteristic.Active;
            mappedValue = value === "On";
            break;
        case State.TempNow:
            characteristic = Characteristic.CurrentTemperature;
            mappedValue = value;
            break;
        case State.OpMode:
            characteristic = Characteristic.TargetHeaterCoolerState;
            mappedValue = mapper.targetStateFromOpMode(value);
            break;
        case State.Direction:
            characteristic = Characteristic.SwingMode;
            mappedValue = value === Direction.SwingUpDown;
            break;
        case State.WindLevel:
            characteristic = Characteristic.RotationSpeed;
            mappedValue = mapper.rotationSpeedFromWindLevel(value);
            break;
        }

        if(!!characteristic) {
            this.acService.getCharacteristic(characteristic).updateValue(mappedValue);
        }
    },

    updateDerivedCharacteristics: function() {
        const targetTemperature = this.currentDeviceState[State.TempSet];

        this.acService.getCharacteristic(Characteristic.CurrentHeaterCoolerState).updateValue(this.currentHeaterCoolerState());
        this.acService.getCharacteristic(Characteristic.HeatingThresholdTemperature).updateValue(targetTemperature);
        this.acService.getCharacteristic(Characteristic.CoolingThresholdTemperature).updateValue(targetTemperature);
    },
};