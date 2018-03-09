#!/bin/bash
set -ex
while read F ; do
    export lambda_name=$F
    bash publish_one_lambda.sh
done <./LAMBDAS_TO_DEPLOY