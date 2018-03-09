# Serverless lambda functions

## Deploy
Possible options:
- Deploy manually using Serverless framework (sls package, aws cloudformation deploy)

## Publish to AWS Serverless Repository

1. Modify required files
2. Update ./LAMBDAS_TO_DEPLOY with the names of lambdas to publish (take ones from serverless.yml)
3. <code>git tag -f deploy.all
4. git push -f --tags </code>
5. bild should be triggered in circleci. Go and monitor the process
