const AWS = require('aws-sdk');
const slackMessenger = require('../lib/slackMessenger');
const emailMessenger = require('../lib/emailMessenger');
const {
    isAutoStartEnabled,
    extractStoppedInstances,
    getTagValue,
    flatArray,
    log
} = require('../lib/ec2_rds');

const settings = require('../commonSettings.json');
const tags = settings.instances.tags;
const dryRunFlag = settings.instances.ec2.dryRun;

function sendNotifications(context) {
    return Promise.all([
        sendSlackNotification(context),
        sendEmailNotification(context)
    ]);
}


function resultsToMessage(instancesByRegion) {
    let message = '';
    instancesByRegion.forEach(region => {
        region.autoStartableInstances.forEach(instance => {
            message += '<h4>Instance: ' + instance.InstanceId + '</h4>';
            message += '<ul>';
            message += '<li><strong>Region:</strong> ' + region.ec2.config.region + '</li>';
            const name = getTagValue(instance, tags.name);
            if (name) {
                message += '<li><strong>Name:</strong> ' + name + '</li>';
            } else {
                message += '<li><strong>Name:</strong> <em>NULL</em>. <span style="color: red; "><strong>This instance has no name, please add a "Name TAG"</strong></span></li>';
            }
            message += '<li><strong>Type:</strong> ' + instance.InstanceType + '</li>';
            message += '<li><strong>LaunchTime:</strong> ' + instance.LaunchTime + '</li>';
            message += '<li>Tag <strong>AutoStart=true</strong> found! <br> <br><strong><span style="color: green; ">This instance has been automatically started.</span></strong></li>';
            message += '</ul> <br /> \n';
        });
    });
    return message;
}

function sendEmailNotification(context) {
    const instanceDetails = resultsToMessage(context.allInstancesToStart);
    let message = 'Hi Guys, theses AWS instances have been automatically started.  If this is not necessary, please remove their AutoStart tag :\n' + instanceDetails + ' <br><br> \n';
    message += '<em>I\'am a Lambda function, if you want to contribute, please edit me!</em> <br><br> \n';
    message += 'Cheers,<br>\n';
    message += 'Francky, your AWS Janitor!<br>\n';
    const subject = '[AWS JANITOR] Some instances have been started';
    return emailMessenger.sendEmail(subject, message);
}

function sendSlackNotification(context){
    const header = 'Hi Guys, following AWS instances have been automatically started\nUpdate ' + tags.autoStart + ' tag if auto start is not required';
    const attachments = getSlackAttachments(context);
    return slackMessenger.sendSlackWebhook(header, attachments);
}

function getSlackAttachments(context){
    const instancesToReport = context.allInstancesToStart;
    const attachments = [];
    instancesToReport.forEach(region => {
        let isFirstInstanceInRegion = true;
        region.autoStartableInstances.forEach(instance => {
            const attachment = getAttachmentForInstance(instance);
            if (isFirstInstanceInRegion){
                attachment.pretext = 'Region: ' + region.ec2.config.region;
                isFirstInstanceInRegion = false;
            }
            attachments.push(attachment);
        });
    });
    return attachments;
}

function getAttachmentForInstance(instance){
    const nameTag = getTagValue(instance, tags.name);
    return {
        title: (nameTag ? nameTag : ('Tag ' + tags.name + ' not found!')),
        text: 'ID: ' + instance.InstanceId
    };
}

function extractInstancesToStart(instances) {
    return instances.filter(instance => isAutoStartEnabled(instance) && instance.InstanceId);
}

function getInstancesToStartByRegion(region, context) {
    const ec2 = new AWS.EC2({region: region});
    const promise = ec2.describeInstances({DryRun: dryRunFlag}).promise();
    return promise
        .then(response => {
            const stoppedInstances = extractStoppedInstances(response);
            const autoStartableInstances = extractInstancesToStart(stoppedInstances);
            context.allInstancesToStart.push({ec2: ec2, autoStartableInstances: autoStartableInstances});
            return Promise.resolve();
        });
}

function startInstancesByRegion(ec2, instances) {
    const instancesIdsToStart = instances.map(instance => instance.InstanceId);
    return instancesIdsToStart.length > 0 ?
        ec2.startInstances({DryRun: dryRunFlag, InstanceIds: instancesIdsToStart}).promise() :
        Promise.resolve();
}

exports.handler = function (event, context) {
    const ec2 = new AWS.EC2();
    context.allInstancesToStart = [];
    ec2.describeRegions({DryRun: dryRunFlag}).promise()
        .then(data => {
            const promises = data.Regions.map(region => {
                return getInstancesToStartByRegion(region.RegionName, context);
            });
            return Promise.all(promises);
        })
        .then(() => {
            const promises = context.allInstancesToStart.map(region => {
                return startInstancesByRegion(region.ec2, region.autoStartableInstances);
            });
            return Promise.all(promises);
        })
        .then(() => {
            const flatInstancesToStart = flatArray(context.allInstancesToStart.map(region => region.autoStartableInstances));
            return flatInstancesToStart.length > 0 ?
                sendNotifications(context) :
                Promise.resolve();
        })
        .then(() => {
            context.succeed('Function has completed successfully');
        }).catch(err => {
        log('ERROR', 'ALL', err);
        context.fail('Function execution has failed');
    });

};
