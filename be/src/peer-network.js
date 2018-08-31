// Module to support peers on a p2p network. RG
var async = require('async');
var os = require("os");
var request = require('request');
var uti = require('./utilFuncs.js').utilFuncs;

exports.Peer = class {
  // Props
  set pubKey(val) {
    this._pubKey = val;
  }
  get pubKey() {
    return this._pubKey;
  }
  set privKey(val) {
    this._privKey = val;
  }
  get privKey() {
    return this._privKey;
  }
  set ip(val) {
    this._ip = val;
  }
  get ip() {
    return this._ip;
  }
  set hostName(val) {
    this._hostName = val;
  }
  get hostName() {
    return this._hostName;
  }

  // Construct
  constructor() {
    var peerInst = this;
    var ifaces = os.networkInterfaces();

    //Generate Key Pair
    var keys = uti.genPair();
    var pubKey = keys[0];
    var privKey = keys[1];

    //Create schema (if necessary), add key pair (if necessary), return key pair
    var sP = "\
      create table IF NOT EXISTS users      ( \"email\" varchar(45), \"firstName\" varchar(30), \"id\" varchar(64), \"lastName\" varchar(30), \"type\" varchar(15), \"userName\" varchar(30) );\
      create table IF NOT EXISTS merchants  ( \"id\" varchar(64), \"name\" varchar(30), \"type\" varchar(15) );\
      create table IF NOT EXISTS payments   ( \"amount\" NUMERIC (21, 16), \"createdAt\" timestamp, \"fromUserId\" varchar(64), \"id\" varchar(64), \"toMerchantId\" varchar(64), \"toUserId\" varchar(64), \"type\" varchar(15) );\
      create table IF NOT EXISTS peers      ( connected smallint, hostname varchar(20), id varchar(500), ip varchar(20), type varchar(15) );\
      create table IF NOT EXISTS key        ( id varchar(1700) );\
      create table IF NOT EXISTS broadcasted( id varchar(300) );\
      INSERT INTO peers (connected,hostname,id,ip,type) SELECT " + 2 + ",'" + os.hostname() + "','" + pubKey + "','" + ifaces[Object.keys(ifaces)[1]][0].address + "','" + "peer" + "' WHERE NOT EXISTS (SELECT * FROM peers where connected=2);\
      INSERT INTO key (id) SELECT '" + privKey + "' WHERE NOT EXISTS (SELECT * FROM key);\
      select * from peers where connected=2;\
      select * from key;\
      ";

    uti.bulkSQL(sP,'series',(res) => {
      //Load key pair into memory
      peerInst.pubKey = res[res.length-2].rows[0].id;
      peerInst.ip = res[res.length-2].rows[0].ip;
      peerInst.hostName = res[res.length-2].rows[0].hostname;
      peerInst.privKey = res[res.length-1].rows[0].id;
    });
  }

  // Methods
  processReq(req,resp,cb) {
    switch (req.headers.type) {
      case 'getData':
        this.validateReq(req,resp,cb,'external',this.getData.bind(this));
        break;
      case 'addData':
        // this.validateReq(req,resp,cb,'internal',this.addData.bind(this));
        this.validateReq(req,resp,cb,'external',this.addData.bind(this));
        break;
      case 'joinNetwork':
        this.validateReq(req,resp,cb,'self',this.joinNetwork.bind(this));
        // this.validateReq(req,resp,cb,'external',this.joinNetwork.bind(this));
        break;
      case 'addPeer':
        this.validateReq(req,resp,cb,'external',this.addPeer.bind(this));
        break;
      case 'connectPeer':
        this.validateReq(req,resp,cb,'self',this.connectPeer.bind(this));
        // this.validateReq(req,resp,cb,'external',this.connectPeer.bind(this));
        break;
    }
  }

  connectPeer(req,resp,cb) {
    var query = "update peers set connected=" + req.headers.alive + " where ip='" + req.headers.ip_dest + "';"

    uti.bulkSQL(query,'parallel',(res) => {
      cb(resp,'connected with [' + req.headers.alive + '] flag.');
    });
  }

  joinNetwork(req,resp,cb) {
    var peerInst = this;

    async.waterfall([
        //get ext data
        function (callback) {
          callback(null,peerInst.optionGen(req.headers.ip_dest,'empty','getData',[]));
        },
        request.post,
        //add Data
        function (res,bd,cb) {
          console.log(bd);
          cb(null,peerInst.optionGen(peerInst.ip,JSON.parse(JSON.parse(bd).result.body).data,'addData',[]));
        },
        request.post,
        //delete duplicate self in peers
        function (res,bd,cb) {
          console.log(bd);
          var query = "delete from peers where id in (select id from peers where connected=2) and connected!=2;";

          uti.bulkSQL(query,'parallel',(res) => {
            cb(null,res,bd);
          });
        },
        //make peer request
        function (res,bd,cb) {
          cb(null,peerInst.optionGen(req.headers.ip_dest,'empty','addPeer',[]));
        },
        request.post
      ],
      //process response (delete data if failed or maintain)
      function (error,res,by) {
        console.log(by);
        var msg = JSON.parse(by).result;
        if ( msg == 'peer added.' ) {
            cb(resp,'peer connected.');
        }
        else {
          var query = "\
          delete from users;\
          delete from merchants;\
          delete from payments;\
          delete from peers where connected!=2;\
          ";

          uti.bulkSQL(query,'parallel',(res) => {
            cb(resp,'peer connect failed: ' + msg);
          });
        }
    });
  }

  addPeer(req,resp,cb) {
    var peerInst = this;
    var selfRes;
    var peerRes;

    async.waterfall([
        //get ext data
        function (callback) {
          callback(null,peerInst.optionGen(req.headers.ip_dest,'empty','getData',[]));
        },
        request.post,
        //get self Data
        function (res,bd,cb) {
          console.log(bd);
          peerRes = JSON.parse(JSON.parse(bd).result.body).data;
          peerRes = peerRes.filter(function(obj) {
            if(obj.type == 'peer') {
              return false;
            }
            return true;
          });

          cb(null,peerInst.optionGen(peerInst.ip,'empty','getData',[]));
        },
        request.post,
        //compare results
        function (res,bd,cb) {
          console.log(bd);
          selfRes = JSON.parse(JSON.parse(bd).result.body).data;
          selfRes = selfRes.filter(function(obj) {
            if(obj.type == 'peer') {
              return false;
            }
            return true;
          });

          if ( JSON.stringify(selfRes) == JSON.stringify(peerRes) ) {
            cb(null,'done');
          }
          else {
            cb('Error: peer does not match.');
          }
        }
      ],
      //process conclusion (add data or do nothing)
      function (error,by) {
        if (!error) {
          var jsonData = {
              id: req.headers.pubkey,
              hostname: req.headers.hostname,
              connected: 0,
              ip: req.headers.ip_dest,
              type: 'peer'
          };

          request.post(peerInst.optionGen(peerInst.ip,[jsonData],'addData',[]), (err,res,bd) => {
            cb(resp,'peer added.');
          });
        }
        else {
          cb(resp,error);
        }
    });
  }

  addData(req,resp,cb) {
    var q = "select id from broadcasted where id='" + req.headers.hash + "';";

    uti.bulkSQL(q,'parallel',(res) => {
      if (res[0].rows.length == 0) {
        var peerInst = this;
        const data = req.body.data;
        var query = "";

        query = query + uti.queryGen(data,'user','users');
        query = query + uti.queryGen(data,'merchant','merchants');
        query = query + uti.queryGen(data,'payment','payments');
        query = query + uti.queryGen(data,'peer','peers');
        query = query + "insert into broadcasted values ('" + req.headers.hash + "');";

        uti.bulkSQL(query,'parallel',(res) => {
          peerInst.broadcastData(req,resp,cb);
        });
      }
      else {
        cb(resp,'Broadcasted this request before. Closing...');
      }
    });
  }

  broadcastData(req,resp,cb) {
    var peerInst = this;
    var pl = req.body.data;
    var query = "select ip from peers where connected=1;";
    var cmp = 0;
    var ipTrace = req.headers.ip_trace.substring(1,req.headers.ip_trace.length-1).split(',');;

    uti.bulkSQL(query,'parallel',(res) => {
      var trgIp;
      if (res[0].rows.length>0) {
        for(var i=0; i<res[0].rows.length; i++) {
          trgIp = res[0].rows[i].ip;

          request.post(peerInst.optionGen(trgIp,pl,'addData',ipTrace),(err,s,e) => {
            console.log(e);
            cmp += 1;
            if (cmp == res[0].rows.length) {
                cb(resp,{ message: 'Sent to connected peers.', pubKey: peerInst.pubKey });
            }
          });
        }
      }
      else {
        cb(resp,{ message: 'No peers to send to.', pubKey: peerInst.pubKey });
      }
    });
  }

  getData(req,resp,cb) {
    var peerInst = this;
    var query = "\
    select * from users order by id;\
    select * from merchants order by id;\
    select * from payments order by id;\
    select * from peers order by id;\
    ";

    // select substring(amount::varchar from 0 for (char_length(amount::varchar) - position(substring(reverse(amount::varchar) from '([1-9]{1,1})') in reverse(amount::varchar)))+2)::numeric as amount,\"createdAt\",\"fromUserId\",\"id\",\"toMerchantId\",\"toUserId\",\"type\" from payments;\

    uti.bulkSQL(query,'parallel',(res) => {
      var data = [];
      data = data.concat(res[0].rows);
      data = data.concat(res[1].rows);
      res[2].rows.forEach(function(item, index) {
        res[2].rows[index].amount = parseFloat(res[2].rows[index].amount);
      });
      data = data.concat(res[2].rows);
      data = data.concat(res[3].rows);

      var bodyString = JSON.stringify({
        'data' : data
      });

      var options = {
        headers : {
            'content-type' : 'application/json',
            'hash': uti.hash(bodyString),
            'pubKey': peerInst.pubKey,
            'sig': uti.sign(uti.hash(bodyString),peerInst.privKey),
            // 'ip_trace': ['154.23.455.12'],
            'type' : 'getData'
          },
        body: bodyString
      };
      cb(resp,options);
    });
  }

  validateReq(req,resp,cb,type,meth) {
    var respMsg = 'good';

    var hash = req.headers.hash;
    var pubKey = req.headers.pubkey;    //must be lower case
    var msgSig = req.headers.sig;

    var calcHash = uti.hash(JSON.stringify(req.body));
    var sigConfirmed = uti.verifySig(msgSig,pubKey,hash);

    if (calcHash!=hash) {
      respMsg = 'Data tampered with.';
      cb(resp,respMsg);
    }
    else if (!sigConfirmed) {
      respMsg = 'Signature Forged.';
      cb(resp,respMsg);
    }
    else {
      switch (type) {
        case 'external':
          meth(req,resp,cb);
          break;
        case 'internal':
          var sP = "select * from peers where id='" + pubKey + "';";

          uti.bulkSQL(sP,'series',(res) => {
            if (res[0].rows.length == 0) {
              respMsg = 'Peer (' + pubKey + ') not in network.';
              cb(resp,respMsg);
            }
            else {
              meth(req,resp,cb);
            }
          });
          break;
        case 'self':
          var sP = "select * from peers where id='" + pubKey + "' and connected=2;";

          uti.bulkSQL(sP,'series',(res) => {
            if (res[0].rows.length == 0) {
              respMsg = 'Peer (' + pubKey + ') not approved; host only feature.';
              cb(resp,respMsg);
            }
            else {
              meth(req,resp,cb);
            }
          });
          break;
      }
    }
  }

  optionGen(destIp,payload,type,trace) {
    trace.push(this.ip);
    var bodyString = JSON.stringify({ data : payload });
    var options = {
      url : 'http://' + destIp + ':8080' + '/api',
      headers : {
          'content-type' : 'application/json',
          'hash': uti.hash(bodyString),
          'pubKey': this.pubKey,
          'sig': uti.sign(uti.hash(bodyString), this.privKey),
          'ip_trace':'[' + trace.join(',') + ']',
          'ip_dest': this.ip,
          'hostName': this.hostName,
          'alive': 0,
          'type' : type
        },
      body: bodyString
    };
    console.log(options);
    return options;
  }
};
