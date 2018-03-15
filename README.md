# AWS Infrastructure Management Lambda Functions
This repository contains a set of applications suitable for deployment to AWS environment as serverless lambda functions.
Main intention of this package is to automate some administration tasks for most popular AWS services.
This can significantly reduce administration effort and lower running costs of AWS account.
All functions support Slack integration to notify of performed actions. Some of them also support emails.
List of the functions can be found in the table below.

| Function name | Description | Configuration | Notification type |
| --- | --- | --------- | --- |
| autoStopEc2 |  Automatically stops all EC2 instances in ALL regions except excluded ones | To prevent particular EC2 instance from being stopped automaitcally, add tag 'AutoStop' with value 'false' to that instance | Slack, Email |
| autoStartEc2 | Automatically starts all EC2 instances in ALL regions which are tagged appropriately | To allow particular EC2 instance be started automatically, add tag 'AutoStop' with value 'true' to that instance  | Slack, Email |
| autoStopRds | Automatically stops all RDS instances in ALL regions except excluded ones | To prevent particular RDS instance from being stopped automaitcally, add tag 'AutoStop' with value 'false' to that instance | Slack, Email |
| billingReporter | Delivers latest AWS costs breakdown to your Slack channel  | For notification settings, see Common settings configuration | Slack |
| cleanOrphanVolumes | Removes all EC2 volumes in ALL regions, which are not attached to any EC2 instance | For notification settings, see Common settings configuration | Slack |


## Installation
In order to provide all required configuration parameters to your lambda functions, please follow installation process as described below.

#### Installation Prerequisites:
* **python** is installed. If not, visit [https://www.python.org/about/gettingstarted/]
* **pip** is installed. If not, visit [https://pip.pypa.io/en/stable/installing/]
* **git** is installed. If not, see [https://git-scm.com/book/en/v2/Getting-Started-Installing-Git]
* **pyyaml** is installed. If not, do `pip install pyyaml`
* **aws cli** is installed. If not, do `pip install awscli`
* **npm** is installed. If not, visit [https://docs.npmjs.com/getting-started/installing-node]
* **serverless framework** is installed. If not, do `npm install -g serverless`

#### Installation steps
1. Clone git repository to your local directory
2. `npm install` from the root directory of your cloned repo
3. `npm install serverless-plugin-optimize --save-dev` to install package optimisation plugin
4. Update commonSettings.json with parameter values relevant to your setup. See Common Settings Configuration for more details
5. `sls package` to package lambdas to individual optimized zip archives (available in .serverless)
6. Update `LAMBDAS_TO_DEPLOY` file with the list of lambdas to be deployed to your AWS account. Each function name must be on separate line, no comments allowed. Exact function names can be taken from the table above or serverless.yml file
7. `bash publish_lambdas.sh` to deploy your functions


## Common settings configuration
To configure your lambda function, open commonSettings.json and populate all parameter values relevant to your setup.
List of parameters available for configuration is provided below:

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
| **instances.tags.ON_value** | Value of the autoStop/autoStart tags which ENABLES a setting. Case sensitice |
| **instances.tags.OFF_value** | Value of the autoStop/autoStart tags which DISABLES a setting. Case sensitice |
| **instances.tags.autoStop** | Name of the autoStop tag. Case sensitive |
| **instances.tags.autoStart** | Name of the autoStart tag. Case sensitive |
| **instances.tags.name** | Name of the Name tag. Case sensitive |
| users | Group of parameters related to AWS to Slack users mapping. Specifically for autoStopEc2 function |
| **users.unknownUser** | Name to show in Slack message if can't map AWS user to Slack userid |
| **users.AWStoSlackUsersMap** | Map of AWS username to Slack userid |
