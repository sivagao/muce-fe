define(function() {
    return function($scope, apiHelper) {

        $scope.queryUserJobList = function() {
            apiHelper('getJobList', {
                params: {
                    user: $scope.userName
                }
            }).then(function(data) {
                $scope.jobList = data ? data.reverse() : [];
            });
        }
    }
});