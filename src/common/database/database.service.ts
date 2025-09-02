import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DynamoDB } from 'aws-sdk';

@Injectable()
export class DatabaseService {
  private readonly logger = new Logger(DatabaseService.name);
  private dynamoDB: DynamoDB.DocumentClient;
  private isLocalDevelopment: boolean;

  constructor(private configService: ConfigService) {
    this.isLocalDevelopment =
      this.configService.get('NODE_ENV') === 'development';

    if (this.isLocalDevelopment) {
      // For local development, use mock data instead of real DynamoDB
      this.logger.log('Running in local development mode - using mock data');
      return;
    }

    this.dynamoDB = new DynamoDB.DocumentClient({
      region: this.configService.get('AWS_REGION', 'us-east-1'),
      accessKeyId: this.configService.get('AWS_ACCESS_KEY_ID'),
      secretAccessKey: this.configService.get('AWS_SECRET_ACCESS_KEY'),
    });
  }

  async get(tableName: string, key: Record<string, any>): Promise<any> {
    if (this.isLocalDevelopment) {
      this.logger.debug(`Mock GET: ${tableName}`, key);
      return null; // Return null for local development
    }

    const params = {
      TableName: tableName,
      Key: key,
    };

    const result = await this.dynamoDB.get(params).promise();
    return result.Item;
  }

  async put(tableName: string, item: Record<string, any>): Promise<void> {
    if (this.isLocalDevelopment) {
      this.logger.debug(`Mock PUT: ${tableName}`, item);
      return; // Mock successful put for local development
    }

    const params = {
      TableName: tableName,
      Item: item,
    };

    await this.dynamoDB.put(params).promise();
  }

  async update(
    tableName: string,
    key: Record<string, any>,
    updateExpression: string,
    expressionAttributeValues: Record<string, any>,
    expressionAttributeNames?: Record<string, string>
  ): Promise<any> {
    if (this.isLocalDevelopment) {
      this.logger.debug(`Mock UPDATE: ${tableName}`, {
        key,
        updateExpression,
        expressionAttributeValues,
      });
      return {}; // Return empty object for local development
    }

    const params: DynamoDB.DocumentClient.UpdateItemInput = {
      TableName: tableName,
      Key: key,
      UpdateExpression: updateExpression,
      ExpressionAttributeValues: expressionAttributeValues,
      ReturnValues: 'ALL_NEW',
    };

    if (expressionAttributeNames) {
      params.ExpressionAttributeNames = expressionAttributeNames;
    }

    const result = await this.dynamoDB.update(params).promise();
    return result.Attributes;
  }

  async delete(tableName: string, key: Record<string, any>): Promise<void> {
    if (this.isLocalDevelopment) {
      this.logger.debug(`Mock DELETE: ${tableName}`, key);
      return; // Mock successful delete for local development
    }

    const params = {
      TableName: tableName,
      Key: key,
    };

    await this.dynamoDB.delete(params).promise();
  }

  async query(
    tableName: string,
    keyConditionExpression: string,
    expressionAttributeValues: Record<string, any>,
    indexName?: string
  ): Promise<any[]> {
    if (this.isLocalDevelopment) {
      this.logger.debug(`Mock QUERY: ${tableName}`, {
        keyConditionExpression,
        expressionAttributeValues,
        indexName,
      });
      return []; // Return empty array for local development
    }

    const params: DynamoDB.DocumentClient.QueryInput = {
      TableName: tableName,
      KeyConditionExpression: keyConditionExpression,
      ExpressionAttributeValues: expressionAttributeValues,
    };

    if (indexName) {
      params.IndexName = indexName;
    }

    const result = await this.dynamoDB.query(params).promise();
    return result.Items || [];
  }

  async scan(
    tableName: string,
    filterExpression?: string,
    expressionAttributeValues?: Record<string, any>
  ): Promise<any[]> {
    if (this.isLocalDevelopment) {
      this.logger.debug(`Mock SCAN: ${tableName}`, {
        filterExpression,
        expressionAttributeValues,
      });
      return []; // Return empty array for local development
    }

    const params: DynamoDB.DocumentClient.ScanInput = {
      TableName: tableName,
    };

    if (filterExpression) {
      params.FilterExpression = filterExpression;
    }

    if (expressionAttributeValues) {
      params.ExpressionAttributeValues = expressionAttributeValues;
    }

    const result = await this.dynamoDB.scan(params).promise();
    return result.Items || [];
  }
}
