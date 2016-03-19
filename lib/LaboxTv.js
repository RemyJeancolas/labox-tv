'use strict';

// Required modules
var fs = require('fs');
var WebSocket = require('ws');
var EventEmitter = require('events').EventEmitter;
var moment = require('moment');
var path = require('path');

// Config vars
var restartTimeout = 10000;
var commandWsPort = 7682;
var notificationWsPort = 7684;
var wsProtocols = ["lws-bidirectional-protocol"];
var wsOptions = {
    rejectUnauthorized: false,
    cert: fs.readFileSync(path.resolve(__dirname, 'ca_certificat.pem')),
    pfx: fs.readFileSync(path.resolve(__dirname, 'keystore.p12')),
    passphrase: 'carla2012Nc'
};

// Application vars
var debugMode = false;
var ipAddress = null;
var notificationWs = null;
var commandWs = null;
var playerInfo = { "power": false, "volume": 0, "mute": false, "channel": { "name": null, "number": 0, "category": null }, "program": { "name": null, "category": null} };

var labox = new EventEmitter();

labox.sendButtonEvent = function(buttonCode) {
    sendCommandToLabox('{"Params":{"Action":"ButtonEvent","Token":"LAN","DeviceId":"123456","DeviceModel":"Model","DeviceSoftVersion":"1.0","Press":[' + buttonCode + ']}}');
};

labox.getInfo = function() {
    return playerInfo;
};

function sendCommandToLabox(command) {
    if (commandWs && commandWs.readyState === WebSocket.OPEN) {
        commandWs.send(command);
    }
}

function getLaboxStatus() {
    sendCommandToLabox('{"Params":{"Action":"GetSessionsStatus","Token":"LAN","StbToken":"123456","DeviceId":"123456","DeviceModel":"Model","DeviceSoftVersion":"1.0"}}');
}

function getLaboxVolume() {
    sendCommandToLabox('{"Params":{"Action":"GetVolume","Token":"LAN","DeviceId":"123456","DeviceModel":"Model","DeviceSoftVersion":"1.0"}}');
}

function log(message) {
    if (debugMode === true) {
        console.log('[' + moment().format('DD/MM/YYYY HH:mm:ss') + '] ' + message);
    }
}

function startWs(ipAddress, port, callback) {
    try {
        var ws = new WebSocket('wss://' + ipAddress + ':' + port, wsProtocols, wsOptions);
        ws.on('ping', function() {
            if (ws && ws.readyState === WebSocket.OPEN) {
                ws.pong();
            }
        });
        ws.on('close', function() {
            if (port === commandWsPort) {
                labox.emit('close');
            }
            log('WS on port ' + port + ' closed, restarting');
            startWs(ipAddress, port, callback);
        });
        ws.on('error', function(err) {
            if (port === commandWsPort) {
                labox.emit('close');
            }
            log('WS on port ' + port + ' got an error: "' + err +'", restarting');
            startWs(ipAddress, port, callback);
        });
        ws.on('open', function() {
            log('WS opened on port ' + port);
            if (port === commandWsPort) {
                labox.emit('open');
                // Get TV status
                getLaboxStatus();
                // Get TV volume
                getLaboxVolume();
            }
        });

        ws.on('message', function(data) {
            log('Message received on port ' + port + ': ' + data);
            var localPlayerInfos = getPlayerInfoFromMessage(port, data);
            sendUpdateNotifications(localPlayerInfos);
            playerInfo = localPlayerInfos;
        });
        callback(ws);
    } catch (e) {
        log('Error while starting WS on port ' + port + ': ' + e.message);
        setTimeout(function() { startWs(ipAddress, port, callback); }, restartTimeout);
    }
}

function getPlayerInfoFromMessage(port, message) {
    try {
        var localPlayerInfo = JSON.parse(JSON.stringify(playerInfo));
        var jsonMessage = JSON.parse(message);
        if (port === commandWsPort) {
            if (jsonMessage.hasOwnProperty('Action')) {
                var action = jsonMessage.Action;
                if (jsonMessage.hasOwnProperty('Data')) {
                    var data = jsonMessage.Data;
                    switch(action) {
                        case 'GetSessionsStatus':
                            if (data.hasOwnProperty('CurrentApplication')) {
                                localPlayerInfo.power = (data.CurrentApplication !== 'En Veille');
                            }
                            if (data.hasOwnProperty('LiveSession') && data.LiveSession.hasOwnProperty('LiveItem')) {
                                if (data.LiveSession.LiveItem.hasOwnProperty('CurrentChannel')) {
                                    localPlayerInfo.channel.name = ((data.LiveSession.LiveItem.CurrentChannel.hasOwnProperty('Name'))
                                        ? data.LiveSession.LiveItem.CurrentChannel.Name : null);
                                    localPlayerInfo.channel.number = ((data.LiveSession.LiveItem.CurrentChannel.hasOwnProperty('Id'))
                                        ? parseInt(data.LiveSession.LiveItem.CurrentChannel.Id) : 0);
                                    localPlayerInfo.channel.category = ((data.LiveSession.LiveItem.CurrentChannel.hasOwnProperty('Category'))
                                        ? data.LiveSession.LiveItem.CurrentChannel.Category : null);
                                } else {
                                    localPlayerInfo.channel = { "name": null, "number": 0, "category": null };
                                }

                                if (data.LiveSession.LiveItem.hasOwnProperty('CurrentProgram')) {
                                    localPlayerInfo.program.name = ((data.LiveSession.LiveItem.CurrentProgram.hasOwnProperty('Name'))
                                        ? data.LiveSession.LiveItem.CurrentProgram.Name : null);
                                    localPlayerInfo.program.category = ((data.LiveSession.LiveItem.CurrentProgram.hasOwnProperty('Category'))
                                        ? data.LiveSession.LiveItem.CurrentProgram.Category : null);
                                } else {
                                    localPlayerInfo.program = { "name": null, "category": null};
                                }
                            } else {
                                localPlayerInfo.channel = { "name": null, "number": 0, "category": null };
                                localPlayerInfo.program = { "name": null, "category": null};
                            }
                            break;

                        case 'GetVolume':
                            if (data.hasOwnProperty('CurrentLevel')) {
                                localPlayerInfo.volume = parseInt(data.CurrentLevel);
                            }
                            if (data.hasOwnProperty('IsMute')) {
                                localPlayerInfo.mute = data.IsMute;
                            }
                            break;

                        case 'ButtonEvent': break;
                        default:
                            log('No treatment for WS command message with action "' + action + '": ' + message);
                            break;
                    }
                } else {
                    log('Message from command WS with no data:' + message);
                }
            } else {
                log('Message from command WS with no action:' + message);
            }
        } else {
            if (jsonMessage.hasOwnProperty('Notification')) {
                var action = jsonMessage.Notification;
                if (jsonMessage.hasOwnProperty('Params')) {
                    var data = jsonMessage.Params;
                    switch(action) {
                        case 'VolumeChanged':
                            if (data.hasOwnProperty('Level')) {
                                localPlayerInfo.volume = parseInt(data.Level);
                                localPlayerInfo.mute = false;
                            }
                            break;

                        case 'Mute':
                            if (data.hasOwnProperty('State')) {
                                localPlayerInfo.mute = data.State;
                            }
                            break;

                        default:
                            log('No treatment for WS notification message with action "' + action + '": ' + message);
                            break;
                    }
                } else {
                    if (action === 'StatusUpdate') {
                        getLaboxStatus();
                    } else {
                        log('Message from notification WS with no data:' + message);
                    }
                }
            }
        }

        return localPlayerInfo;
    } catch (e) {
        log('Error while getting player info from message: ' + e.message);
    }
}

function sendUpdateNotifications(localPLayerInfos) {
    var update = false;
    if (localPLayerInfos.power !== playerInfo.power) {
        update = true;
        labox.emit('power', localPLayerInfos.power);
    }
    if (localPLayerInfos.volume !== playerInfo.volume) {
        update = true;
        labox.emit('volume', localPLayerInfos.volume);
    }
    if (localPLayerInfos.mute !== playerInfo.mute) {
        update = true;
        labox.emit('mute', localPLayerInfos.mute);
    }
    if (localPLayerInfos.channel.name !== playerInfo.channel.name || localPLayerInfos.channel.number !== playerInfo.channel.number || localPLayerInfos.channel.category !== playerInfo.channel.category) {
        update = true;
        labox.emit('channel', localPLayerInfos.channel);
    }
    if (localPLayerInfos.program.name !== playerInfo.program.name || localPLayerInfos.program.category !== playerInfo.program.category) {
        update = true;
        labox.emit('program', localPLayerInfos.program);
    }
    if (update === true) {
        labox.emit('update', localPLayerInfos);
    }
}

setInterval(function() {
    if (commandWs && commandWs.readyState === WebSocket.OPEN) {
        log('WS on port ' + commandWsPort + ': sending ping');
        commandWs.ping();
    }
    if (notificationWs && notificationWs.readyState === WebSocket.OPEN) {
        log('WS on port ' + notificationWsPort + ': sending ping');
        notificationWs.ping();
    }
}, 60000);

module.exports = function(ip, debug) {
    ipAddress = ip;
    if (typeof debug === 'boolean') {
        debugMode = debug;
    }
    startWs(ip, commandWsPort, function(ws) { commandWs = ws; });
    startWs(ip, notificationWsPort, function(ws) { notificationWs = ws; });

    return labox;
};