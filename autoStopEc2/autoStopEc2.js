'use strict';
const AWS = require('aws-sdk');
const {
    sendMailNotification,
    sendSlackNotification,
    getTagValue,
    isAutoStopDisabled,
    extractRunningInstances,
    extractInstancesToStop,
    isAutoStopEnabled,
    lookupUserThatActionedResource,
    mapAWStoSLACKuser,
    log
} = require('../lib/ec2_rds');

const settings = require('../commonSettings.json');
const tags = settings.instances.tags;
const emails = settings.notifications.email.emails; // verify email address here: https://console.aws.amazon.com/ses/home?region=us-east-1#verified-senders-email:

/* /!\ /!\ READ THIS IF DEVELOPING /!\ /!\ */
const dryDelete = settings.instances.ec2.dryRun; // set to true when testing during the day, some instance are running and we don't want to delete them.
/* /!\ /!\ READ THIS IF DEVELOPING /!\ /!\ */

function getEC2InstancesDetails(context) {
    const instances = context.allInstancesToStop;
    let message = '';
    for (let i = 0; i < instances.length; i++) {
        const instance = instances[i];
        if (instance.InstanceId === null) {
            continue;
        }
        message += '<h4>Instance: ' + instance.InstanceId + '</h4>';
        message += '<ul>';
        message += '<li><strong>Region:</strong> ' + (instance.Placement !== null ? instance.Placement.AvailabilityZone : null) + '</li>';

        const name = getTagValue(instance, tags.name);
        if (name) {
            message += '<li><strong>Name:</strong> ' + name + '</li>';
        } else {
            message += '<li><strong>Name:</strong> <em>NULL</em>. <span style="color: red; "><strong>This instance has no name, please add a "Name TAG"</strong></span></li>';
        }

        message += '<li><strong>Type:</strong> ' + instance.InstanceType + '</li>';
        message += '<li><strong>LaunchTime:</strong> ' + instance.LaunchTime + '</li>';
        message += '<li><strong>KeyName:</strong> ' + instance.KeyName + '</li>';

        if (isAutoStopEnabled(instance)) {
            message += '<li>Tag <strong>AutoStop=true</strong> found! <br> <br><strong><span style="color: green; ">This instance has been automatically stopped, no action is needed :)</span></strong></li>';
        } else if (isAutoStopDisabled(instance)) {
            message += '<li>Tag <strong>AutoStop=false</strong> found! <br> <br><strong><span style="color: blue; ">This instance has NOT been automatically stopped</span></strong></li>';
        } else {
            message += '<li>Tag <strong>AutoStop</strong> NOT FOUND :( <br> <br><strong><span style="color: #a7a70f; ">This instance has been automatically stopped, no action is needed :)</span></strong></li>';
        }
        message += '</ul> <br /> \n';
    }
    return message;
}


function stopEC2Instances(ec2, region, instances) {
    const instanceIds = instances.map(instance => instance.InstanceId);
    log('INFO', 'INSTANCES TO STOP IN THE REGION' + region, instanceIds);
    if (instanceIds.length === 0) {
        return Promise.resolve([]);
    }
    return ec2.stopInstances({DryRun: dryDelete, InstanceIds: instanceIds}).promise()
        .then(result => result.StoppingInstances);
}


function getRunningInstancesByRegion(region) {
    const ec2 = new AWS.EC2({region: region});
    const promise = ec2.describeInstances({DryRun: dryDelete}).promise();
    return promise
        .then(response => {
            const resultInternal = [];
            const instances = extractRunningInstances(response);
            for (let i = 0; i < instances.length; i++) {
                const instance = instances[i];
                if (instance.InstanceId !== null) {
                    resultInternal.push(instance);
                }
            }
            return Promise.resolve({ec2: ec2, region: region, instances: resultInternal});
        });
}

function sendNotifications(context) {
    return Promise.all([
        sendSlack(context),
        sendMailNotification(settings.instances.ec2.serviceType, getEC2InstancesDetails(context), emails)
    ]);
}


function sendSlack(context) {

    function aggregateByUsers(usersForInstances) {
        return usersForInstances.reduce((aggUsers, nextItem) => {
            let currentUser = aggUsers.find(user => user.userName === nextItem.userName);
            if (!currentUser) {
                currentUser = {userName: nextItem.userName, regions: []};
                aggUsers.push(currentUser);
            }
            let currentRegion = currentUser.regions.find(region => region.region === nextItem.region);
            if (!currentRegion) {
                currentRegion = {region: nextItem.region, instances: []};
                currentUser.regions.push(currentRegion);
            }
            currentRegion.instances.push(nextItem.instance);
            return aggUsers;
        }, []);
    }

    let messages = [];

    const messageAllInstancesToInfra = sendSlackNotification(
        settings.instances.ec2.serviceType,
        getEC2InstancesSlackAttachments(context.allInstancesToReport, context));
    messages.push(messageAllInstancesToInfra);

    const _aggUsers = aggregateByUsers(context.usersForInstances);
    const messagesForIndividualUsers = _aggUsers.map(user => {
        const userId = mapAWStoSLACKuser(user.userName);
        return sendSlackNotification(
            settings.instances.ec2.serviceType,
            getEC2InstancesSlackAttachments(user.regions, context),
            {channel: userId}
        );
    });
    messages = messages.concat(messagesForIndividualUsers);

    return Promise.all(messages);
}

function getEC2InstancesSlackAttachments(instancesToReport, context) {


    function getAttachmentForInstance(instance, slackUser) {
        const isInstanceAutoStoppable = !isAutoStopDisabled(instance);
        const nameTag = getTagValue(instance, tags.name);
        return {
            title: (nameTag ? nameTag : ('Tag ' + tags.name + ' not found!')),
            text: getSlackTextForInstance(instance, isInstanceAutoStoppable, slackUser),
            footer: isInstanceAutoStoppable ? 'This instance has been automatically stopped, no action is needed' : 'This instance is AutoStop proof',
            footer_icon: isInstanceAutoStoppable ? settings.notifications.slack.imgRemoved : settings.notifications.slack.imgLocked
        };
    }

    function getSlackTextForInstance(instance, isInstanceAutoStoppable, userName) {
        const autoStopTag = getTagValue(instance, tags.autoStop);
        const userDetails = isInstanceAutoStoppable ? (', started by <' + userName) + '>' : '';
        return 'ID: ' + instance.InstanceId + userDetails + '\n' +
            (autoStopTag ? (tags.autoStop + '=' + autoStopTag) : ('Tag ' + tags.autoStop + ' not found!'));
    }


    const attachments = [];
    instancesToReport.forEach(region => {
        let isFirstInstanceInRegion = true;
        region.instances.forEach(instance => {
            const awsUser = context.usersForInstances.find(user => user.instanceId === instance.InstanceId);
            const slackUser = awsUser ? mapAWStoSLACKuser(awsUser.userName) : settings.users.unknownUser;
            const attachment = getAttachmentForInstance(instance, slackUser);
            if (isFirstInstanceInRegion) {
                attachment.pretext = 'Region: ' + region.region;
                isFirstInstanceInRegion = false;
            }
            attachments.push(attachment);
        });
    });
    return attachments;
}

function extractUsersForInstances(context) {
    const usersForInstances = [];
    context.allInstancesToReport.forEach(region => {
        region.instances.forEach(instance => {
            const users = lookupUserThatActionedResource(
                region.region,
                ['StartInstances', 'RunInstances'],
                instance.InstanceId,
                instance);
            usersForInstances.push(users);
        });
    });
    return Promise.all(usersForInstances);
}

exports.handler = function (event, context, callback) {
    const ec2 = new AWS.EC2();
    const promise = ec2.describeRegions({DryRun: dryDelete}).promise();
    return promise
        .then((data) => {
            const promises = data.Regions.map(region => {
                return getRunningInstancesByRegion(region.RegionName)
            });
            return Promise.all(promises);
        })
        .then((instancesByRegions) => {
            context.allInstancesToReport = instancesByRegions;
            context.allInstancesToStop = [];
            const promises = instancesByRegions.map(instancesOfOneRegion => {
                const instancesToStop = extractInstancesToStop(instancesOfOneRegion.instances);
                instancesToStop.forEach(instance => context.allInstancesToStop.push(instance));
                return stopEC2Instances(instancesOfOneRegion.ec2, instancesOfOneRegion.region, instancesToStop);
            });
            return Promise.all(promises);
        })
        .then(() => {
            return context.allInstancesToStop.length > 0 ?
                extractUsersForInstances(context) :
                Promise.resolve();
        })
        .then((users) => {
            if (context.allInstancesToStop.length > 0) {
                context.usersForInstances = users ? users : [];
                return sendNotifications(context);
            } else {
                return Promise.resolve();
            }
        })
        .then(() => {
            callback(null, 'Function has completed successfully');
        }).catch(err => {
            log('ERROR', 'ALL', err);
            callback('Function execution has failed\n' + err.stack);
        });
};
