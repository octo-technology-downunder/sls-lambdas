#!/bin/bash
set -ex
while read F
    export lambda_name=$F
    publish_one_lambda.sh
done <./LAMBDAS_TO_DEPLOY