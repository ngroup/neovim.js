var Client, Q, connect, construct_method, events, rpc, vimBuffer, vimTabpage, vimWindow;

events = require('events');

Q = require('when');

rpc = require('neo-msgpack-rpc');

vimBuffer = require('./buffer.js');

vimWindow = require('./window.js');

vimTabpage = require('./tabpage.js');

construct_method = function(name, id, params) {
  var args, args_string, class_name, func, func_client, method_name, name_reolved, p, _i, _len;
  args = [];
  args_string = '';
  for (_i = 0, _len = params.length; _i < _len; _i++) {
    p = params[_i];
    args.push(p[1]);
    args_string += ',' + p[1];
  }
  func_client = 'var args = Array.prototype.slice.call(arguments);' + 'args.unshift(' + id.toString() + ');' + 'return this.send_method.apply(this, args);';
  func = 'var args = Array.prototype.slice.call(arguments);' + 'args.unshift(this.index);' + 'args.unshift(' + id.toString() + ');' + 'return this.client.send_method.apply(this.client, args);';
  name_reolved = name.split('_');
  class_name = name_reolved.shift();
  method_name = name_reolved.join('_');
  if (class_name === 'vim') {
    Client.prototype[method_name] = new Function(func_client);
  } else if (class_name === 'buffer') {
    vimBuffer.VimBuffer.prototype[method_name] = new Function(func);
  } else if (class_name === 'window') {
    vimWindow.VimWindow.prototype[method_name] = new Function(func);
  } else if (class_name === 'tabpage') {
    vimTabpage.VimTabpage.prototype[method_name] = new Function(func);
  }
};


/**
 * Initialize a new `Client` with the given `address`.
 * @class Represent a Neovim client
 * @param {string} address - The address of Neovim
 */

Client = function(address) {
  this.pending_message = [];
  this.apiResolved = false;
  this.neovim_method_dict = {};
  this.client = rpc.createClient(address, function() {});
};

Client.prototype.listenRPCStatus = function() {
  var rpcStatus, self;
  rpcStatus = new events.EventEmitter();
  self = this;
  rpcStatus.on('free', function() {
    if (self.pending_message.length !== 0) {
      self.push_queue();
    }
  });
  rpcStatus.on('addNewMessage', function() {
    if (self.pending_message.length === 1 && self.apiResolved) {
      self.rpcStatus.emit('free');
    }
  });
  return rpcStatus;
};

Client.prototype.send_method = function() {
  var args, cb, deferred, i, method_id;
  deferred = Q.defer();
  method_id = arguments[0];
  i = 1;
  args = [];
  cb = arguments[arguments.length - 1];
  if (typeof cb === 'function') {
    while (i < arguments.length - 1) {
      args.push(arguments[i]);
      i++;
    }
  } else {
    while (i < arguments.length) {
      args.push(arguments[i]);
      i++;
    }
  }
  this.pending_message.push([method_id, args, deferred]);
  this.rpcStatus.emit('addNewMessage');
  return deferred.promise;
};

Client.prototype.push_queue = function() {
  var args, callback, deferred, method_id, self;
  self = this;
  method_id = this.pending_message[0][0];
  deferred = this.pending_message[0][2];
  callback = function(err, response) {
    self.pending_message.splice(0, 1);
    self.rpcStatus.emit('free');
    if (err) {
      return deferred.reject(new Error(err));
    } else {
      return deferred.resolve(response);
    }
  };
  args = this.pending_message[0][1];
  args.unshift(method_id);
  args.push(callback);
  this.client.invoke.apply(this.client, args);
};

Client.prototype.discover_api = function() {
  var deferred, self;
  deferred = Q.defer();
  self = this;
  this.client.on('ready', function() {
    self.client.invoke(0, [], function(err, response) {
      var api, method, _i, _len, _ref;
      if (!err) {
        self.channel_id = response[0];
        api = response[1];
        _ref = api['functions'];
        for (_i = 0, _len = _ref.length; _i < _len; _i++) {
          method = _ref[_i];
          construct_method(method.name, method.id, method.parameters);
        }
        self.apiResolved = true;
        self.rpcStatus.emit('free');
        return deferred.resolve(response);
      } else {
        return deferred.reject(err);
      }
    });
  });
  return deferred.promise;
};


/**
 * Get all current buffers
 * @example
 * client.buffers().then(function (buffers) {
 *   buffers[0].someVimBufferMethod();
 *   ...
 * });
 * @returns {Promise.<{VimBuffer[]}|Error>}
 */

Client.prototype.buffers = function() {
  var deferred, self;
  deferred = Q.defer();
  self = this;
  this.get_buffers().then(function(buf_idx_list) {
    var buf_list;
    buf_list = buf_idx_list.map(function(buf_idx) {
      return new vimBuffer.VimBuffer(buf_idx, self);
    });
    return deferred.resolve(buf_list);
  });
  return deferred.promise;
};


/**
 * Get current buffer
 * @example
 * client.get_current_buffer().then(function (buffer) {
 *   buffer.someVimBufferMethod();
 *   ...
 * });
 * @returns {Promise.<{VimBuffer}|Error>}
 */

Client.prototype.get_current_buffer = function() {
  var deferred, self;
  deferred = Q.defer();
  self = this;
  this.get_current_buffer_index().then(function(index) {
    var current_buffer;
    current_buffer = new vimBuffer.VimBuffer(index, self);
    return deferred.resolve(current_buffer);
  });
  return deferred.promise;
};


/**
 * Get index of current buffer
 * @returns {Promise.<int|Error>}
 */

Client.prototype.get_current_buffer_index = function() {
  return this.send_method('vim_get_current_buffer');
};


/**
 * Get current window
 * @example
 * client.get_current_window().then(function (window) {
 *   window.someWindowMethod();
 *   ...
 * });
 * @returns {Promise.<{Window}|Error>}
 */

Client.prototype.get_current_window = function() {
  var deferred, self;
  deferred = Q.defer();
  self = this;
  this.get_current_window_index().then(function(index) {
    var current_window;
    current_window = new vimWindow.VimWindow(index, self);
    return deferred.resolve(current_window);
  });
  return deferred.promise;
};


/**
 * Get index of current window
 * @returns {Promise.<int|Error>}
 */

Client.prototype.get_current_window_index = function() {
  return this.send_method('vim_get_current_window');
};


/**
 * Connect to Neovim and create an instance of Client
 * @returns {Client}
 */

connect = function(address, callback) {
  var client;
  client = new Client(address);
  client.rpcStatus = client.listenRPCStatus();
  client.discover_api().then(function(response) {
    if (callback && typeof callback === 'function') {
      return callback();
    }
  });
  return client;
};

exports.connect = connect;
