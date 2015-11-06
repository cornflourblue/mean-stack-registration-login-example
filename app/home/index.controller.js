(function () {
    'use strict';

    angular
        .module('app')
        .controller('Home.IndexController', Controller);

    function Controller(UserService) {
        var vm = this;

        vm.username = null;

        UserService.GetCurrent().then(function (username) {
            vm.username = username;
        });
    }

})();