#!/bin/bash

# OneMock.io Deployment Script

set -e

STAGE=${1:-dev}
REGION=${2:-us-east-1}

echo "🚀 Deploying OneMock.io to $STAGE stage in $REGION region..."

# Check if AWS CLI is configured
if ! aws sts get-caller-identity &> /dev/null; then
    echo "❌ AWS CLI is not configured. Please run 'aws configure'"
    exit 1
fi

# Check if serverless is installed
if ! command -v serverless &> /dev/null; then
    echo "📦 Installing Serverless Framework..."
    npm install -g serverless
fi

# Build the project
echo "🔨 Building project..."
pnpm build

# Deploy to AWS
echo "☁️  Deploying to AWS..."
serverless deploy --stage $STAGE --region $REGION

echo ""
echo "🎉 Deployment complete!"
echo ""
echo "API Endpoint: https://$(aws cloudformation describe-stacks --stack-name onemock-api-$STAGE --query 'Stacks[0].Outputs[?OutputKey==`ApiGatewayRestApiId`].OutputValue' --output text).execute-api.$REGION.amazonaws.com/$STAGE"
echo ""
echo "Next steps:"
echo "1. Test the API endpoint"
echo "2. Check CloudWatch logs if needed"
echo "3. Monitor usage in the AWS console"
