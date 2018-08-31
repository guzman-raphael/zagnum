// Module to support crypto operations and psql operations. RG
const { Client } = require('pg');
var async = require('async');
const crypto = require('crypto');
const NodeRSA = require('node-rsa');

var pg_user = 'postgres';
var pg_secret = '';
var pg_host = process.env.DB;
var pg_port = '5432';
var pg_db = 'postgres';

exports.utilFuncs = class {
  // Construct
  constructor() {
  }

  // Props

  // Methods
  static hash(msg) {
    const hashed = crypto.createHash('sha256')
                  .update(msg)
                  .digest('hex');
    return hashed;
  }

  static verifySig(msgSig,pubKey,calcHash){
    const key = new NodeRSA();
    var buf = Buffer.from(pubKey, 'base64');
    key.importKey(buf, 'pkcs1-public-der');
    pubKey = key.exportKey('public');

    var buff = Buffer.from(msgSig, 'hex');
    var verified;
    try {
      const verifier = crypto.createVerify('sha256');
      verifier.update(calcHash);
      verifier.end();

      verified = verifier.verify(pubKey, buff);
    }
    catch(err) {
      verified = false;
    }

    return verified;
  }

  static sign(msg,priv) {
    const key = new NodeRSA();
    var buf = Buffer.from(priv, 'base64');
    key.importKey(buf, 'pkcs1-private-der');
    priv = key.exportKey('private');

    const signer = crypto.createSign('sha256');
    signer.update(msg);
    signer.end();

    const signature = signer.sign(priv);

    return signature.toString('hex');
  }

  static genPair() {
    const key = new NodeRSA({b: 2048, e: 65537});

    var priv = key.exportKey('pkcs1-private-der');
    var pub = key.exportKey('pkcs1-public-der');
    priv  = new Buffer(priv , 'binary').toString('base64');
    pub  = new Buffer(pub , 'binary').toString('base64');

    return [pub,priv];
  }

  static queryGen(data,filterVal,tbName) {
    var query = "";
    var subData = data.filter(function(obj) {
      if(obj.type != filterVal) {
        return false;
      }
      return true;
    });

    if (subData.length > 0) {
      var fields = [];
      subData.forEach(function(element) {
        fields = fields.concat(Object.keys(element));
      });
      fields = [...new Set(fields)];
      fields.sort(function(a, b){
          if(a < b) return -1;
          if(a > b) return 1;
          return 0;
      });

      var currVal;
      var query = query + "insert into " + tbName + " (";
      for(var i=0; i<subData.length; i++) {
        query = query + "select ";
        for(var j=0; j<fields.length; j++) {
          if ( filterVal == 'peer' && fields[j] == 'connected') {
            currVal = 0;
          }
          else {
            currVal = subData[i][fields[j]];
          }
          if ( typeof currVal !== 'undefined' )
          {
            if ( isNaN(currVal) ) {
              if ((currVal.match(/-/g)||[]).length == 2 && (currVal.match(/:/g)||[]).length == 2 && (currVal.match(/\./g)||[]).length == 1) {
                query = query + "to_timestamp('" + currVal + "', 'YYYY-MM-DD\"T\"HH24:MI:SS.MS\"Z\"'),";
              }
              else {
                query = query + "'" + currVal + "',";
              }
            }
            else {
              query = query + currVal + ",";
            }
          }
          else {
            query = query + "'" + currVal + "',";
          }
        }
        query = query.substring(0,query.length-1);
        query = query + " union ";
      }
      query = query.substring(0,query.length-7);
      query = query + ") except select * from " + tbName + ";";
    }
    return query;
  }

  static bulkSQL(bulkCmds,type,cb) {
    var cmdArray = bulkCmds.split(';');
    cmdArray.pop();
    switch (type) {
      case 'series':
        var initFunc = function (callback) {
          var resArray = [];
          var client = new Client("postgres://" + pg_user + ":" + pg_secret + "@" + pg_host + ":" + pg_port + "/" + pg_db);
          client.connect();
          var values = [];
          callback(null,resArray,client,values);
        }

        var funcArray = [];
        var currFunc;

        for (var i=0; i<cmdArray.length; i++) {
          currFunc = function (resArray,client,values,callback) {
            client.query(cmdArray[resArray.length], values, (err, res) => {
              resArray.push(res);
              callback(null,resArray,client,values);
            });
          };
          funcArray.push(currFunc);
        }

        async.waterfall([initFunc].concat(funcArray), function (err,result,client,values) {
            client.end();
            cb(result);
        });
        break;
      case 'parallel':
        var cmp = 0;
        var values = [];
        var resArray = [];
        var client = new Client("postgres://" + pg_user + ":" + pg_secret + "@" + pg_host + ":" + pg_port + "/" + pg_db);
        client.connect();

        for (var i=0; i<cmdArray.length; i++) {
          // console.log(cmdArray[i]);
          client.query(cmdArray[i], values, (err, res) => {
            resArray.push(res);
            cmp+=1;
            if (cmp == cmdArray.length) {
              client.end();
              cb(resArray);
            }
          });
        };
        break;
    }
  }
}
