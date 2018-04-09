# AWS Infrastructure Management Lambda Functions
This repository contains a set of applications suitable for deployment to AWS environment as serverless lambda functions.
Main intention of this package is to automate some administration tasks for most popular AWS services.
This can significantly reduce administration effort and lower running costs of AWS account.
All functions support Slack integration to notify of performed actions. Some of them also support emails.
List of the functions can be found in the table below.

| Function name | Description | Configuration | Notification type | IAM Policies required |
| --- | --- | --- | --- | --- |
| autoStopEc2 |  Automatically stops all EC2 instances in ALL regions except white-listed instances | To prevent particular EC2 instance from being stopped automatically, add tag 'AutoStop' with value 'false' to that instance | Slack, Email | - arn:aws:iam::aws:policy/AmazonEC2FullAccess<br/>- arn:aws:iam::aws:policy/AmazonSESFullAccess<br/>- arn:aws:iam::aws:policy/AWSCloudTrailReadOnlyAccess |
| autoStartEc2 | Automatically starts all appropriately tagged EC2 instances in ALL regions | To allow particular EC2 instance be started automatically, add tag 'AutoStop' with value 'true' to that instance  | Slack, Email | - arn:aws:iam::aws:policy/AmazonEC2FullAccess<br/>- arn:aws:iam::aws:policy/AmazonSESFullAccess |
| autoStopRds | Automatically stops all RDS instances in ALL regions except white-listed instances | To prevent particular RDS instance from being stopped automaitcally, add tag 'AutoStop' with value 'false' to that instance | Slack, Email | - arn:aws:iam::aws:policy/AmazonRDSFullAccess<br/>- arn:aws:iam::aws:policy/AmazonSESFullAccess<br/>- arn:aws:iam::aws:policy/AmazonEC2ReadOnlyAccess |
| billingReporter | Delivers latest AWS costs breakdown to your Slack channel  | For notification settings, see Common settings configuration | Slack | - arn:aws:iam::aws:policy/AmazonS3ReadOnlyAccess |
| cleanOrphanVolumes | Removes all EC2 volumes in ALL regions, which are not attached to any EC2 instance | For notification settings, see Common settings configuration | Slack | - arn:aws:iam::aws:policy/AmazonEC2FullAccess |


## Installation
1. Installation is performed by creating lambda function from AWS Serverless Application Repository (in AWS Console, go to Lambda->Functions->Create Function->Serverless Application Repository).
2. In order to provide all required configuration parameters to your lambda functions, please update CommonSettings variable in the **Configure application parameters** section of lambda function creation screen.
   See **Common settings configuration** section for details
3. Lambda functions require specific AWS IAM Policies to be attached to them, which can't be done automatically during deployment.
   To make lambdas work, please attach required policies, to the IAM role of created lambda function manually.
   List of policies, required for particular function can be found in the table above



## Common settings configuration
All lambda functions are configurable via **CommonSettings** variable.
All lambda functions, except **billingReporter**, require JSON string in **CommonSettings** variable. Format is provided below. For **billingReporter** configuration skip to **Billing reporter settings configuration**
```
{
  "notifications" : {
    "email" : {
      "notify" : false,
      "emails" : ["to@test.com"],
      "source" : "from@test.com",
      "replyTo" : ["Test User <from@test.com>"],
      "charSet" : "UTF-8"
    },
    "slack" : {
      "notify" : true,
      "webhookUri" : "https://hooks.slack.com/services/XXXXXXXXX/XXXXXXXXX/XXXXXXXXXXXXXXXXXXXXXXX",
      "channel": "XXXXXX",
      "botName": "AWS Guard",
      "messageEmoji" : ":guardsman:",
      "imgLocked" : "https://emojipedia-us.s3.amazonaws.com/thumbs/120/apple/118/lock_1f512.png",
      "imgRemoved" : "https://emojipedia-us.s3.amazonaws.com/thumbs/120/apple/118/cross-mark_274c.png",
      "footerTitle": "",
      "footer": "I'm an AWS lambda. If you want to modify me, please update here:\nhttps://github.com/octo-technology-downunder",
      "footerColor": "#FFFFFF",
      "footerIcon": "https://a.slack-edge.com/f30f/img/services/api_200.png"
    }
  },
  "instances" : {
    "ec2" : {
      "serviceType" : "EC2",
      "dryRun" : false
    },
    "rds" : {
      "serviceType" : "RDS"
    },
    "tags" : {
      "ON_value" : "true",
      "OFF_value" : "false",
      "autoStop" : "AutoStop",
      "autoStart" : "AutoStart",
      "name" : "Name"
    }
  },
  "users" : {
    "unknownUser" : "~unknown~",
    "AWStoSlackUsersMap" : [
      {"awsId": "USER1", "slackId": "UXXXXXXXXX"},
      {"awsId": "USER2", "slackId": "UXXXXXXXXX"}
    ]
  }
}
```


Description of parameters available for configuration is provided below:

| Parameter group or name | Description |
| --- | --- |
| notifications | Group of parameters related to notification settings |
| notifications.email | Group of email notification settings. Only relevant to the functions, supporting email notifications |
| **notifications.email.notify** | If set to **true**, email notification will be activated |
| **notifications.email.emails** | Array of emails which will receive notifications |
| **notifications.email.source** | Email address which will be listed in 'From' field of received email notification |
| **notifications.email.replyTo** | Email address which will be used in 'ReplyTo' field of received email notification |
| **notifications.email.charSet** | Charset of email notification |
| notifications.slack | Group of Slack notification settings |
| **notifications.slack.notify** | If set to **true**, Slack notification will be activated |
| **notifications.slack.webhookUri** | Active incoming webhook url for Slack notification. For details, see [https://api.slack.com/incoming-webhooks] |
| **notifications.slack.channel** | Slack channel ID to send notification to |
| **notifications.slack.botName** | Name of a bot which will be displayed in Slack message |
| **notifications.slack.messageEmoji** | Emoji to be displayed next to the bot name in Slack message |
| **notifications.slack.imgLocked** | Image to be displayed for protected instances |
| **notifications.slack.imgRemoved** | Image to be displayed for stopped/removed objects |
| **notifications.slack.footerTitle** | Free text to be displayed under the main notification text in Slack message |
| **notifications.slack.footer** | Free text to be displayed under the main notification text in Slack message |
| **notifications.slack.footerColor** | Color of a footer bar in Slack message |
| **notifications.slack.footerIcon** | Icon to display in a footer in Slack message |
| instances | Group of parameters related to AWS service instances |
| instances.ec2 | Group of parameters related to AWS EC2 service instances |
| **instances.ec2.serviceType** | Service Type name to display in email notification |
| **instances.ec2.dryRun** | Dryrun flag for EC2 instances. For more details, see [https://docs.aws.amazon.com/AWSEC2/latest/APIReference/CommonParameters.html] |
| instances.rds | Group of parameters related to AWS RDS service instances |
| **instances.rds.serviceType** | Service Type name to display in email notification |
| instances.tags | Group of parameters to configure tags for autoStop/autoStart lambdas |
| **instances.tags.ON_value** | Value of the autoStop/autoStart tags which ENABLES a setting. Case sensitive |
| **instances.tags.OFF_value** | Value of the autoStop/autoStart tags which DISABLES a setting. Case sensitive |
| **instances.tags.autoStop** | Name of the autoStop tag. Case sensitive |
| **instances.tags.autoStart** | Name of the autoStart tag. Case sensitive |
| **instances.tags.name** | Name of the Name tag. Case sensitive |
| users | Group of parameters related to AWS to Slack users mapping. Specifically for autoStopEc2 function |
| **users.unknownUser** | Name to show in Slack message if can't map AWS user to Slack userid |
| **users.AWStoSlackUsersMap** | Map of AWS username to Slack userid |


## Billing reporter settings configuration
For billing reporter, please use JSON string of the following format in the **CommonSettings** variable

```
{
  "s3": {
    "awsRegion": "ap-southeast-2",
    "keyPrefix": "XXXX/XXXXXX",
    "billingBucketName": "XXXXXXXXX",
    "reportFileName": "XXXXXXXXX.csv.gz",
    "manifestFileName": "XXXXXXXXX-Manifest.json"
  },
  "converter": {
    "converterUrl": "https://api.fixer.io/latest?base=AUD&symbols=USD",
    "currencySymbol" : "AUD $",
    "converterDefaultRate": 1,
    "converterDefaultCurrency" : "USD $"
  },
  "slack": {
    "webhookUri": "https://hooks.slack.com/services/XXXXXXXXX/XXXXXXXXX/XXXXXXXXXXXXXXXXXXXXXXXXXXX",
    "botName": "Billing Report",
    "messageTitle": "AWS Services bill of the current month",
    "messageTitleLink": "https://console.aws.amazon.com/billing/home#/",
    "channel": "#XXXXXXXXX",
    "dangerIcon": "http://www.thelibrarypolice.com/uploads/1/4/0/6/14066006/published/warning.png",
    "footerTitle": "Check out more at\nhttps://console.aws.amazon.com/billing/home#/",
    "footer": "I'm an AWS lambda. If you want to modify me, please update here:\nhttps://github.com/octo-technology-downunder",
    "footerColor": "#FFFFFF",
    "footerIcon": "https://a.slack-edge.com/f30f/img/services/api_200.png",
    "colorDanger" : "danger",
    "colorWarning" : "warning",
    "colorGood" : "good",
    "colorOther" : "##FFFC2D",
    "colorDefault" : "#FFFFFF",
    "messageEmoji": ":moneybag:",
    "overspentMessage": "@here *Some services exceed their cost limits (red items below)!*"
  },
  "csv": {
    "amountColumnName": "lineItem/BlendedCost",
    "serviceColumnName": "product/ProductName"
  },
  "thresholds" : {"services" : [
    {"serviceName" : "Amazon Elastic Compute Cloud", "limit" : 200},
    {"serviceName" : "Amazon Relational Database Service", "limit" : 150},
    {"serviceName" : "Amazon DynamoDB", "limit" : 50}],
    "totalLimit" : 400,
    "warningThreshold" : 0.8,
    "breakdownLimit": 0.99
  }
}
```

Description of parameter groups available for configuration is provided below:

| Parameter group or name | Description |
| --- | --- |
| s3 | Group of parameters to configure billing reports location in AWS S3. Please follow the AWS instructions on how to enable billing reporting to your s3 bucket: https://docs.aws.amazon.com/awsaccountbilling/latest/aboutv2/billing-getting-started.html#step-2 |
| converter | Group of parameters to configure conversion of default USD amount to required currency |
| slack | Group of parameters to configure Slack notifications |
| csv | Group of parameters to configure names of columns in billing report csv file to report on |
| thresholds | Group of parameters to configure alert thresholds for different services. If expenses are over defined limit for particular service, Slack attachment for this service will be highlighted with defined color (red by default) and icon |
| thresholds.services | An array of objects defining services and their spend limits |
| thresholds.totalLimit | Spend limit for grand total across all services |
| thresholds.warningThreshold | Defines a level of spend which will trigger a warning alert (Slack attachment marked yellow by default) for configured limit. E.g. with totalLimit = 100 and warningThreshold = 0.8, when grand total goes over $80, grand total will be with yellow tag |
| thresholds.breakdownLimit | Assuming services are sorted by amount spent in descending order, this parameter defines number of services to display in cost breakdown based on running total ratio to grand total. E.g. with grand total = $100 and breakdownLimit = 0.99, Billing Report will show top most expensive services which sum is <= $99. Rest of services will be reported as Other Services |