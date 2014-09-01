###*
# msgpack-rpc is adapted from
# https://github.com/bpot/node-msgpack-rpc
# with the improvement on client creator.
###

net = require("net")
msgpack = require("neo-msgpack-js")
events = require("events")
sys = require("sys")


REQUEST = 0
RESPONSE = 1
NOTIFY = 2
MAX_SEQID = Math.pow(2, 32) - 1

RPCResponse = (stream, seqid) ->
  @stream = stream
  @seqid = seqid
  return


RPCResponse::result = (args) ->
  @stream.respond @seqid, null, args
  return


RPCResponse::error = (error) ->
  @stream.respond @seqid, error, null
  return


# The heart of the beast, used for both server and client
MsgpackRPCStream = (stream, handler) ->
  events.EventEmitter.call this
  self = this
  @last_seqid = `undefined`
  @stream = stream
  @handler = handler
  @cbs = []
  @timeout = `undefined`
  @msgpack_stream = new msgpack.Stream(@stream)
  @msgpack_stream.on "msg", (msg) ->
    if msg instanceof Array
      type = msg.shift()
      switch type
        when REQUEST
          seqid = msg[0]
          method = msg[1]
          params = msg[2]
          response = new RPCResponse(self, seqid)
          self.invokeHandler method, params.concat(response)
          self.emit "request", method, params, response
        when RESPONSE
          seqid = msg[0]
          error = msg[1]
          result = msg[2]
          if self.cbs[seqid]
            self.triggerCb seqid, [
              error
              result
            ]
          else
            self.emit "error", new Error("unexpected response with unrecognized seqid (" + seqid + ")")
        when NOTIFY
          method = msg[0]
          params = msg[1]
          self.invokeHandler method, params
          self.emit "notify", method, params
    else
      return

  @stream.on "connect", ->
    self.emit "ready"
    return


  # Failures
  @stream.on "end", ->
    self.stream.end()
    self.failCbs new Error("connection closed by peer")
    return

  @stream.on "timeout", ->
    self.failCbs new Error("connection timeout")
    return

  @stream.on "error", (error) ->
    self.failCbs error
    return

  @stream.on "close", (had_error) ->
    return  if had_error
    self.failCbs new Error("connection closed locally")
    return

  return

sys.inherits MsgpackRPCStream, events.EventEmitter

MsgpackRPCStream::triggerCb = (seqid, args) ->
  @cbs[seqid].apply this, args
  delete @cbs[seqid]

  return

MsgpackRPCStream::failCbs = (error) ->
  for seqid of @cbs
    @triggerCb seqid, [error]
  return

MsgpackRPCStream::invokeHandler = (method, params) ->
  if @handler
    if @handler[method]
      @handler[method].apply @handler, params
    else
      response.error new Error("unknown method")
  return

MsgpackRPCStream::nextSeqId = ->
  if @last_seqid is `undefined`
    @last_seqid = 0
  else if @last_seqid > MAX_SEQID
    @last_seqid = 0
  else
    @last_seqid += 1

MsgpackRPCStream::invoke = ->
  self = this
  seqid = @nextSeqId()
  method = arguments[0]
  cb = arguments[arguments.length - 1]
  args = []
  i = 1

  while i < arguments.length - 1
    args.push arguments[i]
    i++
  @cbs[seqid] = cb
  if @timeout
    setTimeout (->
      self.triggerCb seqid, ["timeout"]  if self.cbs[seqid]
      return
    ), @timeout
  if @stream.writable
    return @msgpack_stream.send([
      REQUEST
      seqid
      method
      args
    ])
  return

MsgpackRPCStream::respond = (seqid, error, result) ->
  if @stream.writable
    return @msgpack_stream.send([
      RESPONSE
      seqid
      error
      result
    ])
  return

MsgpackRPCStream::notify = (method, params) ->
  method = arguments[0]
  args = []
  i = 1

  while i < arguments.length
    args.push arguments[i]
    i++
  if @stream.writable
    return @msgpack_stream.send([
      NOTIFY
      method
      args
    ])
  return

MsgpackRPCStream::setTimeout = (timeout) ->
  @timeout = timeout
  return

MsgpackRPCStream::close = ->
  @stream.end()
  return


exports.createClient = ->
  args = Array.prototype.slice.call(arguments)
  if typeof arguments[arguments.length - 1] == 'function'
    cb = arguments[arguments.length - 1]
    args.pop()
  connection = net.createConnection.apply(this, args)
  s = new MsgpackRPCStream(connection)
  s.on "ready", cb
  s


Server = (listener) ->
  net.Server.call this
  self = this
  @handler = `undefined`
  @on "connection", (stream) ->
    stream.on "end", ->
      stream.end()
      return

    rpc_stream = new MsgpackRPCStream(stream, self.handler)
    listener rpc_stream  if listener
    return

  return

sys.inherits Server, net.Server
Server::setHandler = (handler) ->
  @handler = handler
  return

exports.createServer = (handler) ->
  new Server(handler)

SessionPool = exports.SessionPool = ->
  @clients = {}
  return

SessionPool::getTCPClient = (port, hostname) ->
  address = hostname + ":" + port
  if @clients[address]
    @clients[address]
  else
    @clients[address] = exports.createClient(port, hostname)

SessionPool::getUnixClient = (path) ->
  if @clients[path]
    @clients[path]
  else
    @clients[path] = exports.createClient(path)


SessionPool::closeClients = ->
  for i of @clients
    continue
  return
