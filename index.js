const api = require('./air-conditioner-api');
const AirConditionerApi = api.AirConditionerApi;
const ACFun = api.ACFun;
const OpMode = api.OpMode;
const Direction = api.Direction;
const WindLevel = api.WindLevel;

var Service, Characteristic;

module.exports = function (homebridge) {
    Service = homebridge.hap.Service;
    Characteristic = homebridge.hap.Characteristic;
    homebridge.registerAccessory("homebridge-plugin-samsung-air-conditioner", "Samsung Air Conditioner", AirConditioner);
};

function AirConditioner(log, config) {
    this.log = log;
    this.name = config["name"];
    this.duid = config["mac"].replace(/:/g, '').replace(/\-/g, '');
    this.api = new AirConditionerApi(config["ip_address"], this.duid, config["token"], log);

    this.currentDeviceState = {};
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
            
        const informationService = new Service.AccessoryInformation();
        informationService
            .setCharacteristic(Characteristic.Manufacturer, "Samsung")
            .setCharacteristic(Characteristic.SerialNumber, this.duid);

        return [this.acService, informationService];
    },

    // GETTERS
    getActive: function (callback) {
        this.log('Getting active...');

        const power = this.currentDeviceState[ACFun.Power];
        const isActive = power === 'On';

        callback(null, isActive);
    },

    getCurrentTemperature: function (callback) {
        this.log('Getting current temperature...');

        const currentTemperature = this.currentDeviceState[ACFun.TempNow];

        callback(null, currentTemperature);
    },

    getTargetTemperature: function (callback) {
        this.log('Getting target temperature...');

        const targetTemperature = this.currentDeviceState[ACFun.TempSet];

        callback(null, targetTemperature);
    },

    getTargetState: function (callback) {
        this.log('Getting target state...');

        const opMode = this.currentDeviceState[ACFun.OpMode];
        const targetState = targetStateFromOpMode(opMode);

        callback(null, targetState);
    },

    getCurrentState: function (callback) {
        callback(null, this.currentHeaterCoolerState());
    },

    getSwingMode: function (callback) {
        this.log('Getting swing mode...');

        const direction = this.currentDeviceState[ACFun.Direction];
        const isOscillating = direction === Direction.SwingUpDown

        callback(null, isOscillating);
    },

    getRotationSpeed: function(callback) {
        this.log('Getting rotation speed...');

        const windLevel = this.currentDeviceState[ACFun.WindLevel];
        const rotationSpeed = rotationSpeedFromWindLevel(windLevel);

        callback(null, rotationSpeed);
    },

    // SETTERS
    setActive: function (isActive, callback) {
        this.log('Setting active: ' + isActive);

        this.api.deviceControl(ACFun.Power, isActive ? "On" : "Off", function (err) {
            this.log('Active set')
            callback();
        }.bind(this));
    },

    setTargetTemperature: function (temperature, callback) {
        this.log('Setting target temperature: ' + temperature);

        this.api.deviceControl(ACFun.TempSet, temperature, function (err) {
            this.log('Target temperature set')
            callback(err);
        }.bind(this));
    },

    setTargetState: function (state, callback) {
        this.log('Setting target state: ' + state);

        this.api.deviceControl(ACFun.OpMode, opModeFromTargetState(state), function (err) {
            this.log('Target state set')
            callback(err);
        }.bind(this));
    },

    setSwingMode: function (enabled, callback) {
        this.log('Setting swing mode...');

        this.api.deviceControl(ACFun.Direction, enabled ? Direction.SwingUpDown : Direction.Fixed, function (err) {
            this.log('Swing mode set');
            callback(err);
        }.bind(this));
    },

    setRotationSpeed: function(speed, callback) {
        this.log('Setting rotation speed');

        this.api.deviceControl(ACFun.WindLevel, windLevelFromRotationSpeed(speed), function(err) {
            this.log('Rotation speed');
            callback(err);
        }.bind(this));
    },

    currentHeaterCoolerState: function() {
        const currentTemperature = this.currentDeviceState[ACFun.TempNow];
        const targetTemperature = this.currentDeviceState[ACFun.TempSet];
        const opMode = this.currentDeviceState[ACFun.OpMode];

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
        this.currentDeviceState = Object.assign({}, this.currentDeviceState, stateUpdate);

        this.log(stateUpdate);

        Object.keys(stateUpdate).forEach(function(key) {
            this.updateCharacteristic(key, stateUpdate[key]);
        }.bind(this));

        this.updateDerivedCharacteristics();
    },

    updateCharacteristic: function(name, value) {
        var characteristic;
        var mappedValue = null;

        switch(name) {
        case ACFun.Power:
            characteristic = Characteristic.Active;
            mappedValue = value === "On";
            break;
        case ACFun.TempNow:
            characteristic = Characteristic.CurrentTemperature;
            break;
        case ACFun.OpMode:
            characteristic = Characteristic.TargetHeaterCoolerState;
            mappedValue = targetStateFromOpMode(value);
            break;
        case ACFun.Direction:
            characteristic = Characteristic.SwingMode;
            mappedValue = value === Direction.SwingUpDown;
            break;
        case ACFun.WindLevel:
            characteristic = Characteristic.RotationSpeed;
            mappedValue = rotationSpeedFromWindLevel(value);
        }

        if(!!characteristic) {
            this.acService.getCharacteristic(characteristic).updateValue(mappedValue !== null ? mappedValue : value);
        }
    },

    updateDerivedCharacteristics: function() {
        const targetTemperature = this.currentDeviceState[ACFun.TempSet];

        this.acService.getCharacteristic(Characteristic.CurrentHeaterCoolerState).updateValue(this.currentHeaterCoolerState());
        this.acService.getCharacteristic(Characteristic.HeatingThresholdTemperature).updateValue(targetTemperature);
        this.acService.getCharacteristic(Characteristic.CoolingThresholdTemperature).updateValue(targetTemperature);
    },
};

opModeFromTargetState = function (targetState) {
    switch (targetState) {
        case Characteristic.TargetHeaterCoolerState.COOL: return OpMode.Cool;
        case Characteristic.TargetHeaterCoolerState.HEAT: return OpMode.Heat;
        case Characteristic.TargetHeaterCoolerState.AUTO: return OpMode.Auto;
    }
};

targetStateFromOpMode = function (targetState) {
    switch (targetState) {
        case OpMode.Cool: return Characteristic.TargetHeaterCoolerState.COOL;
        case OpMode.Heat: return Characteristic.TargetHeaterCoolerState.HEAT;
        case OpMode.Auto: return Characteristic.TargetHeaterCoolerState.AUTO;
    }
};

rotationSpeedFromWindLevel = function (windLevel) {
    switch (windLevel) {
        case WindLevel.Auto: return 0;
        case WindLevel.Low: return 25;
        case WindLevel.Mid: return 50;
        case WindLevel.High: return 75;
        case WindLevel.Turbo: return 100;
    }
};

windLevelFromRotationSpeed = function (rotationSpeed) {
    if (rotationSpeed == 0) {
        return WindLevel.Auto;
    } else if (rotationSpeed <= 25) {
        return WindLevel.Low;
    } else if (rotationSpeed <= 50) {
        return WindLevel.Mid;
    } else if (rotationSpeed <= 75) {
        return WindLevel.High;
    } else {
        return WindLevel.Turbo;
    }
}