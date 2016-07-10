import child        from 'child_process';
import path         from 'path';
import EventEmitter from 'eventemitter3';

import { getConfig } from '../config';


export default class Worker extends EventEmitter {
  constructor(initialRunnable, options = {}) {
    super();

    let es = require('event-stream'),
        msgpack = require('msgpack');
    options.stdio = ['ipc', 'pipe', 'pipe', 'pipe'];

    this.dataResponse = null;

    this.slave = child.spawn(process.argv[0], [path.join(__dirname, 'slave.js')], options);
    this.slave.on('message', this.handleMessage.bind(this));
    this.slave.on('error', this.handleError.bind(this));
    this.slave.on('exit', this.emit.bind(this, 'exit'));

    this.so = this.slave.stdout.pipe(es.split());
    this.so.on('data', (data) => {
      console.log('Child stdout:' + data);
    });
    this.dataPipe = this.slave.stdio[3];
    this.dataPipe.on('data', (data) => {
      console.log(data);
      this.dataResponse = msgpack.unpack(data);
    });
    if (initialRunnable) {
      this.run(initialRunnable);
    }
  }

  run(toRun) {
    if (typeof toRun === 'function') {
      this.runMethod(toRun);
    } else {
      this.runScript(toRun);
    }
    return this;
  }

  runMethod(method) {
    this.slave.send({
      initByMethod : true,
      method       : method.toString()
    });
  }

  runScript(script) {
    if (!script) { throw new Error('Must pass a function or a script path to run().'); }

    const prefixedScriptPath = path.join(getConfig().basepath.node, script);

    // attention: single script for node, array for browser
    this.slave.send({
      initByScript : true,
      script       : path.resolve(prefixedScriptPath)
    });
  }

  send(...args) {
    if (args.length > 1) {
      let data = args.pop();
      if (data.constructor && data.constructor.name === 'Float64Array') {
        this.dataPipe.write(new Buffer(data.buffer));
      }
    }
    let param = args[0] || {};
    this.slave.send({
      doRun : true,
      param
    });
    return this;
  }

  kill() {
    this.slave.kill();
    return this;
  }

  promise() {
    return new Promise((resolve, reject) => {
      this
        .once('message', resolve)
        .once('error', reject);
    });
  }

  handleMessage(message) {
    if (message.error) {
      const error = new Error(message.error.message);
      error.stack = message.error.stack;

      this.handleError(error);
    } else if (message.progress) {
      this.handleProgress(message.progress);
    } else {
      console.log(this.dataResponse);
      this.emit('message', {data: this.dataResponse, args: [...message.response]});
      this.emit('done', {data: this.dataResponse, args: [...message.response]});    // this one is just for convenience
    }
  }

  handleProgress(progress) {
    this.emit('progress', progress);
  }

  handleError(error) {
    if (!this.listeners('error', true)) {
      console.error(error.stack || error);       // eslint-disable-line no-console
    }
    this.emit('error', error);
  }
}
