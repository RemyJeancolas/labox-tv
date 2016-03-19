'use strict';

module.exports = function(ipAddress, debug) {
    var laboxTv = require('./lib/LaboxTv')(ipAddress, debug);
    laboxTv.buttons = require('./lib/Constants');
    return laboxTv;
};