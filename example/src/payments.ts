const PAYMENTS_API_BASE_URL = 'https://api.payments-provider.test'

export interface Payment {
  id: string
  amount: number
  currency?: string
  description?: string
  createdAt?: string
}

export interface NewPayment {
  amount: number
  currency?: string
  description?: string
}

export interface Account {
  totalAmount: number
  currency: string
  paymentCount: number
}

export async function createPayment(input: NewPayment): Promise<Payment> {
  const response = await fetch(`${PAYMENTS_API_BASE_URL}/payments`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
  if (!response.ok) {
    throw new Error(`Failed to create payment: ${response.status}`)
  }
  return (await response.json()) as Payment
}

export async function getPayment(paymentId: string): Promise<Payment> {
  const response = await fetch(`${PAYMENTS_API_BASE_URL}/payments/${paymentId}`)
  if (!response.ok) {
    throw new Error(`Failed to get payment ${paymentId}: ${response.status}`)
  }
  return (await response.json()) as Payment
}

export async function listPayments(): Promise<Payment[]> {
  const response = await fetch(`${PAYMENTS_API_BASE_URL}/payments`)
  if (!response.ok) {
    throw new Error(`Failed to list payments: ${response.status}`)
  }
  const body = (await response.json()) as { data: Payment[] }
  return body.data
}

export async function deletePayment(paymentId: string): Promise<void> {
  const response = await fetch(`${PAYMENTS_API_BASE_URL}/payments/${paymentId}`, {
    method: 'DELETE',
  })
  if (!response.ok) {
    throw new Error(`Failed to delete payment ${paymentId}: ${response.status}`)
  }
}

export async function getAccountBalance(): Promise<Account> {
  const response = await fetch(`${PAYMENTS_API_BASE_URL}/account`)
  if (!response.ok) {
    throw new Error(`Failed to get account balance: ${response.status}`)
  }
  return (await response.json()) as Account
}
