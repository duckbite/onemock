#!/bin/bash

# OneMock.io Development Setup Script

echo "🚀 Setting up OneMock.io development environment..."

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js 22.x first."
    exit 1
fi

# Check Node.js version
NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 22 ]; then
    echo "❌ Node.js version 22.x is required. Current version: $(node -v)"
    exit 1
fi

echo "✅ Node.js version: $(node -v)"

# Check if pnpm is installed
if ! command -v pnpm &> /dev/null; then
    echo "📦 Installing pnpm..."
    npm install -g pnpm
fi

echo "✅ pnpm version: $(pnpm -v)"

# Install dependencies
echo "📦 Installing dependencies..."
pnpm install

# Create .env file if it doesn't exist
if [ ! -f .env ]; then
    echo "📝 Creating .env file..."
    cp env.example .env
    echo "⚠️  Please edit .env file with your configuration"
fi

# Check if Redis is running
if ! command -v redis-cli &> /dev/null; then
    echo "⚠️  Redis CLI not found. Please install Redis for caching."
else
    if redis-cli ping &> /dev/null; then
        echo "✅ Redis is running"
    else
        echo "⚠️  Redis is not running. Please start Redis for caching."
    fi
fi

# Check if AWS CLI is configured
if ! command -v aws &> /dev/null; then
    echo "⚠️  AWS CLI not found. Please install AWS CLI for deployment."
else
    if aws sts get-caller-identity &> /dev/null; then
        echo "✅ AWS CLI is configured"
    else
        echo "⚠️  AWS CLI is not configured. Please run 'aws configure'"
    fi
fi

echo ""
echo "🎉 Setup complete!"
echo ""
echo "Next steps:"
echo "1. Edit .env file with your configuration"
echo "2. Start Redis: redis-server"
echo "3. Run the application: pnpm start:dev"
echo "4. Visit http://localhost:3000/api/docs for API documentation"
echo ""
echo "Happy coding! 🚀"
