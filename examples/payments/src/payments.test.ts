import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createMock, type MockInstance } from 'onemock'
import paymentsApiSpec from '../payments-api.json'
import {
  createPayment,
  deletePayment,
  getAccountBalance,
  getPayment,
  listPayments,
} from './payments'
import { paymentsMock } from './mocks/payments'

let mock: MockInstance

beforeEach(async () => {
  mock = await createMock(paymentsApiSpec, { handlers: paymentsMock })
  await mock.intercept()
})

afterEach(async () => {
  await mock.close()
})

describe('payments client', () => {
  it('starts with a zeroed account before any payment exists', async () => {
    const account = await getAccountBalance()

    expect(account).toEqual({ totalAmount: 0, currency: 'USD', paymentCount: 0 })
  })

  it('increases the account total when a payment is created', async () => {
    await createPayment({ amount: 100, currency: 'USD' })

    const account = await getAccountBalance()

    expect(account).toEqual({ totalAmount: 100, currency: 'USD', paymentCount: 1 })
  })

  it('accumulates the account total across multiple payments', async () => {
    await createPayment({ amount: 100, currency: 'USD' })
    await createPayment({ amount: 50, currency: 'USD' })

    const account = await getAccountBalance()

    expect(account).toEqual({ totalAmount: 150, currency: 'USD', paymentCount: 2 })
  })

  it('decreases the account total when a payment is deleted', async () => {
    const payment = await createPayment({ amount: 100, currency: 'USD' })

    await deletePayment(payment.id)

    const account = await getAccountBalance()
    expect(account).toEqual({ totalAmount: 0, currency: 'USD', paymentCount: 0 })
  })

  it('lists all payments', async () => {
    await createPayment({ amount: 100, currency: 'USD' })
    await createPayment({ amount: 50, currency: 'USD' })

    const payments = await listPayments()

    expect(payments).toHaveLength(2)
  })

  it('gets a single payment by id', async () => {
    const created = await createPayment({ amount: 42, currency: 'USD' })

    const fetched = await getPayment(created.id)

    expect(fetched).toEqual(created)
  })

  it('deletes a payment without throwing', async () => {
    const created = await createPayment({ amount: 42, currency: 'USD' })

    await expect(deletePayment(created.id)).resolves.toBeUndefined()
  })

  it('rejects creating a payment with no amount', async () => {
    await expect(createPayment({} as never)).rejects.toThrow('Failed to create payment: 400')
  })
})
