var express = require('express');
var app = express();

// routes
app.use(require('./app-routes'));
app.use(require('./api-routes'));

// start server
var server = app.listen(3000, function () {
    var host = server.address().address;
    var port = server.address().port;

    console.log('Server listening at http://%s:%s', host, port);
});