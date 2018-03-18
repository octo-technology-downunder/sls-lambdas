const defaultSettings = require("../commonSettings.json");

exports.loadSettings = function() {
    return process.env.CommonSettings ?
        JSON.parse(process.env.CommonSettings) :
        defaultSettings;
};