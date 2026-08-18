import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createMock, type MockInstance } from 'onemock'
import paymentsApiSpec from '../payments-api.json'
import { createPayment, deletePayment, getAccountBalance, getPayment, listPayments } from './payments'

let mock: MockInstance
let totalAmount: number
let paymentCount: number
let paymentAmounts: Map<string, number>

function syncAccount(): void {
  mock.override('get', '/account', {
    status: 200,
    body: { totalAmount, currency: 'USD', paymentCount },
  })
}

async function recordPayment(amount: number) {
  const payment = await createPayment({ amount, currency: 'USD' })
  paymentAmounts.set(payment.id, amount)
  totalAmount += amount
  paymentCount += 1
  syncAccount()
  return payment
}

async function removePayment(id: string) {
  await deletePayment(id)
  totalAmount -= paymentAmounts.get(id) ?? 0
  paymentCount -= 1
  paymentAmounts.delete(id)
  syncAccount()
}

beforeEach(async () => {
  mock = await createMock(paymentsApiSpec)
  await mock.intercept()
  totalAmount = 0
  paymentCount = 0
  paymentAmounts = new Map()
  syncAccount()
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
    await recordPayment(100)

    const account = await getAccountBalance()

    expect(account).toEqual({ totalAmount: 100, currency: 'USD', paymentCount: 1 })
  })

  it('accumulates the account total across multiple payments', async () => {
    await recordPayment(100)
    await recordPayment(50)

    const account = await getAccountBalance()

    expect(account).toEqual({ totalAmount: 150, currency: 'USD', paymentCount: 2 })
  })

  it('decreases the account total when a payment is deleted', async () => {
    const payment = await recordPayment(100)

    await removePayment(payment.id)

    const account = await getAccountBalance()
    expect(account).toEqual({ totalAmount: 0, currency: 'USD', paymentCount: 0 })
  })

  it('lists all payments', async () => {
    await recordPayment(100)
    await recordPayment(50)

    const payments = await listPayments()

    expect(payments).toHaveLength(2)
  })

  it('gets a single payment by id', async () => {
    const created = await recordPayment(42)

    const fetched = await getPayment(created.id)

    expect(fetched).toEqual(created)
  })

  it('deletes a payment without throwing', async () => {
    const created = await recordPayment(42)

    await expect(removePayment(created.id)).resolves.toBeUndefined()
  })

  it('rejects creating a payment with no amount', async () => {
    await expect(createPayment({} as never)).rejects.toThrow('Failed to create payment: 400')
  })
})
