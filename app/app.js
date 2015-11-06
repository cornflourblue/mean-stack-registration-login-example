(function () {
    'use strict';

    angular
        .module('app', ['ui.router', 'ngStorage'])
        .config(config)
        .run(run);

    function config($stateProvider, $urlRouterProvider) {
        // default route
        $urlRouterProvider.otherwise("/");

        $stateProvider
            .state('home', {
                url: '/',
                templateUrl: 'home/index.html',
                controller: 'Home.IndexController',
                controllerAs: 'vm'
            })
            .state('account', {
                url: '/account',
                templateUrl: 'account/index.html',
                controller: 'Account.IndexController',
                controllerAs: 'vm'
            });
    }

    function run($http) {
        // get JWT token from server
        $http.get('/app/token').then(function (res) {
            $http.defaults.headers.common['Authorization'] = 'Bearer ' + res.data;
        });
    }

})();