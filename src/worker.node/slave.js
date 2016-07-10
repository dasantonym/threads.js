// not using ES6 import/export syntax, since we need to require() in a handler
// what the ES6 syntax does not permit
const vm = require('vm');
//const fs = require('fs');
//const es = require('event-stream');

let errorCatcherInPlace = false;
let messageHandler = function() {
  console.error('No thread logic initialized.');    // eslint-disable-line no-console
};

function setupErrorCatcher() {
  if (errorCatcherInPlace) { return; }

  process.on('uncaughtException', function(error) {
    process.send({
      error : { message : error.message, stack : error.stack }
    });
  });

  errorCatcherInPlace = true;
}


function runAsSandboxedModule(code) {
  var sandbox = {
    Buffer,
    console,
    clearInterval,
    clearTimeout,
    module        : { exports : null },
    require,
    setInterval,
    setTimeout
  };

  vm.runInNewContext(code, sandbox);
  return sandbox.module.exports;
}


function messageHandlerDone(...args) {
  //console.log('slave send!!!!');
  process.send({response: args});
}

messageHandlerDone.transfer = function(...args) {
  //console.log('slave transfer!!!!');
  if (args[-1] instanceof Buffer) {
    //var buffer = args.pop();
    process.send({response: args});
    //pipe.write(buffer);
  } else {
    messageHandlerDone(...args);
  }
};

function messageHandlerProgress(progress) {
  process.send({ progress });
}

//let reader = fs.createReadStream('/dev/fd/4', {encoding: 'utf8'});


/*
let p4 = process.stdio[4].pipe(es.split());
p4.on('data', (data) => {
  console.log('stdio4: ' + data);
});
*/

process.on('message', function(data) {
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

