var express = require('express');
var router = express.Router();

var bcrypt = require('bcryptjs');
var _ = require('lodash');
var jwt = require('jsonwebtoken');
var expressJwt = require('express-jwt');
var Q = require('q');
var mongo = require('mongodb');
var monk = require('monk');
var db = monk('localhost:27017/switchboard2');

var secret = 'REPLACE THIS WITH YOUR OWN SECRET, IT CAN BE ANY STRING';

// use JWT auth to secure the api
router.use('/api', expressJwt({ secret: secret }).unless({ path: ['/api/authenticate', '/api/users/register'] }));

// authenticate user
router.post('/api/authenticate', function (req, res) {
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
router.post('/api/users/register', function (req, res) {
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

        usersDb.insert(
            user,
            function (err, doc) {
                if (err) throw err;

                res.sendStatus(200);
            });
    }
});

// get current user
router.get('/api/users/current', function (req, res) {
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

// update user
router.put('/api/users/:_id', function (req, res) {
    var userId = req.user.sub;
    var usersDb = db.get('users');

    if (req.params._id !== userId) {
        // can only update own account
        return res.status(401).send('You can only update your own account');
    }

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

// delete user
router.delete('/api/users/:_id', function (req, res) {
    var userId = req.user.sub;
    var usersDb = db.get('users');

    if (req.params._id !== userId) {
        // can only delete own account
        return res.status(401).send('You can only delete your own account');
    }

    usersDb.remove(
        { _id: req.params._id },
        function (err) {
            if (err) throw err;

            res.sendStatus(200);
        });
});

module.exports = router;