# OneMock.io - Universal API Mocking Service

OneMock.io is an intelligent API mocking service that allows developers to test external services without needing individual accounts or impacting production data. It provides a unified interface to mock popular APIs through a single platform.

## Features

- **Multi-Service API Mocking**: Support for popular APIs (Stripe, Shopify, GitHub, Slack, etc.)
- **Unified URL Structure**: `https://api.onemock.io/[service]/[endpoint]`
- **Intelligent Response Generation**: Schema-based realistic data generation using OpenAPI specifications
- **Developer Tools**: API documentation, request/response logging, and analytics
- **Single Account Access**: One account for all services
- **Production Safety**: Test without affecting real data

## Quick Start

### Prerequisites

- Node.js 22.x
- pnpm (recommended) or npm
- Redis (for local development)
- AWS CLI configured (for deployment only)

### Installation

1. Clone the repository:

```bash
git clone <repository-url>
cd onemock.io
```

2. Install dependencies:

```bash
pnpm install
```

3. Install and start Redis (macOS with Homebrew):

```bash
# Install Redis
brew install redis

# Start Redis service
brew services start redis

# Verify Redis is running
redis-cli ping
# Should return: PONG
```

4. Set up environment variables:

```bash
cp env.example .env
# Edit .env with your configuration (optional for local development)
```

5. Start local development:

```bash
pnpm start:dev
```

The API will be available at `http://localhost:3000`

### Local Development Notes

- **Database**: The application runs in mock mode for local development, so no DynamoDB setup is required
- **Redis**: Required for caching functionality - make sure Redis is running before starting the app
- **Environment**: No AWS credentials needed for local development
- **API Documentation**: Available at `http://localhost:3000/api/docs`

## Environment Configuration

Create a `.env` file with the following variables:

```env
# Environment Configuration
NODE_ENV=development

# JWT Configuration
JWT_SECRET=your-super-secret-jwt-key-here
JWT_EXPIRES_IN=24h

# Optional: OpenAI Configuration (for future AI features)
# OPENAI_API_KEY=your-openai-api-key-here

# AWS Configuration
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=your-aws-access-key
AWS_SECRET_ACCESS_KEY=your-aws-secret-key

# Redis Configuration
REDIS_URL=redis://localhost:6379
REDIS_HOST=localhost
REDIS_PORT=6379

# CORS Configuration
ALLOWED_ORIGINS=http://localhost:3000,http://localhost:3001
```

## Usage

### 1. Register a User

```bash
curl -X POST http://localhost:3000/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "planType": "free"
  }'
```

### 2. Use the API Key

```bash
curl -X GET http://localhost:3000/stripe/charges \
  -H "X-API-Key: your-api-key-here"
```

### 3. Mock Different Services

```bash
# Stripe API
curl -X GET http://localhost:3000/stripe/charges \
  -H "X-API-Key: your-api-key"

# Create a charge
curl -X POST http://localhost:3000/stripe/charges \
  -H "X-API-Key: your-api-key" \
  -H "Content-Type: application/json" \
  -d '{
    "amount": 2000,
    "currency": "usd",
    "description": "Test charge"
  }'

# Shopify API
curl -X GET http://localhost:3000/shopify/products \
  -H "X-API-Key: your-api-key"
```

## API Documentation

Once the server is running, visit `http://localhost:3000/api/docs` for interactive API documentation.

## Architecture

### Core Components

- **NestJS Backend**: TypeScript-based framework for API development
- **Dynamic Routing**: Handles `/[service]/[endpoint]` pattern
- **Authentication**: API key-based authentication with usage tracking
- **Intelligent Mocking**: OpenAPI specification-based response generation
- **Caching**: Redis-based response caching for performance
- **Analytics**: Request logging and usage analytics

### Supported Services

Currently implemented:

- **Stripe**: Payment processing API
- **Shopify**: E-commerce API (basic)
- **GitHub**: Repository API (basic)

More services can be easily added by implementing the `MockHandler` interface.

## Development

### Project Structure

```
src/
├── common/           # Shared utilities and services
│   ├── cache/       # Redis caching service
│   └── database/    # DynamoDB service
├── modules/         # Feature modules
│   ├── auth/        # Authentication and user management
│   ├── mock/        # Core mocking functionality
│   ├── services/    # Service management
│   ├── analytics/   # Request analytics
│   ├── swagger/     # OpenAPI specification parsing
│   └── mock-data/   # Intelligent data generation
└── services/        # Service-specific handlers
    └── stripe/      # Stripe API handler
```

### Adding a New Service

1. Create an OpenAPI specification file in `schemas/[service-name].json`
2. Create a service handler in `src/services/[service-name]/[service-name].handler.ts`
3. Implement the `MockHandler` interface
4. Register the handler in the `ServicesService`
5. Add service configuration to the database

Example:

```typescript
@Injectable()
export class NewServiceHandler implements MockHandler {
  constructor(private readonly mockDataService: MockDataService) {}

  async handle(request: {
    path: string;
    method: string;
    body: any;
    query: any;
    headers: Record<string, string>;
  }) {
    // Use intelligent data generation based on OpenAPI specs
    return {
      data: this.mockDataService.generateResponse(
        schema,
        'service-name',
        request.path
      ),
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
    };
  }
}
```

The system will automatically:

- Parse your OpenAPI specification
- Generate realistic responses based on the schema
- Handle request validation
- Provide consistent data structures

## Deployment

### AWS Deployment

1. Configure AWS credentials:

```bash
aws configure
```

2. Deploy to AWS:

```bash
pnpm deploy:dev    # Deploy to development
pnpm deploy:prod   # Deploy to production
```

### Infrastructure

The deployment creates:

- AWS Lambda functions
- DynamoDB tables
- S3 buckets for schemas and templates
- API Gateway for routing

## Troubleshooting

### Common Startup Issues

1. **Port 3000 already in use**:

```bash
# Kill processes using port 3000
lsof -ti:3000 | xargs kill -9
# Then restart the application
pnpm start:dev
```

2. **Redis connection error**:

```bash
# Check if Redis is running
redis-cli ping
# If not running, start Redis
brew services start redis
```

3. **Database connection error**:

- The application runs in mock mode for local development
- No DynamoDB setup required
- Check logs for "Running in local development mode - using mock data"

4. **GraphQL schema error**:

- This has been resolved by removing unused GraphQL configuration
- If you see this error, ensure you're using the latest code

### Health Check

Verify the application is running correctly:

```bash
curl http://localhost:3000
# Should return: {"status":"healthy","timestamp":"...","version":"1.0.0"}
```

### Development Workflow

1. **Start Redis** (if not already running):

```bash
brew services start redis
```

2. **Start the application**:

```bash
pnpm start:dev
```

3. **Verify startup**:

- Check logs for "Nest application successfully started"
- Look for "Running in local development mode - using mock data"
- Visit `http://localhost:3000/api/docs` for API documentation

4. **Test endpoints**:

```bash
# Health check
curl http://localhost:3000

# API documentation
open http://localhost:3000/api/docs
```

## Testing

```bash
# Run unit tests
pnpm test

# Run e2e tests
pnpm test:e2e

# Run tests with coverage
pnpm test:cov
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests
5. Submit a pull request

## License

MIT License - see LICENSE file for details

## Support

For support and questions:

- Create an issue in the repository
- Check the API documentation at `/api/docs`
- Review the architecture documentation in `docs/`

## Roadmap

- [ ] Add more service integrations (Slack, GitHub, etc.)
- [ ] Webhook simulation
- [ ] Custom response templates
- [ ] Team collaboration features
- [ ] Advanced analytics dashboard
- [ ] Rate limiting simulation
- [ ] Error scenario testing
