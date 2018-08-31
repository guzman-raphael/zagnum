// web app RG

var express    = require('express');        // call express
var app        = express();                 // define our app using express
var bodyParser = require('body-parser');

var p2p = require('./peer-network.js');
var PeerA = new p2p.Peer();

app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

var port = process.env.PORT || 8080;        // set our port
app.set('port', port);
var router = express.Router();              // get an instance of the express Router

router.get('/', function(req, resp) {
  // PeerA.newData();
});

router.post('/', function(req, resp) {

    PeerA.processReq(req,resp,(r,msg) => {
      r.json({ result: msg });
    });

});

app.use('/api', router);

app.listen(app.get('port'), function() {
  console.log('app is up.');
});
