const AWS = require('aws-sdk');
const slackMessenger = require('../lib/slackMessenger');
const {
    log
} = require('../lib/ec2_rds');

const {loadSettings} = require("../lib/envLoader");
const settings = loadSettings();


const ec2 = new AWS.EC2();


/* /!\ /!\ READ THIS IF DEVELOPING /!\ /!\ */
const dryDelete = settings.instances.ec2.dryRun; // set to true when testing during the day, some instance are running and we don't want to delete them.
/* /!\ /!\ READ THIS IF DEVELOPING /!\ /!\ */

function isVolumeOrphan(volume) {
  return volume.Attachments.length === 0;
}

function removeVolume(ec2, volume) {
  const params = {
    VolumeId: volume.VolumeId,
    DryRun: dryDelete
   };
  return ec2.deleteVolume(params).promise();
}

function listOrphanVolumesPerRegion(region) {
    const ec2 = new AWS.EC2({ region });
    return ec2.describeVolumes().promise()
    .then(volumes => {
        const orphanVolumes = volumes.Volumes.filter(isVolumeOrphan);
        return {ec2: ec2, volumes: orphanVolumes};
    });
}

function sendSlackNotification(context){
    const volumesByRegion = context.orphanVolumesByRegion;
    const header = 'Hi Guys, following orphan AWS EC2 volume(s) were removed:';
    const attachments = [];
    volumesByRegion.forEach(region => {
        let isFirstVolumeInRegion = true;
        region.volumes.forEach(volume => {
            const attachment = createSlackAttachmentForVolume(volume);
            if (isFirstVolumeInRegion) {
                attachment.pretext = 'Region: ' + region.ec2.config.region;
                isFirstVolumeInRegion = false;
            }
            attachments.push(attachment);
        });
    });
    return attachments.length > 0 ?
        slackMessenger.sendSlackWebhook(header, attachments) :
        Promise.resolve();
}

function createSlackAttachmentForVolume(volume){
    return {
        title: 'ID: ' + volume.VolumeId,
        text: getSlackTextForVolume(volume),
    };
}

function getSlackTextForVolume(volume){
    return 'Tags: ' + JSON.stringify(volume.Tags);
}

function deleteVolumes(context){
    const volumesByRegion = context.orphanVolumesByRegion;
    const promises = [];
    volumesByRegion.forEach(region => {
        return region.volumes.forEach(volume => {
            promises.push(removeVolume(region.ec2, volume));
        });
    });
    return Promise.all(promises);
}

exports.handler = function (event, context) {
    ec2.describeRegions({DryRun: dryDelete}).promise()
        .then(data => {
            return Promise.all(
                data.Regions.map(region => {
                    return listOrphanVolumesPerRegion(region.RegionName);
                })
            )
        })
        .then(volumes => {
            context.orphanVolumesByRegion = volumes;
            return deleteVolumes(context);
        })
        .then(() => {
            return sendSlackNotification(context);
        })
        .then(() => {
            context.succeed('Function has completed successfully');
        }).catch(err => {
        log('ERROR', 'ALL', err);
        context.fail('Function execution has failed');
    });
};
