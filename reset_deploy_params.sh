#!/bin/bash
set -ex

> LAMBDA_TO_DEPLOY
git add LAMBDA_TO_DEPLOY
git commit -m "reset deployment params"