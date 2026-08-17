import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createMock, type MockInstance } from 'onemock'
import paymentsApiSpec from '../payments-api.json'

interface Payment {
  id: string
  amount: number
  currency?: string
  description?: string
}

let mock: MockInstance
let port: number
let totalAmount: number
let paymentCount: number
let paymentAmounts: Map<string, number>

function syncAccount(): void {
  mock.override('get', '/account', {
    status: 200,
    body: { totalAmount, currency: 'USD', paymentCount },
  })
}

async function createPayment(amount: number): Promise<Payment> {
  const res = await fetch(`http://localhost:${port}/payments`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ amount, currency: 'USD' }),
  })
  const payment = (await res.json()) as Payment
  paymentAmounts.set(payment.id, amount)
  totalAmount += amount
  paymentCount += 1
  syncAccount()
  return payment
}

async function deletePayment(id: string): Promise<void> {
  await fetch(`http://localhost:${port}/payments/${id}`, { method: 'DELETE' })
  totalAmount -= paymentAmounts.get(id) ?? 0
  paymentCount -= 1
  paymentAmounts.delete(id)
  syncAccount()
}

beforeEach(async () => {
  mock = await createMock(paymentsApiSpec)
  const listen = await mock.listen(0)
  port = listen.port
  totalAmount = 0
  paymentCount = 0
  paymentAmounts = new Map()
  syncAccount()
})

afterEach(async () => {
  await mock.close()
})

describe('Payments API mock', () => {
  it('starts with a zeroed account before any payment exists', async () => {
    const response = await fetch(`http://localhost:${port}/account`)
    const account = await response.json()

    expect(account).toEqual({ totalAmount: 0, currency: 'USD', paymentCount: 0 })
  })

  it('increases totalAmount when a payment is created', async () => {
    await createPayment(100)

    const account = await (await fetch(`http://localhost:${port}/account`)).json()

    expect(account).toEqual({ totalAmount: 100, currency: 'USD', paymentCount: 1 })
  })

  it('accumulates totalAmount across multiple payments', async () => {
    await createPayment(100)
    await createPayment(50)

    const account = await (await fetch(`http://localhost:${port}/account`)).json()

    expect(account).toEqual({ totalAmount: 150, currency: 'USD', paymentCount: 2 })
  })

  it('decreases totalAmount when a payment is deleted', async () => {
    const payment = await createPayment(100)

    await deletePayment(payment.id)

    const account = await (await fetch(`http://localhost:${port}/account`)).json()
    expect(account).toEqual({ totalAmount: 0, currency: 'USD', paymentCount: 0 })
  })

  it('lists all payments', async () => {
    await createPayment(100)
    await createPayment(50)

    const response = await fetch(`http://localhost:${port}/payments`)
    const body = (await response.json()) as { data: Payment[]; total: number }

    expect(body.data).toHaveLength(2)
    expect(body.total).toBe(2)
  })

  it('gets a single payment by id', async () => {
    const created = await createPayment(42)

    const response = await fetch(`http://localhost:${port}/payments/${created.id}`)
    const fetched = await response.json()

    expect(fetched).toEqual(created)
  })

  it('returns 204 with no body when deleting a payment', async () => {
    const created = await createPayment(42)

    const response = await fetch(`http://localhost:${port}/payments/${created.id}`, {
      method: 'DELETE',
    })

    expect(response.status).toBe(204)
    expect(await response.text()).toBe('')
  })

  it('rejects creating a payment with no amount', async () => {
    const response = await fetch(`http://localhost:${port}/payments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ currency: 'USD' }),
    })

    expect(response.status).toBe(400)
  })
})
