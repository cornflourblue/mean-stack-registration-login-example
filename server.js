var express = require('express');
var session = require('express-session');
var path = require('path');
var bodyParser = require('body-parser');
var request = require('request');
var bcrypt = require('bcryptjs');
var _ = require('lodash');
var jwt = require('jsonwebtoken');
var expressJwt = require('express-jwt');
var Q = require('q');
var mongo = require('mongodb');
var monk = require('monk');
var db = monk('localhost:27017/switchboard2');

var secret = 'REPLACE THIS WITH YOUR OWN SECRET, IT CAN BE ANY STRING';

var app = express();
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());
app.use(session({ secret: secret, resave: false, saveUninitialized: true }));

/* PUBLIC ROUTES
---------------------------------*/
// login
app.get('/login', function (req, res) {
    // log user out
    delete req.session.token;

    // move success message into local variable so it only appears once (single read)
    var viewData = { success: req.session.success };
    delete req.session.success;

    res.render(__dirname + '/public/login.ejs', viewData);
});

app.post('/login', function (req, res) {
    request.post({
        url: apiUrl(req) + '/authenticate',
        form: req.body,
        json: true
    }, function (error, response, body) {
        if (error) {
            return res.render(__dirname + '/public/login.ejs', { error: 'An error occurred' });
        }

        if (!body.token) {
            return res.render(__dirname + '/public/login.ejs', { error: 'Username or password is incorrect', username: req.body.username });
        }

        // save JWT token in the session to make it available to the angular app
        req.session.token = body.token;

        // redirect to returnUrl
        var returnUrl = req.query.returnUrl && decodeURIComponent(req.query.returnUrl) || '/';
        res.redirect(returnUrl);
    });
});

// register
app.get('/register', function (req, res) {
    res.render(__dirname + '/public/register.ejs');
});

app.post('/register', function (req, res) {
    request.post({
        url: apiUrl(req) + '/users/register',
        form: req.body,
        json: true
    }, function (error, response, body) {
        if (error) {
            return res.render(__dirname + '/public/register.ejs', { error: 'An error occurred' });
        }

        if (response.statusCode !== 200) {
            return res.render(__dirname + '/public/register.ejs', {
                error: response.body,
                firstName: req.body.firstName,
                lastName: req.body.lastName,
                username: req.body.username
            });
        }

        // return to login page with success message
        req.session.success = 'Registration successful';
        return res.redirect('/login');
    });
});


/* APP ROUTES
---------------------------------*/
app.use('/app', function (req, res, next) {
    // use session auth to secure the client app files
    if (req.path !== '/login' && !req.session.token) {
        return res.redirect('/login?returnUrl=' + encodeURIComponent('/app' + req.path));
    }

    next();
});

// make JWT token available to angular app
app.get('/app/token', function (req, res) {
    res.send(req.session.token);
});

// serve app files from the '/app' route
app.use('/app', express.static('app'));

// make the '/app' route the default path
app.get('/', function (req, res) {
    return res.redirect('/app');
});


/* API ROUTES
---------------------------------*/
// use JWT auth to secure the api
app.use('/api', expressJwt({ secret: secret }).unless({ path: ['/api/authenticate', '/api/users/register'] }));

// authenticate user
app.post('/api/authenticate', function (req, res) {
    var usersDb = db.get('users');

    usersDb.findOne({ username: req.body.username }, function (err, user) {
        if (err) throw err;

        if (user && bcrypt.compareSync(req.body.password, user.hash)) {
            // authentication successful
            return res.send({ token: jwt.sign({ sub: user._id }, secret) });
        }

        // authentication failed
        res.sendStatus(401);
    });
});

// register user
app.post('/api/users/register', function (req, res) {
    var usersDb = db.get('users');

    // validate then create user
    validateUser().then(createUser);

    function validateUser() {
        var deferred = Q.defer();

        // validation
        usersDb.findOne(
            { username: req.body.username },
            function (err, user) {
                if (err) throw err;

                if (user) {
                    // username already exists
                    return res.status(400).send('Username "' + req.body.username + '" is already taken');
                } else {
                    deferred.resolve();
                }
            });

        return deferred.promise;
    }

    function createUser() {
        // set user object to req.body without the cleartext password
        var user = _.omit(req.body, 'password');

        // add hashed password to user object
        user.hash = bcrypt.hashSync(req.body.password, 10);

        users.insert(
            user,
            function (err, doc) {
                if (err) throw err;

                res.sendStatus(200);
            });
    }
});

// get current user
app.get('/api/users/current', function (req, res) {
    var userId = req.user.sub;
    var usersDb = db.get('users');

    usersDb.findById(
        userId,
        function (err, user) {
            if (err) throw err;

            if (user) {
                // return user (without hashed password)
                return res.send(_.omit(user, 'hash'));
            }

            // user not found
            res.sendStatus(404);
        });
});

// update current user
app.put('/api/users/current', function (req, res) {
    var userId = req.user.sub;
    var usersDb = db.get('users');

    // validate then update user
    validateUser().then(updateUser);

    function validateUser() {
        var deferred = Q.defer();

        // validation
        usersDb.findById(
            userId,
            function (err, user) {
                if (err) throw err;

                if (user.username !== req.body.username) {
                    // username has changed so check if the new username is already taken
                    usersDb.findOne(
                        { username: req.body.username },
                        function (err, user) {
                            if (err) throw err;

                            if (user) {
                                // username already exists
                                return res.status(400).send('Username "' + req.body.username + '" is already taken');
                            } else {
                                deferred.resolve();
                            }
                        });
                } else {
                    deferred.resolve();
                }
            });

        return deferred.promise;
    }

    function updateUser() {
        // fields to update
        var set = {
            firstName: req.body.firstName,
            lastName: req.body.lastName,
            username: req.body.username,
        };

        // update password if it was entered
        if (req.body.password) {
            set.hash = bcrypt.hashSync(req.body.password, 10);
        }

        usersDb.findAndModify(
            { _id: userId },
            { $set: set },
            function (err, doc) {
                if (err) throw err;

                res.sendStatus(200);
            });
    }
});


/* START SERVER
---------------------------------*/
var server = app.listen(3000, function () {
    var host = server.address().address;
    var port = server.address().port;

    console.log('Server listening at http://%s:%s', host, port);
});


/* HELPER FUNCTIONS
---------------------------------*/
function apiUrl(req) {
    return req.protocol + '://' + req.get('host') + '/api';
}