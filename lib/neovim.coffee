net = require("net")
msgpack = require('msgpack-js')
events = require('events')


neovim_method_list = [
  'vim_command',
  'vim_err_write',
  'vim_eval',
  'vim_get_current_buffer',
  'vim_out_write',
  'vim_push_keys'
]


Client = (address) ->
  self = Object.create({})
  try
    @client = net.createConnection '/tmp/neovim', ->
      console.log('neovim connected')
      return
  catch err
    console.log err

  @next_request_id = 1
  @pending_message = []
  @apiResolved = false
  @neovim_method_dict = {}

  return

Client.prototype.listenRPCStatus = ->
  rpcStatus = new events.EventEmitter()
  _this = @

  rpcStatus.on('free', ->
    if _this.pending_message.length != 0
      _this.push_queue()
    return
  )

  rpcStatus.on('addNewMessage', ->
    if _this.pending_message.length == 1 and @apiResolved
      _this.rpcStatus.emit('free')
    return
  )

  return rpcStatus


Client.prototype.command = (args) ->
  method_name = 'vim_command'
  @pending_message.push([method_name, [args]])
  @rpcStatus.emit('addNewMessage')
  return


Client.prototype.push_queue = () ->
  method_name = @pending_message[0][0]
  args = @pending_message[0][1]
  method_id = @neovim_method_dict[method_name]
  request_id = @next_request_id
  # Update request id
  @next_request_id = request_id + 1
  # make the request
  packed_msg = msgpack.encode([0, request_id, method_id, args])
  # send the request to queue
  @client.write(packed_msg)
  @pending_message.splice(0, 1)
  _this = @
  @client.once('data', (msg) ->
    unpackData = msgpack.decode(msg)
    api = unpackData
    _this.rpcStatus.emit('free')
    return
  )



Client.prototype.discover_api = (callback)->
  dummy_array = [0, 0, 0, []]
  dummy_msg = msgpack.encode(dummy_array)
  @client.write(dummy_msg)

  _this = @

  @client.once('data', (msg) ->
    unpackData = msgpack.decode(msg)
    api = unpackData[3][1]
    for method_name in neovim_method_list
      re = new RegExp(method_name + "[\\s\\S]{3}\([\u0001-\u003F]\)", "i")
      method_id = re.exec(api)[1].charCodeAt(0)
      _this.neovim_method_dict[method_name] = method_id
    _this.apiResolved = true
    _this.rpcStatus.emit('free')
    return
  )

  return


connect = (address) ->
  client = new Client(address)
  client.rpcStatus = client.listenRPCStatus()
  client.discover_api()
  return client


exports.connect = connect
