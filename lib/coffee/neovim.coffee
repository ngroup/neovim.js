events = require('events')
Q = require('when')
rpc = require('neo-msgpack-rpc')
vimBuffer = require('./buffer.js')
vimWindow = require('./window.js')
vimTabpage = require('./tabpage.js')


construct_method = (name, id) ->
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
    if self.pending_message.length == 1
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
    self.send_method(0).then((response) ->
      self.channel_id = response[0]
      api = response[1]
      for method in api['functions']
        construct_method(method.name, method.id)
      self.rpcStatus.emit('free')
      return deferred.resolve(response)
    ).catch((err) ->
      return deferred.reject(err)
    )
    return
  return deferred.promise


###*
# Get all buffers
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
# Get current buffer or set current buffer when buffer index is given.
# @returns {Promise.<{VimBuffer[]}|Error>}
###
Client::current_buffer = (index) ->
  deferred = Q.defer()
  self = @
  if (index == undefined || index == null)
    @get_current_buffer().then((buf_idx) ->
      buf = new vimBuffer.VimBuffer(buf_idx, self)
      return deferred.resolve(buf)
    )
  else
    @set_current_buffer(index).then( ->
      return deferred.resolve()
    )
  return deferred.promise


###*
# Get all windows
# @returns {Promise.<{Window}|Error>}
###
Client::windows = ->
  deferred = Q.defer()
  self = @
  @get_windows()
    .then((win_idx_list) ->
      win_list = win_idx_list.map((win_idx) ->
        return new vimWindow.VimWindow(win_idx, self)
      )
      return deferred.resolve(win_list)
    )
  return deferred.promise


###*
# Get current window or set current window when window index is given.
# @returns {Promise.<{Vimwindow[]}|Error>}
###
Client::current_window = (index) ->
  deferred = Q.defer()
  self = @
  if (index == undefined || index == null)
    @get_current_window().then((win_idx) ->
      win = new vimWindow.VimWindow(win_idx, self)
      return deferred.resolve(win)
    )
  else
    @set_current_window(index).then( ->
      return deferred.resolve()
    )
  return deferred.promise


###*
# Get all tabpages
# @returns {Promise.<{tabpage}|Error>}
###
Client::tabpages = ->
  deferred = Q.defer()
  self = @
  @get_tabpages()
    .then((tab_idx_list) ->
      tab_list = tab_idx_list.map((tab_idx) ->
        return new vimTabpage.VimTabpage(tab_idx, self)
      )
      return deferred.resolve(tab_list)
    )
  return deferred.promise


###*
# Get current tabpage or set current tabpage when tabpage index is given.
# @returns {Promise.<{Vimtabpage[]}|Error>}
###
Client::current_tabpage = (index) ->
  deferred = Q.defer()
  self = @
  if (index == undefined || index == null)
    @get_current_tabpage().then((tab_idx) ->
      tab = new vimTabpage.VimTabpage(tab_idx, self)
      return deferred.resolve(tab)
    )
  else
    @set_current_tabpage(index).then( ->
      return deferred.resolve()
    )
  return deferred.promise


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
