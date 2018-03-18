const {loadSettings} = require("../lib/envLoader");
exports.handler = function (event, context, callback) {
    console.log('EVENT: ' + JSON.stringify(event));
    console.log('CONTEXT: ' + JSON.stringify(context));
    console.log('settings: ' + JSON.stringify(loadSettings()));
    callback(null, "SUCCESS");
};