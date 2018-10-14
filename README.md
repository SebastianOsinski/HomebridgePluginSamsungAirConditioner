# Homebridge-plugin-samsung-air-conditioner

[![npm version](https://badge.fury.io/js/homebridge-plugin-samsung-air-conditioner.svg)](https://badge.fury.io/js/homebridge-plugin-samsung-air-conditioner)

Homebridge plugin for controlling Samsung Air Conditioner working on port 2878. Allows to control AC with HomeKit and Siri.
If you have Samsung AC which operates on port 8888, check this plugin instead: https://github.com/cicciovo/homebridge-samsung-airconditioner

## Installation
1. Install [Homebridge](https://github.com/nfarina/homebridge).
2. Install this plugin by running `npm install -g homebridge-plugin-samsung-air-conditioner`.
3. Assign static IP address to your AC (check your router settings to do that).
4. Run `homebridge-samsung-ac-get-token <your ac's ip address>` in terminal and follow instructions.
5. Update your Homebridge `config.json`. Check `config-sample.json` for reference. Custom required parameters:
    
    - `ip_address` - IP address of air conditioner
    - `mac` - MAC address of air conditioner in format `AA:BB:CC:DD:EE:FF` or `AA-BB-CC-DD-EE-FF`
    - `token` - token returned by `homebridge-samsung-ac-get-token <your ac's ip address>`

## Features
- Turning AC on and off
- Getting and setting target temperature
- Getting current temperature
- Getting and setting mode
- Getting and setting swing mode
- Reacting to changes made by using AC's remote

## TODO
- Improve updating current state - if AC is currently cooling or heating or in idle
- Add caching for device state - should speed up reading characteristics
- Better error handling
- Reconnecting after socket connection ends

## Confirmed compatibility list (model numbers)
- AR18HSFSAWKNEU
- AR24FSSSBWKN

If your device's number is not on the list but you have tested it and it works, please make a PR with your device's number.

## Acknowledgment
This project is heavily based on awesome work of CloCkWeRX - https://github.com/CloCkWeRX/node-samsung-airconditioner
