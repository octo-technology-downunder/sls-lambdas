const AWS = require('aws-sdk');
const settings = require('../commonSettings.json').notifications.email;

function sendEmail(subject, body, customSettings) {
    Object.assign(settings, customSettings);
    if (!settings.notify){
        return Promise.resolve();
    }

    const params = {
        Destination: { ToAddresses: settings.emails },
        Source: settings.source,
        ReplyToAddresses: settings.replyTo,
        Message: {
            Subject: { Data: subject, Charset: settings.charSet },
            Body: { Html: { Data: body, Charset: settings.charSet } }
        }
    };
    const ses = new AWS.SES();
    return ses.sendEmail(params).promise();
}

module.exports = {
    sendEmail
};