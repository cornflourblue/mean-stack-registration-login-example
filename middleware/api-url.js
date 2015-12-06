module.exports = apiUrl;

function apiUrl(req, res, next) {
    // make api url available to the rest of the application
    req.apiUrl = req.protocol + '://' + req.get('host') + '/api';

    next();
}