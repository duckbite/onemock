const CONSUMER_API_BASE_URL = 'https://api.citocover.test'
const CORPORATE_API_BASE_URL = 'https://contracts.fleetcover.test'

export interface InsuranceContract {
  source: 'consumer' | 'corporate'
  id: string
  licensePlate: string
  holder: string
  premium: { amount: number; period: 'monthly' | 'annual' }
}

interface PersonalPolicy {
  policyId: string
  licensePlate: string
  customerName: string
  product?: string
  premiumMonthly: number
}

interface FleetContract {
  contractRef: string
  registrationNumber: string
  legalEntity: string
  fleetId?: string
  annualPremium: number
}

export async function getContractsByLicensePlate(
  licensePlate: string,
): Promise<InsuranceContract[]> {
  const consumerUrl = `${CONSUMER_API_BASE_URL}/personal-policies?licensePlate=${encodeURIComponent(licensePlate)}`
  const corporateUrl = `${CORPORATE_API_BASE_URL}/v2/contracts?registrationNumber=${encodeURIComponent(licensePlate)}`

  const [consumerResponse, corporateResponse] = await Promise.all([
    fetch(consumerUrl),
    fetch(corporateUrl),
  ])

  if (!consumerResponse.ok) {
    throw new Error(`Failed to look up consumer policies: ${consumerResponse.status}`)
  }
  if (!corporateResponse.ok) {
    throw new Error(`Failed to look up corporate contracts: ${corporateResponse.status}`)
  }

  const consumerBody = (await consumerResponse.json()) as { policies: PersonalPolicy[] }
  const corporateBody = (await corporateResponse.json()) as { results: FleetContract[] }

  const fromConsumer: InsuranceContract[] = consumerBody.policies.map((policy) => ({
    source: 'consumer',
    id: policy.policyId,
    licensePlate: policy.licensePlate,
    holder: policy.customerName,
    premium: { amount: policy.premiumMonthly, period: 'monthly' },
  }))

  const fromCorporate: InsuranceContract[] = corporateBody.results.map((contract) => ({
    source: 'corporate',
    id: contract.contractRef,
    licensePlate: contract.registrationNumber,
    holder: contract.legalEntity,
    premium: { amount: contract.annualPremium, period: 'annual' },
  }))

  return [...fromConsumer, ...fromCorporate]
}
