const AWS = require('aws-sdk');
const slackMessenger = require('./slackMessenger');
const emailMessenger = require('./emailMessenger');

const {loadSettings} = require("./envLoader");
const commonSettings = loadSettings();
const tags = commonSettings.instances.tags;

function sendMailNotification(serviceType, instanceDetails) {
    if (instanceDetails === '') {
        log('INFO', 'EMAIL', 'Nothing to send');
        return;
    }
    let message = 'Hi Guys, these AWS ' + serviceType + ' instances are running, please stop them if they are not used:\n' + instanceDetails + ' <br><br> \n';
    message += '<em>I\'am a Lambda function, if you want to contribute, please edit me!</em> <br><br> \n';
    message += 'Cheers,<br>\n';
    message += 'Francky, your AWS Janitor!<br>\n';

    const subject = '[AWS JANITOR] Some ' + serviceType + ' instances are RUNNING!';

    return emailMessenger.sendEmail(subject, message);

}

function sendSlackNotification(serviceType, attachments, customSettings){
    const header = 'Hi Guys, these AWS ' + serviceType + ' instances are running, please stop them if they are not used';
    return slackMessenger.sendSlackWebhook(header, attachments, customSettings);
}

function getTagValue(instance, tagName) {
    if (!instance.Tags || instance.Tags.length === 0) {
        return false;
    }
    for (let i = 0; i < instance.Tags.length; i++) {
        let tag = instance.Tags[i];
        if (tag.Key === tagName) {
            return tag.Value;
        }
    }
    return null;
}

function hasTag(instance, tagName, tagValue) {
    if (!instance.Tags || instance.Tags.length === 0) {
        return false;
    }
    for (let i = 0; i < instance.Tags.length; i++) {
        let tag = instance.Tags[i];
        if (tag.Key === tagName && tag.Value === tagValue) {
            return true;
        }
    }
    return false;
}

function isAutoStopDisabled(instance) {
    return hasTag(instance, tags.autoStop, tags.OFF_value);
}

function isAutoStopEnabled(instance) {
    return hasTag(instance, tags.autoStop, tags.ON_value);
}

function isAutoStartEnabled(instance) {
    return hasTag(instance, tags.autoStart, tags.ON_value);
}

function extractRunningInstances(data) {
    return extractEC2InstancesByStatus(data, 'running');
}

function extractStoppedInstances(data) {
    return extractEC2InstancesByStatus(data, 'stopped');
}

function extractEC2InstancesByStatus(data, status) {
    let instances = [];
    for (let i = 0; i < data.Reservations.length; i++) {
        const Instances = data.Reservations[i].Instances;
        for (let j = 0; j < Instances.length; j++) {
            if (Instances[j].State.Name === status) {
                instances.push(Instances[j]);
            }
        }
    }
    return instances;
}

function extractInstancesToStop(instances) {
    return instances.filter(instance => !isAutoStopDisabled(instance));
}

function flatArray(array){
    if (!array){
        return [];
    } else {
        return array.reduce((a,b) => a.concat((Array.isArray(b) ? b : [])), []);
    }
}


function log(type, region, obj) {
    console.log('[' + type + '][' + region + '] ' + ((obj instanceof Error) ? obj.stack : JSON.stringify(obj)) + '\n');
}

function lookupUserThatActionedResource(region, actionsList, isntanceId, instance){
    let throttlingCounter = 1;
    function isEventFount(eventName){
        if (!actionsList){
            actionsList = [];
        }
        return !!actionsList.find(action => action === eventName);
    }

    function getEventUsername(ct, instanceId, data) {
        const params = {
            LookupAttributes: [
                {
                    AttributeKey: 'ResourceName',
                    AttributeValue: instanceId
                }
            ],
            MaxResults: 10
        };
        if (data) {
            params.NextToken = data.NextToken;
        }

        let promise = Promise.resolve();
        if (throttlingCounter > 0){
            promise = promise
                .then(() => new Promise(resolve => setTimeout(() => resolve(), 2000)))
                .then(() => throttlingCounter = 0);
        }
        return promise
            .then(() => ct.lookupEvents(params).promise())
            .then(data => {
                throttlingCounter++;
                const userName = extractInstanceStarterName(data.Events);
                return (!userName && data.NextToken) ?
                    getEventUsername(ct, instanceId, data) :
                    {region: ct.config.region, instanceId: instanceId, userName: userName, instance: instance};
            });
    }

    function extractInstanceStarterName(events) {
        const startEvent = events.find(event => isEventFount(event.EventName));
        return startEvent ? startEvent.Username : startEvent;
    }

    const ct = new AWS.CloudTrail({region: region});

    return getEventUsername(ct, isntanceId);
}


function mapAWStoSLACKuser(awsUser){
    const match = commonSettings.users.AWStoSlackUsersMap.find(user => user.awsId === awsUser);
    return match ? '@' + match.slackId : awsUser;
}

module.exports = {
    sendMailNotification,
    sendSlackNotification,
    getTagValue,
    isAutoStopDisabled,
    isAutoStopEnabled,
    isAutoStartEnabled,
    extractRunningInstances,
    extractStoppedInstances,
    extractInstancesToStop,
    flatArray,
    mapAWStoSLACKuser,
    log,
    lookupUserThatActionedResource
};
