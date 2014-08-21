var Client, Q, buffer, connect, events, rpc, vimWindow;

events = require('events');

Q = require('when');

buffer = require('./buffer.js');

vimWindow = require('./window.js');

rpc = require('./msgpack-rpc');


/**
 * Initialize a new `Client` with the given `address`.
 * @class Represent a Neovim client
 * @param {string} address - The address of Neovim
 */

Client = function(address) {
  this.client = rpc.createClient(address, function() {
    console.log('neovim connected');
  });
  this.pending_message = [];
  this.apiResolved = false;
  this.neovim_method_dict = {};
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
  var args, cb, deferred, i, method_name;
  deferred = Q.defer();
  method_name = arguments[0];
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
  this.pending_message.push([method_name, args, deferred]);
  this.rpcStatus.emit('addNewMessage');
  return deferred.promise;
};

Client.prototype.push_queue = function() {
  var args, callback, cb, method_id, method_name, self;
  self = this;
  method_name = this.pending_message[0][0];
  method_id = this.neovim_method_dict[method_name];
  cb = this.pending_message[0][2];
  callback = function(err, response) {
    self.pending_message.splice(0, 1);
    self.rpcStatus.emit('free');
    if (err) {
      return cb.reject(new Error(err));
    } else {
      return cb.resolve(response);
    }
  };
  args = this.pending_message[0][1];
  args.unshift(method_id);
  args.push(callback);
  this.client.invoke.apply(this.client, args);
};

Client.prototype.discover_api = function() {
  var self;
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
          self.neovim_method_dict[method.name] = method.id;
        }
        self.apiResolved = true;
        self.rpcStatus.emit('free');
      } else {
        console.log(err);
      }
    });
  });
};


/**
 * Send vim command
 * @param {string} args - The command string
 * @returns {Promise.<null|Error>}
 */

Client.prototype.command = function(args) {
  return this.send_method('vim_command', args);
};


/**
 * Send keys to vim input buffer
 * @param {string} args - The string as the keys to send
 * @returns {Promise.<null|Error>}
 */

Client.prototype.push_keys = function(args) {
  return this.send_method('vim_push_keys', args);
};


/**
 * Evaluate the expression string using the vim internal expression
 * @param {string} args - String to be evaluated
 * @returns {Promise.<null|Error>}
 */

Client.prototype["eval"] = function(args) {
  return this.send_method('vim_eval', args);
};


/**
 * Get all current buffers
 * @example
 * client.get_buffers().then(function (buffers) {
 *   buffers[0].someVimBufferMethod();
 *   ...
 * });
 * @returns {Promise.<{VimBuffer[]}|Error>}
 */

Client.prototype.get_buffers = function() {
  var deferred, self;
  deferred = Q.defer();
  self = this;
  this.send_method('vim_get_buffers').then(function(buf_idx_list) {
    var buf_list;
    buf_list = buf_idx_list.map(function(buf_idx) {
      return new buffer.VimBuffer(buf_idx, self);
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
    current_buffer = new buffer.VimBuffer(index, self);
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
 * Get index of current window
 * @returns {Promise.<int|Error>}
 */

Client.prototype.subscribe_event = function(event) {
  return this.send_method('vim_subscribe', event);
};


/**
 * Connect to Neovim and create an instance of Client
 * @returns {Client}
 */

connect = function(address) {
  var client;
  client = new Client(address);
  client.rpcStatus = client.listenRPCStatus();
  client.discover_api();
  return client;
};

exports.connect = connect;
