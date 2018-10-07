# Homebridge-plugin-samsung-air-conditioner

Homebridge plugin for controlling Samsung Air Conditioner working on port 2878. Allows to control AC with HomeKit and Siri.
If you have Samsung AC which operates on port 8888, check this plugin instead: https://github.com/cicciovo/homebridge-samsung-airconditioner

## Installation
1. Install [Homebridge](https://github.com/nfarina/homebridge)
2. Install this plugin by running `npm install -g homebridge-plugin-samsung-air-conditioner`
3. Assign static IP address to your AC (check your router settings to do that)
4. Run `samsung-ac-get-token <your ac's ip address>` and follow directions in terminal
5. Update your Homebridge `config.json`. Check `config-sample.json` for reference. Custom required parameters:
    
    - `ip_address` - IP address of air conditioner
    - `mac` - MAC address of air conditioner in format `AA:BB:CC:DD:EE:FF` or `AA-BB-CC-DD-EE-FF`
    - `token` - token returned by `samsung-ac-get-token <your ac's ip address>`

## Features
- Turning AC on and off
- Getting and setting target temperature
- Getting current temperature
- Getting and setting mode
- Getting and setting swing mode
- Reacting to changes made by using AC's remote

## TODO
- Improve updating current state - if AC is currently cooling or heating or in idle
- Better error handling
- Reconnecting after socket connection ends

## Attribution
This project is heavily based on awesome work of CloCkWeRX - https://github.com/CloCkWeRX/node-samsung-airconditioner