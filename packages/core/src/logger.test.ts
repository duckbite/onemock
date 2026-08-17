import { describe, expect, it, vi } from 'vitest'
import { createLogger } from './logger'

describe('createLogger', () => {
  it('never calls the sink when the level is off', () => {
    const sink = vi.fn()
    const logger = createLogger('off', sink)

    logger.log({ method: 'get', path: '/pets', status: 200 })

    expect(sink).not.toHaveBeenCalled()
  })

  it('logs a single summary line at basic level', () => {
    const sink = vi.fn()
    const logger = createLogger('basic', sink)

    logger.log({ method: 'get', path: '/pets', status: 200 })

    expect(sink).toHaveBeenCalledTimes(1)
    expect(sink).toHaveBeenCalledWith('[onemock] GET /pets -> 200')
  })

  it('includes query, body, and response details at verbose level', () => {
    const sink = vi.fn()
    const logger = createLogger('verbose', sink)

    logger.log({
      method: 'post',
      path: '/pets',
      status: 201,
      query: { a: '1' },
      body: { name: 'Rex' },
      responseBody: { id: '1', name: 'Rex' },
    })

    const message = sink.mock.calls[0][0] as string
    expect(message).toContain('[onemock] POST /pets -> 201')
    expect(message).toContain('"a":"1"')
    expect(message).toContain('"name":"Rex"')
    expect(message).toContain('"id":"1"')
  })
})
