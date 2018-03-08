const Slack = require('slack-node');
const {promisify} = require('es6-promisify');

const settings = require('../commonSettings').notifications.slack;
const slack = new Slack();

function sendSlackWebhook(text, attachments, customSettings) {
    if (!settings.notify){
        return Promise.resolve();
    }
    Object.assign(settings, customSettings);
    attachments.push({
        color: settings.footerColor,
        title: settings.footerTitle,
        footer: settings.footer,
        footer_icon: settings.footerIcon
    });
    slack.setWebhook(settings.webhookUri);
    return promisify(slack.webhook)({
        channel: settings.channel,
        username: settings.botName,
        icon_emoji: settings.messageEmoji,
        link_names: 1,
        text: text,
        attachments: attachments
    });
}

module.exports = {
    sendSlackWebhook
};