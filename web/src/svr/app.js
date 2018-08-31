// web app

var express = require('express');

var app = express();

// app.session = {};

app.set('port', process.env.PORT || 8080);

app.use(express.static(__dirname + '/../fe' + '/build/es6-bundled'));

app.get('/', function(req, res) {
  res.sendFile('index.html', {root: __dirname + '/../fe'});
  // res.send('hi_there');
})

app.listen(app.get('port'), function() {
  console.log('app is up.');
});
