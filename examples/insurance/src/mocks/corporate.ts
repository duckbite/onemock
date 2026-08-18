import type { MockService } from 'onemock'

function asRecord(body: unknown): Record<string, unknown> {
  if (typeof body === 'object' && body !== null) {
    return body as Record<string, unknown>
  }
  return {}
}

function matchesRegistration(contract: Record<string, unknown>, registrationNumber: string): boolean {
  return contract.registrationNumber === registrationNumber
}

/**
 * Full mock service for the FleetCover Corporate Contracts API.
 *
 * Generated from `corporate-contracts-api.json` using the prompt in
 * `prompts/generate-mock-service.md`. Search filters stored contracts by
 * `registrationNumber` — a different query param and envelope than the
 * consumer API.
 */
export const corporateContractsMock: MockService = {
  searchFleetContracts({ query, store, collection }) {
    const results = store
      .list(collection)
      .filter((contract) => matchesRegistration(contract, query.registrationNumber))
    return { status: 200, body: { results } }
  },

  registerFleetContract({ body, store, collection }) {
    const input = asRecord(body)
    const created = store.create(collection, input)
    return {
      status: 201,
      body: { ...created, contractRef: created.contractRef ?? created.id },
    }
  },

  getFleetContract({ params, store, collection }) {
    const contract = store
      .list(collection)
      .find((item) => item.contractRef === params.contractRef || item.id === params.contractRef)
    if (contract === undefined) {
      return {
        status: 404,
        body: { error: 'not_found', message: 'Contract not found' },
      }
    }
    return { status: 200, body: contract }
  },
}
