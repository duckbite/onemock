import type { MockService } from 'onemock'

function asRecord(body: unknown): Record<string, unknown> {
  if (typeof body === 'object' && body !== null) {
    return body as Record<string, unknown>
  }
  return {}
}

function paymentAmount(payment: Record<string, unknown>): number {
  return typeof payment.amount === 'number' ? payment.amount : 0
}

/**
 * Full mock service for the Payments API.
 *
 * Generated from `payments-api.json` using the prompt in
 * `prompts/generate-mock-service.md`. Each key is an OpenAPI
 * `operationId`. Handlers share onemock's in-memory store, so
 * `getAccount` can derive `totalAmount` / `paymentCount` from payments.
 */
export const paymentsMock: MockService = {
  listPayments({ store, collection }) {
    return { status: 200, body: { data: store.list(collection) } }
  },

  createPayment({ body, store, collection }) {
    const created = store.create(collection, {
      ...asRecord(body),
      createdAt: new Date().toISOString(),
    })
    return { status: 201, body: created }
  },

  getPayment({ params, store, collection }) {
    const payment = store.get(collection, params.paymentId)
    if (payment === undefined) {
      return {
        status: 404,
        body: { error: 'not_found', message: 'Payment not found' },
      }
    }
    return { status: 200, body: payment }
  },

  deletePayment({ params, store, collection }) {
    const deleted = store.delete(collection, params.paymentId)
    if (!deleted) {
      return {
        status: 404,
        body: { error: 'not_found', message: 'Payment not found' },
      }
    }
    return { status: 204 }
  },

  getAccount({ store }) {
    const payments = store.list('payments')
    const totalAmount = payments.reduce((sum, payment) => sum + paymentAmount(payment), 0)
    return {
      status: 200,
      body: {
        totalAmount,
        currency: 'USD',
        paymentCount: payments.length,
      },
    }
  },
}
