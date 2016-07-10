// not using ES6 import/export syntax, since we need to require() in a handler
// what the ES6 syntax does not permit
'use strict';

var vm = require('vm');
//const fs = require('fs');
//const es = require('event-stream');

var errorCatcherInPlace = false;
var messageHandler = function messageHandler() {
  console.error('No thread logic initialized.'); // eslint-disable-line no-console
};

function setupErrorCatcher() {
  if (errorCatcherInPlace) {
    return;
  }

  process.on('uncaughtException', function (error) {
    process.send({
      error: { message: error.message, stack: error.stack }
    });
  });

  errorCatcherInPlace = true;
}

function runAsSandboxedModule(code) {
  var sandbox = {
    Buffer: Buffer,
    console: console,
    clearInterval: clearInterval,
    clearTimeout: clearTimeout,
    module: { exports: null },
    require: require,
    setInterval: setInterval,
    setTimeout: setTimeout
  };

  vm.runInNewContext(code, sandbox);
  return sandbox.module.exports;
}

function messageHandlerDone() {
  for (var _len = arguments.length, args = Array(_len), _key = 0; _key < _len; _key++) {
    args[_key] = arguments[_key];
  }

  //console.log('slave send!!!!');
  process.send({ response: args });
}

messageHandlerDone.transfer = function () {
  for (var _len2 = arguments.length, args = Array(_len2), _key2 = 0; _key2 < _len2; _key2++) {
    args[_key2] = arguments[_key2];
  }

  //console.log('slave transfer!!!!');
  if (args[-1] instanceof Buffer) {
    //var buffer = args.pop();
    process.send({ response: args });
    //pipe.write(buffer);
  } else {
      messageHandlerDone.apply(undefined, args);
    }
};

function messageHandlerProgress(progress) {
  process.send({ progress: progress });
}

//let reader = fs.createReadStream('/dev/fd/4', {encoding: 'utf8'});

/*
let p4 = process.stdio[4].pipe(es.split());
p4.on('data', (data) => {
  console.log('stdio4: ' + data);
});
*/

process.on('message', function (data) {
  if (data.initByScript) {
    messageHandler = require(data.script);
  }

  if (data.initByMethod) {
    messageHandler = runAsSandboxedModule('module.exports = ' + data.method);
  }

  if (data.doRun) {
    // it's a good idea to wait until first thread logic run to set this up,
    // so initialization errors will be printed to console
    setupErrorCatcher();

    messageHandler(data.param, messageHandlerDone, messageHandlerProgress);
  }
});
//# sourceMappingURL=slave.js.map
