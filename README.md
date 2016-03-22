[![Latest Stable Version](http://img.shields.io/npm/v/labox-tv.svg)](https://www.npmjs.com/package/labox-tv) ![Downloads](https://img.shields.io/npm/dt/labox-tv.svg) ![License](https://img.shields.io/npm/l/labox-tv.svg)

# Labox TV
Control and get informations from Labox TV (Numericable)

## Installation
Via [npm](https://www.npmjs.com) :
```bash
npm install labox-tv
```

## Usage
### Initialization
Replace `*.*.*.*` with IP adress of labox tv in the line below, if you don't know which ip address to use, you can try *websocket.labox* instead of IP address.
```js
var labox = require('labox-tv')('*.*.*.*'); 
```

If you have problems or nothing seems to work, you can start the module in debug mode by adding `true` in the second parameter, in this mode every action or error will be logged to console.
```js
var labox = require('labox-tv')('*.*.*.*', true); 
```

### Events

#### Events list
The module exposes several events in order to have information available in real time : 

* **open** : Triggered when the module successfully connects to Labox, empty data
* **close** : Triggered when the connection to Labox is lost, empty data
* **power** : Triggered when power status changes, returns `bool` representing current power status
* **volume** : Triggered when volume is changed, returns `int` representing current volume
* **mute** : Triggered when sound mute status changes, returns `bool` representing current mute status
* **program** : Triggered when current program changes, returns an `object` with the following structure:
```js
  { "name": string, "category": string }
  ```
* **channel** : Triggered when current channel changes, returns an `object` with the following structure:
```js
  { "name": string, "number": int, "category": string }
  ```
* **update** : Triggered if any of the above events occurs, returns a full object containing all information with the following structure :
```js
  {
    "power": bool,
    "volume": int,
    "mute": bool,
    "channel": {
      "name": string,
      "number": int,
      "category": string
    },
    "program": {
      "name": string,
      "category": string
    }
  }
  ```
 
#### Example
```js
// We load the module
var labox = require('labox-tv')('*.*.*.*'); 

// We listen for "volume" events :
labox.on('volume', function(data) {
  // For volume event, data is an integer
  console.log(data);
});
```

### Methods
There are currently two methods available : *getInfo* and *sendButtonEvent* :

#### getInfo()
This method returns a full object containing all information about Labox. The object structure is identical as the object returned by the *update* event.

#### sendButtonEvent(int buttonCode)
This method takes the button's ID to send. For example to increase volume :

```js
// We load the module
var labox = require('labox-tv')('*.*.*.*'); 

// We wait for connection to be open and increase volume
labox.on('open', function() {
  labox.sendButtonEvent(labox.buttons.BUTTON_VOLUME_PLUS_KEY_CODE);
});
```

This method does not return data, once the action button will be taken into account by Labox, you will receive a corresponding event.
All available supported button IDs can be found in the file [Constants.js](https://github.com/RemyJeancolas/labox-tv/blob/master/lib/Constants.js).
