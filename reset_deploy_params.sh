#!/bin/bash
set -ex

> LAMBDA_TO_DEPLOY
git add set_deploy_params.sh
git commit -m "reset deployment params"