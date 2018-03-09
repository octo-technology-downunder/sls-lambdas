#!/bin/bash
set -ex

if [[ ! -d "$MyVar" ]]; then
    export lambda_name="autoStopEc2"
    echo 'export lambda_name="autoStopEc2"' >> ~/.bashrc
fi
