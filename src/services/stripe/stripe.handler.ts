import { Injectable } from '@nestjs/common';
import { MockHandler } from '../../modules/services/services.service';
import { MockDataService } from '../../common/mock-data/mock-data.service';

@Injectable()
export class StripeHandler implements MockHandler {
  constructor(private readonly mockDataService: MockDataService) {}
  async handle(request: {
    path: string;
    method: string;
    body: any;
    query: any;
    headers: Record<string, string>;
  }): Promise<{
    data: any;
    statusCode: number;
    headers?: Record<string, string>;
  }> {
    const { path, method, body, query } = request;

    // Handle different Stripe endpoints
    if (path.includes('/charges')) {
      return this.handleCharges(path, method, body, query);
    }

    if (path.includes('/customers')) {
      return this.handleCustomers(path, method, body, query);
    }

    if (path.includes('/products')) {
      return this.handleProducts(path, method, body, query);
    }

    // Default response
    return {
      data: {
        id: this.mockDataService.generateId(),
        object: 'mock_object',
        created: this.mockDataService.generateTimestamp(),
        message: `Mock response for Stripe ${method} ${path}`,
      },
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'X-OneMock-Service': 'stripe',
        'X-OneMock-Generated': 'handler',
      },
    };
  }

  private handleCharges(path: string, method: string, body: any, query: any) {
    const chargeId = this.extractIdFromPath(path);

    if (method === 'GET' && chargeId) {
      // Get specific charge
      return {
        data: {
          id: chargeId,
          object: 'charge',
          amount: 2000,
          amount_captured: 2000,
          amount_refunded: 0,
          application: null,
          application_fee: null,
          application_fee_amount: null,
          balance_transaction: `txn_mock_${Date.now()}`,
          billing_details: {
            address: {
              city: 'San Francisco',
              country: 'US',
              line1: '123 Main St',
              line2: null,
              postal_code: '94105',
              state: 'CA',
            },
            email: 'test@example.com',
            name: 'Test Customer',
            phone: null,
          },
          calculated_statement_descriptor: null,
          captured: true,
          created: Math.floor(Date.now() / 1000),
          currency: 'usd',
          customer: `cus_mock_${Date.now()}`,
          description: 'Mock charge for testing',
          disputed: false,
          failure_code: null,
          failure_message: null,
          fraud_details: {},
          invoice: null,
          livemode: false,
          metadata: {},
          on_behalf_of: null,
          order: null,
          outcome: {
            network_status: 'approved_by_network',
            reason: null,
            risk_level: 'normal',
            risk_score: 50,
            seller_message: 'Payment complete.',
            type: 'authorized',
          },
          paid: true,
          payment_intent: `pi_mock_${Date.now()}`,
          payment_method: `pm_mock_${Date.now()}`,
          payment_method_details: {
            card: {
              brand: 'visa',
              checks: {
                address_line1_check: 'pass',
                address_postal_code_check: 'pass',
                cvc_check: 'pass',
              },
              country: 'US',
              exp_month: 12,
              exp_year: 2025,
              fingerprint: 'mock_fingerprint',
              funding: 'credit',
              installments: null,
              last4: '4242',
              mandate: null,
              network: 'visa',
              three_d_secure: null,
              wallet: null,
            },
            type: 'card',
          },
          receipt_email: null,
          receipt_number: null,
          receipt_url: `https://pay.stripe.com/receipts/mock_${Date.now()}`,
          refunded: false,
          refunds: {
            object: 'list',
            data: [],
            has_more: false,
            total_count: 0,
            url: `/v1/charges/${chargeId}/refunds`,
          },
          review: null,
          shipping: null,
          source: null,
          source_transfer: null,
          statement_descriptor: null,
          statement_descriptor_suffix: null,
          status: 'succeeded',
          transfer_data: null,
          transfer_group: null,
        },
        statusCode: 200,
        headers: {
          'Content-Type': 'application/json',
          'X-OneMock-Service': 'stripe',
          'X-OneMock-Generated': 'handler',
        },
      };
    }

    if (method === 'GET') {
      // List charges
      return {
        data: {
          object: 'list',
          data: [
            {
              id: `ch_mock_${Date.now()}`,
              object: 'charge',
              amount: 2000,
              currency: 'usd',
              status: 'succeeded',
              created: Math.floor(Date.now() / 1000),
              description: 'Mock charge 1',
            },
            {
              id: `ch_mock_${Date.now() + 1}`,
              object: 'charge',
              amount: 1500,
              currency: 'usd',
              status: 'succeeded',
              created: Math.floor(Date.now() / 1000) - 3600,
              description: 'Mock charge 2',
            },
          ],
          has_more: false,
          total_count: 2,
          url: '/v1/charges',
        },
        statusCode: 200,
        headers: {
          'Content-Type': 'application/json',
          'X-OneMock-Service': 'stripe',
          'X-OneMock-Generated': 'handler',
        },
      };
    }

    if (method === 'POST') {
      // Create charge
      return {
        data: {
          id: `ch_mock_${Date.now()}`,
          object: 'charge',
          amount: body.amount || 2000,
          currency: body.currency || 'usd',
          status: 'succeeded',
          created: Math.floor(Date.now() / 1000),
          description: body.description || 'Mock charge created',
          customer: body.customer || null,
          source: body.source || null,
          metadata: body.metadata || {},
        },
        statusCode: 201,
        headers: {
          'Content-Type': 'application/json',
          'X-OneMock-Service': 'stripe',
          'X-OneMock-Generated': 'handler',
        },
      };
    }

    return this.getDefaultResponse();
  }

  private handleCustomers(path: string, method: string, body: any, query: any) {
    const customerId = this.extractIdFromPath(path);

    if (method === 'GET' && customerId) {
      // Get specific customer
      return {
        data: {
          id: customerId,
          object: 'customer',
          address: {
            city: 'San Francisco',
            country: 'US',
            line1: '123 Main St',
            line2: null,
            postal_code: '94105',
            state: 'CA',
          },
          balance: 0,
          created: Math.floor(Date.now() / 1000),
          currency: 'usd',
          default_source: null,
          delinquent: false,
          description: 'Mock customer for testing',
          discount: null,
          email: 'test@example.com',
          invoice_prefix: null,
          invoice_settings: {
            custom_fields: null,
            default_payment_method: null,
            footer: null,
          },
          livemode: false,
          metadata: {},
          name: 'Test Customer',
          next_invoice_sequence: 1,
          phone: null,
          preferred_locales: ['en'],
          shipping: null,
          tax_exempt: 'none',
        },
        statusCode: 200,
        headers: {
          'Content-Type': 'application/json',
          'X-OneMock-Service': 'stripe',
          'X-OneMock-Generated': 'handler',
        },
      };
    }

    if (method === 'GET') {
      // List customers
      return {
        data: {
          object: 'list',
          data: [
            {
              id: `cus_mock_${Date.now()}`,
              object: 'customer',
              email: 'test1@example.com',
              name: 'Test Customer 1',
              created: Math.floor(Date.now() / 1000),
            },
            {
              id: `cus_mock_${Date.now() + 1}`,
              object: 'customer',
              email: 'test2@example.com',
              name: 'Test Customer 2',
              created: Math.floor(Date.now() / 1000) - 3600,
            },
          ],
          has_more: false,
          total_count: 2,
          url: '/v1/customers',
        },
        statusCode: 200,
        headers: {
          'Content-Type': 'application/json',
          'X-OneMock-Service': 'stripe',
          'X-OneMock-Generated': 'handler',
        },
      };
    }

    if (method === 'POST') {
      // Create customer
      return {
        data: {
          id: `cus_mock_${Date.now()}`,
          object: 'customer',
          email: body.email || 'test@example.com',
          name: body.name || 'Test Customer',
          description: body.description || 'Mock customer created',
          created: Math.floor(Date.now() / 1000),
          metadata: body.metadata || {},
        },
        statusCode: 201,
        headers: {
          'Content-Type': 'application/json',
          'X-OneMock-Service': 'stripe',
          'X-OneMock-Generated': 'handler',
        },
      };
    }

    return this.getDefaultResponse();
  }

  private handleProducts(path: string, method: string, body: any, query: any) {
    if (method === 'GET') {
      return {
        data: {
          object: 'list',
          data: [
            {
              id: `prod_mock_${Date.now()}`,
              object: 'product',
              active: true,
              attributes: [],
              created: Math.floor(Date.now() / 1000),
              default_price: null,
              description: 'Mock product for testing',
              images: [],
              livemode: false,
              metadata: {},
              name: 'Mock Product',
              package_dimensions: null,
              shippable: null,
              statement_descriptor: null,
              tax_code: null,
              type: 'service',
              unit_label: null,
              updated: Math.floor(Date.now() / 1000),
              url: null,
            },
          ],
          has_more: false,
          total_count: 1,
          url: '/v1/products',
        },
        statusCode: 200,
        headers: {
          'Content-Type': 'application/json',
          'X-OneMock-Service': 'stripe',
          'X-OneMock-Generated': 'handler',
        },
      };
    }

    if (method === 'POST') {
      return {
        data: {
          id: `prod_mock_${Date.now()}`,
          object: 'product',
          active: true,
          attributes: [],
          created: Math.floor(Date.now() / 1000),
          default_price: null,
          description: body.description || 'Mock product created',
          images: [],
          livemode: false,
          metadata: body.metadata || {},
          name: body.name || 'Mock Product',
          package_dimensions: null,
          shippable: null,
          statement_descriptor: null,
          tax_code: null,
          type: body.type || 'service',
          unit_label: null,
          updated: Math.floor(Date.now() / 1000),
          url: null,
        },
        statusCode: 201,
        headers: {
          'Content-Type': 'application/json',
          'X-OneMock-Service': 'stripe',
          'X-OneMock-Generated': 'handler',
        },
      };
    }

    return this.getDefaultResponse();
  }

  private extractIdFromPath(path: string): string | null {
    const parts = path.split('/');
    const lastPart = parts[parts.length - 1];

    // Check if it looks like an ID (starts with common prefixes)
    if (
      lastPart &&
      (lastPart.startsWith('ch_') ||
        lastPart.startsWith('cus_') ||
        lastPart.startsWith('prod_'))
    ) {
      return lastPart;
    }

    return null;
  }

  private getDefaultResponse() {
    return {
      data: {
        id: `mock_${Date.now()}`,
        object: 'mock_object',
        created: Math.floor(Date.now() / 1000),
        message: 'Mock response from Stripe handler',
      },
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'X-OneMock-Service': 'stripe',
        'X-OneMock-Generated': 'handler',
      },
    };
  }
}
