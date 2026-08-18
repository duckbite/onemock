import { describe, expect, it, vi } from 'vitest'
import { RateLimiter, applyLatency } from './simulators'

describe('RateLimiter', () => {
  it('allows requests up to the limit and blocks the next one', () => {
    const limiter = new RateLimiter({ limit: 2, windowMs: 1000 })

    expect(limiter.check().limited).toBe(false)
    expect(limiter.check().limited).toBe(false)
    expect(limiter.check().limited).toBe(true)
  })

  it('reports a positive retryAfterMs when limited', () => {
    const limiter = new RateLimiter({ limit: 1, windowMs: 1000 })
    limiter.check()

    const result = limiter.check()

    expect(result.limited).toBe(true)
    expect(result.retryAfterMs).toBeGreaterThan(0)
  })

  it('resets the count once the window elapses', () => {
    let now = 0
    const limiter = new RateLimiter({ limit: 1, windowMs: 1000 }, () => now)

    expect(limiter.check().limited).toBe(false)
    now = 1500
    expect(limiter.check().limited).toBe(false)
  })

  it('tracks separate keys independently', () => {
    const limiter = new RateLimiter({ limit: 1, windowMs: 1000 })

    expect(limiter.check('a').limited).toBe(false)
    expect(limiter.check('b').limited).toBe(false)
  })

  it('reset clears all counters', () => {
    const limiter = new RateLimiter({ limit: 1, windowMs: 1000 })
    limiter.check()
    limiter.reset()

    expect(limiter.check().limited).toBe(false)
  })
})

describe('applyLatency', () => {
  it('waits at least delayMs before resolving', async () => {
    vi.useFakeTimers()
    try {
      let settled = false
      const pending = applyLatency({ delayMs: 20 }).then((result) => {
        settled = true
        return result
      })

      await vi.advanceTimersByTimeAsync(19)
      expect(settled).toBe(false)

      await vi.advanceTimersByTimeAsync(1)
      await pending
      expect(settled).toBe(true)
    } finally {
      vi.useRealTimers()
    }
  })

  it('never fails when failureRate is 0', async () => {
    const result = await applyLatency({ failureRate: 0 }, () => 0)

    expect(result.failed).toBe(false)
  })

  it('always fails when failureRate is 1', async () => {
    const result = await applyLatency({ failureRate: 1 }, () => 0.5)

    expect(result.failed).toBe(true)
  })

  it('does not fail when the random draw exceeds failureRate', async () => {
    const result = await applyLatency({ failureRate: 0.3 }, () => 0.9)

    expect(result.failed).toBe(false)
  })
})
