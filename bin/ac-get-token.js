#!/usr/bin/env node

const tls = require('tls');
const carrier = require('carrier');
const connectionHelper = require('../lib/connection-helper');

const [, , ...args] = process.argv;
const ipAddress = args[0];
const skipCertificate = args[1] == "--skipCertificate";
const options = connectionHelper.createConnectionOptions(ipAddress, skipCertificate, console.log);

function getToken(callback) {
    var token;

    const socket = tls.connect(options, function () {
        carrier.carry(socket, function (line) {
            if (line.match(/Update Type="InvalidateAccount"/)) {
                return socket.write('<Request Type="GetToken" />' + "\r\n");
            }

            if (line.match(/Response Type="GetToken" Status="Ready"/)) {
                console.log('Power on the device within the next 30 seconds');
            }

            if (line.match(/Response Status="Fail" Type="Authenticate" ErrorCode="301"/)) {
                return callback(new Error('Failed authentication'));
            }

            const matches = line.match(/Token="(.*)"/);
            if (matches) {
                token = matches[1];
                return callback(null, token);
            }
        });
    }).on('end', function () {
        if (!token) callback(new Error('Unexpected end of connection'));
    }).on('error', function (err) {
        if (!token) callback(err);
    });
}

getToken(function(error, token) {
    if (!!token) {
        console.log('Device token:', token);
    } else if (!!error) {
        console.log('Error occured:', error.message);
    }

    process.exit();
});