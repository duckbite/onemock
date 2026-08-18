import type { MockService } from 'onemock'

function asRecord(body: unknown): Record<string, unknown> {
  if (typeof body === 'object' && body !== null) {
    return body as Record<string, unknown>
  }
  return {}
}

function matchesPlate(policy: Record<string, unknown>, licensePlate: string): boolean {
  return policy.licensePlate === licensePlate
}

/**
 * Full mock service for the CitoCover Personal Motor API.
 *
 * Generated from `consumer-contracts-api.json` using the prompt in
 * `prompts/generate-mock-service.md`. Lookup filters stored policies by
 * `licensePlate` instead of returning the whole collection.
 */
export const consumerContractsMock: MockService = {
  findPersonalPolicies({ query, store, collection }) {
    const policies = store
      .list(collection)
      .filter((policy) => matchesPlate(policy, query.licensePlate))
    return { status: 200, body: { policies } }
  },

  createPersonalPolicy({ body, store, collection }) {
    const input = asRecord(body)
    const created = store.create(collection, input)
    return {
      status: 201,
      body: { ...created, policyId: created.policyId ?? created.id },
    }
  },

  getPersonalPolicy({ params, store, collection }) {
    const policy = store
      .list(collection)
      .find((item) => item.policyId === params.policyId || item.id === params.policyId)
    if (policy === undefined) {
      return {
        status: 404,
        body: { error: 'not_found', message: 'Policy not found' },
      }
    }
    return { status: 200, body: policy }
  },
}
