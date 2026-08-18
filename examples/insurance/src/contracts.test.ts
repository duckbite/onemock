import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createMock, type MockInstance } from 'onemock'
import consumerSpec from '../consumer-contracts-api.json'
import corporateSpec from '../corporate-contracts-api.json'
import { consumerContractsMock } from './mocks/consumer'
import { corporateContractsMock } from './mocks/corporate'
import { getContractsByLicensePlate } from './contracts'

let consumer: MockInstance
let corporate: MockInstance

beforeEach(async () => {
  consumer = await createMock(consumerSpec, { handlers: consumerContractsMock })
  corporate = await createMock(corporateSpec, { handlers: corporateContractsMock })
  await consumer.intercept()
  await corporate.intercept()
})

afterEach(async () => {
  await consumer.close()
  await corporate.close()
})

describe('getContractsByLicensePlate', () => {
  it('returns an empty list when neither database has the plate', async () => {
    await expect(getContractsByLicensePlate('AB-123-C')).resolves.toEqual([])
  })

  it('returns a consumer policy for the plate without touching corporate data', async () => {
    consumer.seed('/personal-policies', {
      policyId: 'POL-100',
      licensePlate: 'AB-123-C',
      customerName: 'Ada Lovelace',
      product: 'comprehensive',
      premiumMonthly: 89,
    })
    corporate.seed('/v2/contracts', {
      contractRef: 'FLT-9',
      registrationNumber: 'ZZ-999-Z',
      legalEntity: 'Other Corp',
      fleetId: 'FLEET-99',
      annualPremium: 9000,
    })

    await expect(getContractsByLicensePlate('AB-123-C')).resolves.toEqual([
      {
        source: 'consumer',
        id: 'POL-100',
        licensePlate: 'AB-123-C',
        holder: 'Ada Lovelace',
        premium: { amount: 89, period: 'monthly' },
      },
    ])
  })

  it('returns a corporate contract for the plate without touching consumer data', async () => {
    consumer.seed('/personal-policies', {
      policyId: 'POL-100',
      licensePlate: 'ZZ-999-Z',
      customerName: 'Ada Lovelace',
      product: 'comprehensive',
      premiumMonthly: 89,
    })
    corporate.seed('/v2/contracts', {
      contractRef: 'FLT-9',
      registrationNumber: 'AB-123-C',
      legalEntity: 'Acme Logistics BV',
      fleetId: 'FLEET-01',
      annualPremium: 4200,
    })

    await expect(getContractsByLicensePlate('AB-123-C')).resolves.toEqual([
      {
        source: 'corporate',
        id: 'FLT-9',
        licensePlate: 'AB-123-C',
        holder: 'Acme Logistics BV',
        premium: { amount: 4200, period: 'annual' },
      },
    ])
  })

  it('merges contracts from both databases for the same license plate', async () => {
    consumer.seed('/personal-policies', {
      policyId: 'POL-100',
      licensePlate: 'AB-123-C',
      customerName: 'Ada Lovelace',
      product: 'comprehensive',
      premiumMonthly: 89,
    })
    corporate.seed('/v2/contracts', {
      contractRef: 'FLT-9',
      registrationNumber: 'AB-123-C',
      legalEntity: 'Acme Logistics BV',
      fleetId: 'FLEET-01',
      annualPremium: 4200,
    })

    await expect(getContractsByLicensePlate('AB-123-C')).resolves.toEqual([
      {
        source: 'consumer',
        id: 'POL-100',
        licensePlate: 'AB-123-C',
        holder: 'Ada Lovelace',
        premium: { amount: 89, period: 'monthly' },
      },
      {
        source: 'corporate',
        id: 'FLT-9',
        licensePlate: 'AB-123-C',
        holder: 'Acme Logistics BV',
        premium: { amount: 4200, period: 'annual' },
      },
    ])
  })
})
