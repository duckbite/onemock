# OneMock.io - Universal API Mocking Service Architecture

## Overview

This document outlines the architecture for OneMock.io, an intelligent API mocking service that allows developers to test external services without individual accounts or production impact. The system uses NestJS for the backend, GraphQL/REST APIs, Python for AI processing, Serverless Framework for AWS infrastructure, and OpenAI for intelligent response generation.

---

## 1. Backend/API Architecture

### Technology Stack

- **Framework:** NestJS (TypeScript) for business logic and API endpoints
- **API Types:** Both GraphQL and REST endpoints to match mocked services
- **Serverless:** Serverless Framework for deployment and infrastructure
- **Runtime:** AWS Lambda (Node.js 22) for serverless execution
- **API Gateway:** AWS API Gateway with custom domain routing
- **Authentication:** JWT-based API keys with rate limiting
- **Database:** AWS DynamoDB for service configurations and usage tracking
- **Cache:** Redis (AWS ElastiCache) for fast response caching
- **File Storage:** AWS S3 for API schemas and response templates

### Core Services Architecture

#### 1. API Gateway & Routing Service

```
https://api.onemock.io/[service]/[endpoint]
```

<code_block_to_apply_changes_from>

```
/services
  /stripe
    - schema.json
    - handlers/
    - templates/
  /shopify
    - schema.json
    - handlers/
    - templates/
  /github
    - schema.json
    - handlers/
    - templates/
```

### Mock Handler Pattern

Each service implements:

- Request validation
- Response generation
- Error simulation
- Webhook handling
- Rate limiting simulation

---

## 3. Data Architecture

### DynamoDB Tables

#### Services Table

- ServiceId (PK)
- ServiceName
- Version
- Schema
- Configuration
- Status

#### Users Table

- UserId (PK)
- APIKey
- PlanType
- UsageQuota
- CreatedAt

#### Requests Table

- RequestId (PK)
- UserId (GSI)
- ServiceName
- Endpoint
- Timestamp
- ResponseTime
- Status

#### Templates Table

- TemplateId (PK)
- ServiceName (GSI)
- Endpoint
- Template
- CreatedBy

---

## 4. Infrastructure & Deployment

### AWS Services

- **Lambda Functions:** Service handlers and AI processing
- **API Gateway:** Request routing and management
- **DynamoDB:** Data persistence
- **ElastiCache:** Response caching
- **S3:** Schema and template storage
- **CloudFront:** CDN for global distribution
- **Route53:** DNS and domain management
- **Secrets Manager:** API key and configuration management

### CI/CD Pipeline

- **GitHub Actions:** Automated testing and deployment
- **Serverless Framework:** Infrastructure as code
- **CloudWatch:** Monitoring and logging
- **AWS X-Ray:** Distributed tracing

---

## 5. Security Architecture

### Authentication & Authorization

- API key-based authentication
- JWT tokens for session management
- Role-based access control
- Rate limiting per user/plan

### Data Protection

- Encryption at rest (DynamoDB, S3)
- Encryption in transit (HTTPS)
- API key rotation
- Audit logging

---

## 6. Scalability & Performance

### Caching Strategy

- Redis cache for frequent responses
- CloudFront CDN for global distribution
- Lambda response caching
- Schema caching in memory

### Auto-scaling

- Lambda concurrent execution limits
- DynamoDB auto-scaling
- ElastiCache cluster scaling
- API Gateway throttling

---

## 7. Development Workflow

### Service Addition Process

1. Define service schema
2. Implement mock handlers
3. Create response templates
4. Add AI training data
5. Deploy and test

### Testing Strategy

- Unit tests for mock handlers
- Integration tests for API endpoints
- Load testing for performance
- AI response quality testing

---

## 8. Monitoring & Analytics

### Key Metrics

- Response time per service
- Request volume and patterns
- Error rates and types
- User engagement and retention
- AI response accuracy

### Alerting

- Service availability monitoring
- Performance degradation alerts
- Usage quota notifications
- Security incident detection

---

## Summary of Technology Stack

| Layer           | Technology              |
| --------------- | ----------------------- |
| Backend         | NestJS (TypeScript)     |
| APIs            | GraphQL + REST          |
| Serverless      | Serverless Framework    |
| Runtime         | AWS Lambda (Node.js 22) |
| Database        | AWS DynamoDB            |
| Cache           | Redis (ElastiCache)     |
| Storage         | AWS S3                  |
| AI/ML           | OpenAI API, Python      |
| CDN             | AWS CloudFront          |
| Monitoring      | CloudWatch, X-Ray       |
| Package Manager | pnpm                    |
| DevOps          | GitHub Actions          |

This architecture provides a scalable, intelligent API mocking platform that can support multiple services while maintaining high performance and developer experience.

```

## Summary

I've created a comprehensive product specification and updated architecture for your OneMock.io API mocking service. The key components include:

**Product Features:**
- Multi-service API mocking with unified URL structure
- AI-powered intelligent response generation
- Developer tools for testing and debugging
- Single account access for multiple services

**Technical Architecture:**
- NestJS backend with TypeScript
- Support for both GraphQL and REST endpoints
- Serverless AWS infrastructure using Lambda
- Redis caching for performance
- DynamoDB for data persistence
- OpenAI integration for intelligent responses

**Next Steps:**
1. Set up the initial NestJS project structure
2. Implement the core routing and service discovery
3. Create the first service mock (e.g., Stripe)
4. Add authentication and rate limiting
5. Integrate AI-powered response generation

Would you like me to start implementing any specific part of this architecture, or would you like to discuss any modifications to the plan?
```
