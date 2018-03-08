'use strict';
const AWS = require('aws-sdk');
const Slack = require('slack-node');
const axios = require('axios');
const moment = require('moment');
const {promisify} = require('es6-promisify');
const gunzip = promisify(require('zlib').gunzip);

const BillingReport = require('./billingReporter.js');

const settings = require('./billingReporterSettings.json');


const slack = new Slack();
const billingReporter = new BillingReport();

AWS.config.update({region: settings.s3.awsRegion});
const s3 = new AWS.S3();

exports.handler = function (event, context) {
    const reportPath = calculateReportDirBasedOnDate();
    getManifestFile(reportPath).then(manifestFile => {
        return getZippedReportFile(manifestFile, reportPath);
    }).then(zippedReport => {
        return gunzip(zippedReport.Body);
    }).then(data => {
        return billingReporter.processData(data.toString('utf8'));
    }).then(() => {
        return getCurrencyRate(context);
    }).then(() => {
        return sendSlackMessage(context)
    }).catch(err => {
        console.error('ERROR: ' + err.stack);
    });

};

function getManifestFile(reportPath) {
    const manifestFileParams = {
        Bucket: settings.s3.billingBucketName,
        Key: (settings.s3.keyPrefix + '/' + reportPath + '/' + settings.s3.manifestFileName)
    };
    return s3.getObject(manifestFileParams).promise();
}

function getZippedReportFile(manifestFile, reportPath) {
    const assemblyId = JSON.parse(manifestFile.Body).assemblyId;
    const billingReportParams = {
        Bucket: settings.s3.billingBucketName,
        Key: (settings.s3.keyPrefix + '/' + reportPath + '/' + assemblyId + '/' + settings.s3.reportFileName)
    };
    return s3.getObject(billingReportParams).promise();
}

function calculateReportDirBasedOnDate(date) {
    if (!date) {
        date = moment();
    }
    const start = date.startOf("month");
    const end = start.clone().add(1, "month");
    return start.format('YYYYMMDD') + '-' + end.format('YYYYMMDD');
}

function getCurrencyRate(context) {
    return axios.get(settings.converter.converterUrl)
        .then(response => {
                try {
                    context.conversionRate = response.data.rates.USD;
                    context.currencySymbol = settings.converter.currencySymbol;
                } catch (err) {
                    setDefaultConversionRate(context)
                }
            },
            () => setDefaultConversionRate(context)
        );
}

function setDefaultConversionRate(context){
    context.conversionRate = settings.converter.converterDefaultRate;
    context.currencySymbol = settings.converter.converterDefaultCurrency;
}

function constructSlackAttachments(reporter, context) {
    const attachments = [];
    let reportedServicesAmount = 0;
    let subtotalOverspentFlag = false;
    settings.thresholds.services.forEach(service => {
        const serviceTotal = reporter.getSingleServiceTotal(service.serviceName);
        reportedServicesAmount += serviceTotal.amount;
        const amtWithColor = getConvertedAmountWithColor(context, serviceTotal.amount, service.limit);
        if (amtWithColor.overspentFlag && !subtotalOverspentFlag) {
            subtotalOverspentFlag = true;
        }
        addAmountAttachment(attachments, amtWithColor.color, serviceTotal.serviceName, constructAmountText(amtWithColor.amount, context), getDangerIconUrl(amtWithColor.overspentFlag));
    });

    const otherServicesAmount = getConvertedAmountWithColor(context, reporter.getTotalAmount() - reportedServicesAmount);
    addAmountAttachment(attachments, settings.slack.colorOther, "Other services", constructAmountText(otherServicesAmount.amount, context), '');

    const totalAmtWithColor = getConvertedAmountWithColor(context, reporter.getTotalAmount(), settings.thresholds.totalLimit);
    addAmountAttachment(attachments, totalAmtWithColor.color, "GRAND TOTAL", constructAmountText(totalAmtWithColor.amount, context), getDangerIconUrl(totalAmtWithColor.overspentFlag));

    attachments.push({
        color: settings.slack.footerColor,
        title: settings.slack.footerTitle,
        footer: settings.slack.footer,
        footer_icon: settings.slack.footerIcon
    });
    return {attachments: attachments, overspentFlag: (subtotalOverspentFlag || totalAmtWithColor.overspentFlag)};
}

function getDangerIconUrl(overspentFlag){
    return overspentFlag ? settings.slack.dangerIcon : '';
}

function constructAmountText(amount, context){
    return context.currencySymbol + amount;
}

function addAmountAttachment(attachments, color, title, text, thumbUrl){
    attachments.push({
        color: color,
        title: title,
        text: text,
        thumb_url: thumbUrl
    });
}

function getConvertedAmountWithColor(context, amount, limit) {
    let color;
    let dangerFlag = false;
    const convertedAmt = (amount / context.conversionRate).toFixed(2);
    if (limit && convertedAmt >= limit) {
        color = settings.slack.colorDanger;
        dangerFlag = true;
    } else if (limit && convertedAmt > (limit * settings.thresholds.warningThreshold)) {
        color = settings.slack.colorWarning;
    } else {
        color = settings.slack.colorGood;
    }
    return {amount: convertedAmt, color: color, overspentFlag: dangerFlag};
}

function sendSlackMessage(context) {
    const attachments = constructSlackAttachments(billingReporter, context);
    let msgText = settings.slack.messageTitle;
    if (attachments.overspentFlag) {
        msgText += '\n' + settings.slack.overspentMessage
    }
    slack.setWebhook(settings.slack.webhookUri);
    return promisify(slack.webhook)({
        channel: settings.slack.channel,
        username: settings.slack.botName,
        icon_emoji: settings.slack.messageEmoji,
        text: msgText,
        attachments: attachments.attachments
    });
}

exports.calculateReportDirBasedOnDate = calculateReportDirBasedOnDate;