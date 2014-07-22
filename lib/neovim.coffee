rpc = require('./msgpack-rpc')
events = require('events')
buffer = require('./buffer.js')
Q = require('when')


neovim_method_list = [
  'vim_command',
  'vim_err_write',
  'vim_eval',
  'vim_get_current_buffer',
  'vim_out_write',
  'vim_push_keys',
  'vim_get_buffers',
  'buffer_get_length',
  'buffer_get_line',
  'buffer_set_line',
  'buffer_get_slice',
  'buffer_set_slice',
  'buffer_del_line',
]


Client = (address) ->
  @client = rpc.createClient address, ->
    console.log('neovim connected')
    return

  @next_request_id = 1
  @pending_message = []
  @apiResolved = false
  @neovim_method_dict = {}

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


Client::push_queue = ->
  self = @
  method_name = @pending_message[0][0]
  method_id = @neovim_method_dict[method_name]
  cb = @pending_message[0][2]
  callback = (err, response) ->
    self.pending_message.splice(0, 1)
    self.rpcStatus.emit('free')
    if err
      return cb.reject(new Error(err))
    else
      return cb.resolve(response)

  args = @pending_message[0][1]
  args.unshift(method_id)
  args.push(callback)
  @client.invoke.apply(@client, args)

  return


Client::discover_api = ->
  self = @
  @client.on 'ready', ->
    self.client.invoke(0, [], (err, response) ->
      if(!err)
        api = response[1]
        for method_name in neovim_method_list
          re = new RegExp(method_name + "[\\s\\S]{3}\([\u0001-\u003F]\)", "i")
          method_id = re.exec(api)[1].charCodeAt(0)
          self.neovim_method_dict[method_name] = method_id
        self.apiResolved = true
        self.rpcStatus.emit('free')
      else
        console.log err
      return
    )
    return
  return


Client::command = (args)->
  @send_method('vim_command', args)
  return


Client::get_current_buffer = ->
  deferred = Q.defer()
  self = @
  @get_current_buffer_index()
    .then( (index) ->
      current_buffer = new buffer.create_buffer(index, self)
      return deferred.resolve(current_buffer)
    )
  return deferred.promise


Client::get_current_buffer_index = ->
  @send_method('vim_get_current_buffer')


Client::send_method = ->
  deferred = Q.defer()
  method_name = arguments[0]
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


  @pending_message.push([method_name, args, deferred])
  @rpcStatus.emit('addNewMessage')
  return deferred.promise


connect = (address) ->
  client = new Client(address)
  client.rpcStatus = client.listenRPCStatus()
  client.discover_api()
  return client


exports.connect = connect
