#!/bin/bash
set -ex

# Increment version function. Usage: increment_version <version> [<position>]
increment_version() {
    local v=$1
    if [ -z $2 ]; then
       local rgx='^((?:[0-9]+\.)*)([0-9]+)($)'
    else
       local rgx='^((?:[0-9]+\.){'$(($2-1))'})([0-9]+)(\.|$)'
       for (( p=`grep -o "\."<<<".$v"|wc -l`; p<$2; p++)); do
          v+=.0; done; fi
    val=`echo -e "$v" | perl -pe 's/^.*'$rgx'.*$/$2/'`
    echo "$v" | perl -pe s/$rgx.*$'/${1}'`printf %0${#val}s $(($val+1))`/
}


new_template_file="cf_template_s3.yml"
aws_region=us-east-1

# preparing CloudFormation template for particular lambda
# lambda_name variable should be provided as parameter to a circleci build
lambda_handler=$(python getLambdaParams.py $lambda_name handler)
lambda_description=$(python getLambdaParams.py $lambda_name description)
lambda_labels=$(python getLambdaParams.py $lambda_name labels)

eval "cat <<EOF
$(<cf_template.yml)
EOF
" > cf_template_prepared.yml

#Packaging and sending package to S3, updating template with S3 URI
aws cloudformation package --template-file cf_template_prepared.yml --s3-bucket serverless-public --s3-prefix $lambda_name --output-template-file $new_template_file --region ${aws_region}

# Verify if lambda already published
lambda_name_exists=$(aws serverlessrepo list-applications --query "Applications[?Name==\`$lambda_name\`].[Name, Version]" --output text --region ${aws_region})
lambda_exists=true
if [[ -z "$lambda_name_exists" ]]; then
    echo "Lambda not found"
    lambda_exists=false
fi


if ${lambda_exists} ; then
    echo "Lambda found"
    lambda_id=$(aws serverlessrepo list-applications --query "Applications[?Name==\`$lambda_name\`].ApplicationId" --output text --region ${aws_region})
    lambda_version=$(increment_version $(aws serverlessrepo get-application --application-id ${lambda_id} --query "Version.SemanticVersion" --output text --region ${aws_region}))
    echo "Application id is $lambda_id"
    aws serverlessrepo create-application-version \
    --application-id ${lambda_id} \
    --semantic-version ${lambda_version} \
    --source-code-url file://$(pwd)/url_source_code \
    --template-body "`cat ./${new_template_file}`" \
    --region ${aws_region}
else
    lambda_version='0.1.1'
    aws serverlessrepo create-application \
    --author "Octo Technology Australia" \
    --description "`echo ${lambda_description}`" \
    --home-page-url file://$(pwd)/url_home_page \
    --name ${lambda_name} \
    --semantic-version ${lambda_version} \
    --source-code-url file://$(pwd)/url_source_code \
    --spdx-license-id Apache-2.0 \
    --template-body "`cat ./${new_template_file}`" \
    --readme-body "`cat ./README.md`"\
    --license-body "`cat ./LICENSE`"\
    --labels ${lambda_labels} \
    --region ${aws_region}
fi
