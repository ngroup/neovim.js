events = require('events')
Q = require('when')
vimBuffer = require('./buffer.js')
vimWindow = require('./window.js')
vimTabpage = require('./tabpage.js')
rpc = require('./msgpack-rpc')


construct_method = (name, id, params) ->
  args = []
  args_string = ''
  for p in params
    args.push p[1]
    args_string += ',' + p[1]

  func_client = 'var args = Array.prototype.slice.call(arguments);' +
  'args.unshift(' + id.toString() + ');' +
  'return this.send_method.apply(this, args);'

  func = 'var args = Array.prototype.slice.call(arguments);' +
  'args.unshift(this.index);' +
  'args.unshift(' + id.toString() + ');' +
  'return this.client.send_method.apply(this.client, args);'


  name_reolved = name.split('_')
  class_name = name_reolved.shift()
  method_name = name_reolved.join('_')

  if class_name == 'vim'
    Client.prototype[method_name] = new Function(func_client)
  else if class_name == 'buffer'
    vimBuffer.VimBuffer.prototype[method_name] = new Function(func)
  else if class_name == 'window'
    vimWindow.VimWindow.prototype[method_name] = new Function(func)
  else if class_name == 'tabpage'
    vimTabpage.VimTabpage.prototype[method_name] = new Function(func)

  return


###*
# Initialize a new `Client` with the given `address`.
# @class Represent a Neovim client
# @param {string} address - The address of Neovim
###
Client = (address) ->
  @pending_message = []
  @apiResolved = false
  @neovim_method_dict = {}
  @client = rpc.createClient address, ->
    return

  return


Client::listenRPCStatus = ->
  rpcStatus = new events.EventEmitter()
  self = @

  rpcStatus.on('free', ->
    if self.pending_message.length != 0
      self.push_queue()
    return
  )

  rpcStatus.on('addNewMessage', ->
    if self.pending_message.length == 1 and self.apiResolved
      self.rpcStatus.emit('free')
    return
  )

  return rpcStatus


Client::send_method = ->
  deferred = Q.defer()
  method_id = arguments[0]
  i = 1
  args = []
  cb = arguments[arguments.length - 1]

  if typeof cb == 'function'
    while i < arguments.length - 1
      args.push arguments[i]
      i++
  else
    while i < arguments.length
      args.push arguments[i]
      i++
  @pending_message.push([method_id, args, deferred])
  @rpcStatus.emit('addNewMessage')
  return deferred.promise


Client::push_queue = ->
  self = @
  method_id = @pending_message[0][0]
  deferred = @pending_message[0][2]
  callback = (err, response) ->
    self.pending_message.splice(0, 1)
    self.rpcStatus.emit('free')
    if err
      return deferred.reject(new Error(err))
    else
      return deferred.resolve(response)

  args = @pending_message[0][1]
  args.unshift(method_id)
  args.push(callback)
  @client.invoke.apply(@client, args)

  return


Client::discover_api = ->
  deferred = Q.defer()
  self = @
  @client.on 'ready', ->
    self.client.invoke(0, [], (err, response) ->
      if(!err)
        self.channel_id = response[0]
        api = response[1]
        for method in api['functions']
          construct_method(method.name, method.id, method.parameters)
        self.apiResolved = true
        self.rpcStatus.emit('free')
        return deferred.resolve(response)
      else
        return deferred.reject(err)
      return
    )
    return
  return deferred.promise




###*
# Get all current buffers
# @example
# client.buffers().then(function (buffers) {
#   buffers[0].someVimBufferMethod();
#   ...
# });
# @returns {Promise.<{VimBuffer[]}|Error>}
###
Client::buffers = ->
  deferred = Q.defer()
  self = @
  @get_buffers()
    .then((buf_idx_list) ->
      buf_list = buf_idx_list.map((buf_idx) ->
        return new vimBuffer.VimBuffer(buf_idx, self)
      )
      return deferred.resolve(buf_list)
    )
  return deferred.promise



###*
# Get current buffer
# @example
# client.get_current_buffer().then(function (buffer) {
#   buffer.someVimBufferMethod();
#   ...
# });
# @returns {Promise.<{VimBuffer}|Error>}
###
Client::get_current_buffer = ->
  deferred = Q.defer()
  self = @
  @get_current_buffer_index()
    .then((index) ->
      current_buffer = new vimBuffer.VimBuffer(index, self)
      return deferred.resolve(current_buffer)
    )
  return deferred.promise


###*
# Get index of current buffer
# @returns {Promise.<int|Error>}
###
Client::get_current_buffer_index = ->
  @send_method('vim_get_current_buffer')


###*
# Get current window
# @example
# client.get_current_window().then(function (window) {
#   window.someWindowMethod();
#   ...
# });
# @returns {Promise.<{Window}|Error>}
###
Client::get_current_window = ->
  deferred = Q.defer()
  self = @
  @get_current_window_index()
    .then((index) ->
      current_window = new vimWindow.VimWindow(index, self)
      return deferred.resolve(current_window)
    )
  return deferred.promise


###*
# Get index of current window
# @returns {Promise.<int|Error>}
###
Client::get_current_window_index = ->
  @send_method('vim_get_current_window')


###*
# Connect to Neovim and create an instance of Client
# @returns {Client}
###
connect = (address, callback) ->
  client = new Client(address)
  client.rpcStatus = client.listenRPCStatus()
  client.discover_api()
  .then( (response)->
    if callback && typeof callback == 'function'
      callback()
    )


  return client


# Expose `connect`
exports.connect = connect
