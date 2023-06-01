const fs = require('fs');
const path = require('path');

module.exports.createConnectionOptions = function(ipAddress, skipCertificate, log) {
    const pfxPath = path.join(__dirname, '../res/cert.pfx')

    const options = { 
        pfx: skipCertificate ? null : fs.readFileSync(pfxPath),
        port: 2878, 
        host: ipAddress, 
        rejectUnauthorized: false,
        secureProtocol: 'TLSv1_method',
        ciphers: skipCertificate ? 'HIGH:!DH:!aNULL' : 'ALL:@SECLEVEL=0'
    };

    log('Connection configuration:\n', options, '\n');

    return options;
}