var express = require('express');
var app = express();
var session = require('express-session');
var bodyParser = require('body-parser');

var sessionSecret = 'REPLACE THIS WITH YOUR OWN SECRET, IT CAN BE ANY STRING';

app.set('view engine', 'ejs');
app.set('views', __dirname + '/views');
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());
app.use(session({ secret: sessionSecret, resave: false, saveUninitialized: true }));

// custom middleware
app.use(require('./middleware/api-url'));

// routes
app.use('/login', require('./controllers/login.controller'));
app.use('/register', require('./controllers/register.controller'));
app.use('/app', require('./controllers/app.controller'));
app.use(require('./api-routes'));

// make '/app' default route
app.get('/', function (req, res) {
    return res.redirect('/app');
});

// start server
var server = app.listen(3000, function () {
    console.log('Server listening at http://' + server.address().address + ':' + server.address().port);
});