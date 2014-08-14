var Client, Q, buffer, connect, events, neovim_method_dict, rpc, vimWindow;

events = require('events');

Q = require('when');

buffer = require('./buffer.js');

vimWindow = require('./window.js');

rpc = require('./msgpack-rpc');

neovim_method_dict = {
  'buffer_get_length': 1,
  'buffer_get_line': 2,
  'buffer_set_line': 3,
  'buffer_del_line': 4,
  'buffer_get_slice': 5,
  'buffer_set_slice': 6,
  'buffer_get_var': 7,
  'buffer_set_var': 8,
  'buffer_get_option': 9,
  'buffer_set_option': 10,
  'buffer_get_number': 11,
  'buffer_get_name': 12,
  'buffer_set_name': 13,
  'buffer_is_valid': 14,
  'buffer_insert': 15,
  'buffer_get_mark': 16,
  'tabpage_get_windows': 17,
  'tabpage_get_var': 18,
  'tabpage_set_var': 19,
  'tabpage_get_window': 20,
  'tabpage_is_valid': 21,
  'vim_push_keys': 22,
  'vim_command': 23,
  'vim_feedkeys': 24,
  'vim_replace_termcodes': 25,
  'vim_eval': 26,
  'vim_strwidth': 27,
  'vim_list_runtime_paths': 28,
  'vim_change_directory': 29,
  'vim_get_current_line': 30,
  'vim_set_current_line': 31,
  'vim_del_current_line': 32,
  'vim_get_var': 33,
  'vim_set_var': 34,
  'vim_get_vvar': 35,
  'vim_get_option': 36,
  'vim_set_option': 37,
  'vim_out_write': 38,
  'vim_err_write': 39,
  'vim_get_buffers': 40,
  'vim_get_current_buffer': 41,
  'vim_set_current_buffer': 42,
  'vim_get_windows': 43,
  'vim_get_current_window': 44,
  'vim_set_current_window': 45,
  'vim_get_tabpages': 46,
  'vim_get_current_tabpage': 47,
  'vim_set_current_tabpage': 48,
  'vim_subscribe': 49,
  'vim_unsubscribe': 50,
  'vim_register_provider': 51,
  'window_get_buffer': 52,
  'window_get_cursor': 53,
  'window_set_cursor': 54,
  'window_get_height': 55,
  'window_set_height': 56,
  'window_get_width': 57,
  'window_set_width': 58,
  'window_get_var': 59,
  'window_set_var': 60,
  'window_get_option': 61,
  'window_set_option': 62,
  'window_get_position': 63,
  'window_get_tabpage': 64,
  'window_is_valid': 65
};


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
  this.neovim_method_dict = neovim_method_dict;
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
      if (!err) {
        self.channel_id = response[0];
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
