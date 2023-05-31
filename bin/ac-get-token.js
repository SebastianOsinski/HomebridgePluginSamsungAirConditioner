#!/usr/bin/env node

const tls = require('tls');
const carrier = require('carrier');
const fs = require('fs');
const path = require('path');

const [, , ...args] = process.argv;
const ipAddress = args[0];

console.log('IP: ', ipAddress);

function getToken(callback) {
    var token;

    const pfxPath = path.join(__dirname, '../res/cert.pfx')

    const options = { 
        pfx: fs.readFileSync(pfxPath), 
        port: 2878, 
        host: ipAddress, 
        rejectUnauthorized: false,
        secureProtocol: 'TLSv1_method',
        ciphers: 'DEFAULT:@SECLEVEL=0'
    }

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