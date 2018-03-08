'use strict';
const AWS = require('aws-sdk');
const {
    sendMailNotification,
    sendSlackNotification,
    flatArray,
    log
} = require('../lib/ec2_rds');
const settings = require('../commonSettings.json');
const tags = settings.instances.tags;

function getRDSInstancesEmailDetails(instancesWithTags) {
    let message = '';
    instancesWithTags.forEach(instanceWithTags => {
        const instance = instanceWithTags.instance;

        message += '<h4>Instance: ' + instance.DBInstanceIdentifier + '</h4>';
        message += '<ul>';
        message += '<li><strong>AvailabilityZone:</strong> ' + instance.AvailabilityZone + '</li>';

        const name = getRDSInstanceTag(instanceWithTags, tags.name);
        if (name) {
            message += '<li><strong>TAG:Name:</strong> ' + name.Value + '</li>';
        } else {
            message += '<li><strong>TAG:Name:</strong> <em>NULL</em>. <span style="color: red; "><strong>This instance has no Tag \'Name\', please add a tag</strong></span></li>';
        }

        message += '<li><strong>Engine:</strong> ' + instance.Engine + '</li>';
        message += '<li><strong>ARN:</strong> ' + instance.DBInstanceArn + '</li>';

        const autoStopTag = getRDSInstanceTag(instanceWithTags, tags.autoStop);

        if (autoStopTag) {
            message += '<li>Tag <strong><span style="color: green; ">AutoStop=' + autoStopTag.Value + '</span></strong> found! <br> <br><strong><span style="color: rgba(97,95,95,0.76); ">This instance has been automatically stopped, no action is needed</span></strong></li>';
        } else {
            message += '<li>Tag <strong>AutoStop</strong><span style="color: red; "> NOT FOUND :( <br> <br></span><strong><span style="color: rgba(97,95,95,0.76); ">This instance has been automatically stopped, no action is needed</span></strong></li>';
        }
        message += '</ul> <br /> \n';
    });
    return message;
}

function hasRDSTag(instanceWithTags, tagName, tagValue){
    return instanceWithTags.tags && (instanceWithTags.tags.findIndex(tag => {
        return (tag.Key === tagName && (!tagValue || tag.Value === tagValue));
    }) >= 0);
}

function isRDSAutoStoppable(instanceWithTags){
    return !hasRDSTag(instanceWithTags, tags.autoStop, tags.OFF_value);
}

function getRDSInstanceTag(instanceWithTags, tagName){
    return instanceWithTags.tags.find(tag => tag.Key === tagName);
}

function getRDSInstancesSlackAttachments(context){
    const attachments = [];
    context.allInstancesToReport.forEach(region => {
        let isFirstInstanceInRegion = true;
        region.instancesToReport.forEach(instance => {
            const attachment = getAttachmentForInstance(instance);
            if (isFirstInstanceInRegion){
                attachment.pretext = 'Region: ' + region.rds.config.region;
                isFirstInstanceInRegion = false;
            }
            attachments.push(attachment);
        });
    });
    return attachments;
}

function getAttachmentForInstance(instanceWithTags){
    const isInstanceAutoStoppable = isRDSAutoStoppable(instanceWithTags);
    return {
        title: 'ID: ' + instanceWithTags.instance.DBInstanceIdentifier,
        text: getSlackTextForInstance(instanceWithTags),
        footer: isInstanceAutoStoppable ? 'This instance has been automatically stopped, no action is needed' : 'This instance is AutoStop proof',
        footer_icon: isInstanceAutoStoppable ? settings.notifications.slack.imgRemoved : settings.notifications.slack.imgLocked
    };
}

function getSlackTextForInstance(instanceWithTags){
    const autoStopTag = getRDSInstanceTag(instanceWithTags, tags.autoStop);
    const nameTag = getRDSInstanceTag(instanceWithTags, tags.name);
    return (nameTag ? (tags.name + '=' + nameTag.Value) : ('Tag ' + tags.name + ' not found')) + '\n' +
        (autoStopTag ? (tags.autoStop + '=' + autoStopTag.Value) : ('Tag ' + tags.autoStop + ' not found!'));
}

function extractRDSInstancesToStop(instancesByRegion) {
    return instancesByRegion.map(region => {
        return {
            rds: region.rds, instancesToStop: region.instancesWithTags.filter(instanceWithTags => {
                const isActiveInstance = instanceWithTags.instance.DBInstanceStatus === 'available';
                const isAutoStoppable = isRDSAutoStoppable(instanceWithTags);
                log('DEBUG', 'DB INSTANCE IDENTIFIER: ' + instanceWithTags.instance.DBInstanceIdentifier, 'isActiveInstance=' + isActiveInstance + ' isAutoStoppable=' + isAutoStoppable);
                return isActiveInstance && isAutoStoppable;
            })
        };
    });
}

function extractRDSInstancesToReport(instancesByRegion) {
    return instancesByRegion.map(region => {
        return {
            rds: region.rds, instancesToReport: region.instancesWithTags.filter(instanceWithTags => {
                return instanceWithTags.instance.DBInstanceStatus === 'available';
            })
        };
    });
}

function getInstances(data, context){
    const promises = data.Regions.map((region) => {
        const rds = new AWS.RDS({region: region.RegionName});
        return rds.describeDBInstances().promise().then(instances => {
            context.instancesByRegion.push({rds: rds, instances: instances});
            return Promise.resolve(instances);
        });
    });
    return Promise.all(promises);
}

function getTagsForInstances(context){
    const allRegionsListTagPromises = [];
    context.instancesByRegion.forEach(region => {
        region.instancesWithTags = [];
        region.instances.DBInstances.forEach(instance => {
            const promise = region.rds.listTagsForResource({ResourceName: instance.DBInstanceArn}).promise()
                .then(tags => {
                    region.instancesWithTags.push({instance: instance, tags: tags.TagList});
                    return Promise.resolve(tags);
                });
            allRegionsListTagPromises.push(promise);
        });
    });
    return Promise.all(allRegionsListTagPromises);
}

function stopRDSInstances(context){
    const stopInstancePromises = flatArray(context.allInstancesToStop.map(region => {
        return region.instancesToStop.map(instanceWithTags => {
            log('DEBUG', 'STOPPING INSTANCE: ' + instanceWithTags.instance.DBInstanceIdentifier, instanceWithTags.tags);
            return region.rds.stopDBInstance({DBInstanceIdentifier: instanceWithTags.instance.DBInstanceIdentifier}).promise();
        });
    }));
    return Promise.all(stopInstancePromises);
}

function sendNotifications(context){
    return Promise.all([
        sendSlackNotification(settings.instances.rds.serviceType, getRDSInstancesSlackAttachments(context)),
        sendMailNotification(settings.instances.rds.serviceType, getRDSInstancesEmailDetails(context.flatInstancesToReport))
    ]);
}

function extractData(context){
    context.allInstancesToStop = extractRDSInstancesToStop(context.instancesByRegion);
    context.allInstancesToReport = extractRDSInstancesToReport(context.instancesByRegion);
    context.flatInstancesToReport = flatArray(context.allInstancesToReport.map(region => region.instancesToReport));
    context.flatInstancesToStop = flatArray(context.allInstancesToReport.map(region => region.instancesToReport));
}

exports.handler = function (event, context) {
    const ec2 = new AWS.EC2();
    context.instancesByRegion = [];

    ec2.describeRegions({DryRun: settings.instances.ec2.dryRun}).promise(
    ).then((regions) => {
        return getInstances(regions, context);
    }).then(() => {
        return getTagsForInstances(context)
    }).then(() => {
        extractData(context);
        return stopRDSInstances(context);
    }).then(stoppedInstances => {
        return stoppedInstances.length > 0 ?
            sendNotifications(context) :
            Promise.resolve();
    }).then(() => {
        context.succeed('Function has completed successfully');
    }).catch(err => {
        log('ERROR', 'ALL', err);
        context.fail('Function execution has failed');
    });
};
