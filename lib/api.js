// retry rpc calls and resume streams and live streams.
// a connection is a function that returns
var through = require('through');
//var rest = require('./resthttp');
var connection = require('./connection');
var repipe = require('./repipe');

module.exports = function(config,reconnect){
  // make sure 
  //var resthttp = rest(config);

  var o = {
    reconnect:reconnect,
    connection:false,
    // make rest like api calls via https or the current streaming connection. 
    restRetries:config.restRetries||2,
    restTimeout:config.restTimeout||30000,// this should not be an issue.
    expectingStream:{},
    rest:function(obj,cb){
      var tries = this.restRetries
      ,z = this;

      var timer = setTimeout(function(){
        var e = new Error("call timedout");
        e.code = "E_TIMEOUT";
        _cb(e);
      },z.restTimeout);

      var _cb = function(err,data){

        console.log('rest response> ',err,data,raw)

        if(err && tries > 0) return call();
        if(err) return cb(err);

        if(data.stream){
          // im expecting to follow up with a new strem connection for this callback response.
          //
        } else {
          cb(data.error,data.data); 
          clearTimeout(timer);
        }
      };

      function call(){
        --tries;

        getConnection(function(err,con){
          if(err) return _cb(err);
          con.rest(obj,_cb);
        });

      };

      call();
    },
    // sync the account's data in realtime
    sync:function(account){
      var s = through();
      repipe(s,function(last){
        return con.mdm.createReadStream({type:'sync',args:{account:account,start:last}});
      });
      return s;
    },
    // stream stats data
    stats:function(o){
      /*
        o.troop
        o.scout
        o.reports = [led,..]
        o.start = now
        o.end = then
        o.tail defaults true with no end
      */
      var s = through();
      repipe(s,function(last){
          if(last) o.start = last.key;
          return con.mdm.createReadStream({type:'stats',args:o});
      });

      return s; // resume!
    }
  };

  var pending = [];

  function getConnection(cb){
    if(reconnect && !reconnect._bound) {
      reconnect._bound = 1;
      if(reconnect.connected) o.connection = connection.rpc(reconnect._connection); 
      reconnect.on('connect',function(s){
        o.connection = connection.rpc(s);
        o.connection.mdm.on('connection',function(stream){
          // the server has opened a stream from me.
          if(stream.meta && stream.meta.type == "rest-stream") {

          };
        });

        while(pending.length) pending.shift()(false,o.connection);
      }).on('disconnect',function(){
        o.connection = false;
      })
    }

    if(reconnect.reconnect == false && !reconnect.connection) {
      return process.nextTick(function(){
        var e = new Error('reconnect is off. no new conections will be made.');
        e.code = "E_RECONOFF";
        cb(e);
      });
    }

    if(o.connection) return process.nextTick(function(){
      if(o.connection) cb(false,o.connection);
      else pending.push(cb);
    });

    pending.push(cb);
  }

  return o;  

}

/*
    // obj must have url and method.
    // obj may have data

    api.log('rest>',obj,api.token);

    if(api.token){
      if(!obj.data) obj.data = {};
      obj.data.token = api.token;
    }

    if(!obj.method) obj.method = 'get';

    var id = obj.id = ++this.id;
    api.pending[id] = cb||function(){};
    setTimeout(function(){
      if(api.pending[id]) {
        delete api.pending[id];
        cb(new Error('timeout'));
      }
    },api.timeout);

    getStream(function(err,stream){
      stream.write(JSON.stringify(obj));
    });
*/

