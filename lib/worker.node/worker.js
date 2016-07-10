'use strict';

exports.__esModule = true;

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { 'default': obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError('Cannot call a class as a function'); } }

function _inherits(subClass, superClass) { if (typeof superClass !== 'function' && superClass !== null) { throw new TypeError('Super expression must either be null or a function, not ' + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var _child_process = require('child_process');

var _child_process2 = _interopRequireDefault(_child_process);

var _path = require('path');

var _path2 = _interopRequireDefault(_path);

var _eventemitter3 = require('eventemitter3');

var _eventemitter32 = _interopRequireDefault(_eventemitter3);

var _eventStream = require('event-stream');

var _eventStream2 = _interopRequireDefault(_eventStream);

var _msgpack = require('msgpack');

var _msgpack2 = _interopRequireDefault(_msgpack);

var _config = require('../config');

var nextChildDebugPort = 45859;

var Worker = (function (_EventEmitter) {
  _inherits(Worker, _EventEmitter);

  /**
   * @param {function|string} initialRunnable   Method or path to file to run.
   * @param {object} [options]                  Options to be passed to child.fork()
   *                                            or an integer/function `debugPort`.
   */

  function Worker(initialRunnable) {
    var _this = this;

    var options = arguments.length <= 1 || arguments[1] === undefined ? {} : arguments[1];

    _classCallCheck(this, Worker);

    _EventEmitter.call(this);

    options.stdio = ['ipc', 'pipe', 'pipe', 'pipe'];

    this.dataResponse = null;
    this.fixDebuggerPort(options, function () {
      _this.slave = _child_process2['default'].spawn(process.argv[0], [_path2['default'].join(__dirname, 'slave.js')], options);
    });
    this.slave.on('message', this.handleMessage.bind(this));
    this.slave.on('error', this.handleError.bind(this));
    this.slave.on('exit', this.emit.bind(this, 'exit'));

    this.so = this.slave.stdout.pipe(_eventStream2['default'].split());
    this.so.on('data', function (data) {
      console.log('PID #' + _this.slave.pid + ': ' + data); // eslint-disable-line no-console
    });
    this.dataPipe = this.slave.stdio[3];
    this.dataPipe.on('data', function (data) {
      _this.dataResponse = _msgpack2['default'].unpack(data);
    });
    if (initialRunnable) {
      this.run(initialRunnable);
    }
  }

  Worker.prototype.run = function run(toRun) {
    if (typeof toRun === 'function') {
      this.runMethod(toRun);
    } else {
      this.runScript(toRun);
    }
    return this;
  };

  Worker.prototype.runMethod = function runMethod(method) {
    this.slave.send({
      initByMethod: true,
      method: method.toString()
    });
  };

  Worker.prototype.runScript = function runScript(script) {
    if (!script) {
      throw new Error('Must pass a function or a script path to run().');
    }

    var prefixedScriptPath = _path2['default'].join(_config.getConfig().basepath.node, script);

    // attention: single script for node, array for browser
    this.slave.send({
      initByScript: true,
      script: _path2['default'].resolve(prefixedScriptPath)
    });
  };

  Worker.prototype.send = function send() {
    for (var _len = arguments.length, args = Array(_len), _key = 0; _key < _len; _key++) {
      args[_key] = arguments[_key];
    }

    if (args.length > 1) {
      var data = args.pop();
      // TODO: support more than just float64
      if (data.constructor && data.constructor.name === 'Float64Array') {
        this.dataPipe.write(new Buffer(data.buffer));
      }
    }
    var param = args[0] || {};
    this.slave.send({
      doRun: true,
      param: param
    });
    return this;
  };

  Worker.prototype.kill = function kill() {
    this.slave.kill();
    return this;
  };

  Worker.prototype.promise = function promise() {
    var _this2 = this;

    return new Promise(function (resolve, reject) {
      _this2.once('message', resolve).once('error', reject);
    });
  };

  /**
   * Need to change debug port. See https://github.com/andywer/threads.js/issues/16.
   */

  Worker.prototype.fixDebuggerPort = function fixDebuggerPort(options, forkCallback) {
    if (typeof v8debug !== 'object') {
      forkCallback();
      return;
    }

    var debugPort = nextChildDebugPort++;

    if (options.debugPort) {
      debugPort = typeof options.debugPort === 'function' ? options.debugPort(debugPort) : options.debugPort;
    }

    // Temporarily change debug port number to something else.
    process.execArgv.push('--debug=' + debugPort);
    forkCallback();
    process.execArgv.pop();
  };

  Worker.prototype.handleMessage = function handleMessage(message) {
    if (message.error) {
      var error = new Error(message.error.message);
      error.stack = message.error.stack;

      this.handleError(error);
    } else if (message.progress) {
      this.handleProgress(message.progress);
    } else {
      this.emit('message', { data: this.dataResponse, args: [].concat(message.response) });
      this.emit('done', { data: this.dataResponse, args: [].concat(message.response) }); // this one is just for convenience
    }
  };

  Worker.prototype.handleProgress = function handleProgress(progress) {
    this.emit('progress', progress);
  };

  Worker.prototype.handleError = function handleError(error) {
    if (!this.listeners('error', true)) {
      console.error(error.stack || error); // eslint-disable-line no-console
    }
    this.emit('error', error);
  };

  return Worker;
})(_eventemitter32['default']);

exports['default'] = Worker;
module.exports = exports['default'];
//# sourceMappingURL=worker.js.map
