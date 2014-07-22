
/**
 * msgpack-rpc is adapted from
 * https://github.com/bpot/node-msgpack-rpc
 * with the improvement on client creator.
 */

(function() {
  var MAX_SEQID, MsgpackRPCStream, NOTIFY, REQUEST, RESPONSE, RPCResponse, Server, SessionPool, events, msgpack, net, sys;

  net = require("net");

  msgpack = require("msgpack");

  events = require("events");

  sys = require("sys");

  REQUEST = 0;

  RESPONSE = 1;

  NOTIFY = 2;

  MAX_SEQID = Math.pow(2, 32) - 1;

  RPCResponse = function(stream, seqid) {
    this.stream = stream;
    this.seqid = seqid;
  };

  RPCResponse.prototype.result = function(args) {
    this.stream.respond(this.seqid, null, args);
  };

  RPCResponse.prototype.error = function(error) {
    this.stream.respond(this.seqid, error, null);
  };

  MsgpackRPCStream = function(stream, handler) {
    var self;
    events.EventEmitter.call(this);
    self = this;
    this.last_seqid = undefined;
    this.stream = stream;
    this.handler = handler;
    this.cbs = [];
    this.timeout = undefined;
    this.msgpack_stream = new msgpack.Stream(this.stream);
    this.msgpack_stream.on("msg", function(msg) {
      var error, method, params, response, result, seqid, type;
      type = msg.shift();
      switch (type) {
        case REQUEST:
          seqid = msg[0];
          method = msg[1];
          params = msg[2];
          response = new RPCResponse(self, seqid);
          self.invokeHandler(method, params.concat(response));
          return self.emit("request", method, params, response);
        case RESPONSE:
          seqid = msg[0];
          error = msg[1];
          result = msg[2];
          if (self.cbs[seqid]) {
            return self.triggerCb(seqid, [error, result]);
          } else {
            return self.emit("error", new Error("unexpected response with unrecognized seqid (" + seqid + ")"));
          }
          break;
        case NOTIFY:
          method = msg[0];
          params = msg[1];
          self.invokeHandler(method, params);
          return self.emit("notify", method, params);
      }
    });
    this.stream.on("connect", function() {
      self.emit("ready");
    });
    this.stream.on("end", function() {
      self.stream.end();
      self.failCbs(new Error("connection closed by peer"));
    });
    this.stream.on("timeout", function() {
      self.failCbs(new Error("connection timeout"));
    });
    this.stream.on("error", function(error) {
      self.failCbs(error);
    });
    this.stream.on("close", function(had_error) {
      if (had_error) {
        return;
      }
      self.failCbs(new Error("connection closed locally"));
    });
  };

  sys.inherits(MsgpackRPCStream, events.EventEmitter);

  MsgpackRPCStream.prototype.triggerCb = function(seqid, args) {
    this.cbs[seqid].apply(this, args);
    delete this.cbs[seqid];
  };

  MsgpackRPCStream.prototype.failCbs = function(error) {
    var seqid;
    for (seqid in this.cbs) {
      this.triggerCb(seqid, [error]);
    }
  };

  MsgpackRPCStream.prototype.invokeHandler = function(method, params) {
    if (this.handler) {
      if (this.handler[method]) {
        this.handler[method].apply(this.handler, params);
      } else {
        response.error(new Error("unknown method"));
      }
    }
  };

  MsgpackRPCStream.prototype.nextSeqId = function() {
    if (this.last_seqid === undefined) {
      return this.last_seqid = 0;
    } else if (this.last_seqid > MAX_SEQID) {
      return this.last_seqid = 0;
    } else {
      return this.last_seqid += 1;
    }
  };

  MsgpackRPCStream.prototype.invoke = function() {
    var args, cb, i, method, self, seqid;
    self = this;
    seqid = this.nextSeqId();
    method = arguments[0];
    cb = arguments[arguments.length - 1];
    args = [];
    i = 1;
    while (i < arguments.length - 1) {
      args.push(arguments[i]);
      i++;
    }
    this.cbs[seqid] = cb;
    if (this.timeout) {
      setTimeout((function() {
        if (self.cbs[seqid]) {
          self.triggerCb(seqid, ["timeout"]);
        }
      }), this.timeout);
    }
    if (this.stream.writable) {
      return this.msgpack_stream.send([REQUEST, seqid, method, args]);
    }
  };

  MsgpackRPCStream.prototype.respond = function(seqid, error, result) {
    if (this.stream.writable) {
      return this.msgpack_stream.send([RESPONSE, seqid, error, result]);
    }
  };

  MsgpackRPCStream.prototype.notify = function(method, params) {
    var args, i;
    method = arguments[0];
    args = [];
    i = 1;
    while (i < arguments.length) {
      args.push(arguments[i]);
      i++;
    }
    if (this.stream.writable) {
      return this.msgpack_stream.send([NOTIFY, method, args]);
    }
  };

  MsgpackRPCStream.prototype.setTimeout = function(timeout) {
    this.timeout = timeout;
  };

  MsgpackRPCStream.prototype.close = function() {
    this.stream.end();
  };

  exports.createClient = function() {
    var args, cb, connection, s;
    args = Array.prototype.slice.call(arguments);
    if (typeof arguments[arguments.length - 1] === 'function') {
      cb = arguments[arguments.length - 1];
      args.pop();
    }
    connection = net.createConnection.apply(this, args);
    s = new MsgpackRPCStream(connection);
    s.on("ready", cb);
    return s;
  };

  Server = function(listener) {
    var self;
    net.Server.call(this);
    self = this;
    this.handler = undefined;
    this.on("connection", function(stream) {
      var rpc_stream;
      stream.on("end", function() {
        stream.end();
      });
      rpc_stream = new MsgpackRPCStream(stream, self.handler);
      if (listener) {
        listener(rpc_stream);
      }
    });
  };

  sys.inherits(Server, net.Server);

  Server.prototype.setHandler = function(handler) {
    this.handler = handler;
  };

  exports.createServer = function(handler) {
    return new Server(handler);
  };

  SessionPool = exports.SessionPool = function() {
    this.clients = {};
  };

  SessionPool.prototype.getTCPClient = function(port, hostname) {
    var address;
    address = hostname + ":" + port;
    if (this.clients[address]) {
      return this.clients[address];
    } else {
      return this.clients[address] = exports.createClient(port, hostname);
    }
  };

  SessionPool.prototype.getUnixClient = function(path) {
    if (this.clients[path]) {
      return this.clients[path];
    } else {
      return this.clients[path] = exports.createClient(path);
    }
  };

  SessionPool.prototype.closeClients = function() {
    var i;
    for (i in this.clients) {
      continue;
    }
  };

}).call(this);
