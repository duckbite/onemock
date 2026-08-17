export interface RateLimitConfig {
  limit: number
  windowMs: number
}

export interface RateLimitStatus {
  limited: boolean
  retryAfterMs: number
}

export class RateLimiter {
  private readonly limit: number
  private readonly windowMs: number
  private readonly now: () => number
  private windows = new Map<string, { count: number; windowStart: number }>()

  constructor(config: RateLimitConfig, now: () => number = () => Date.now()) {
    this.limit = config.limit
    this.windowMs = config.windowMs
    this.now = now
  }

  check(key = '__global__'): RateLimitStatus {
    const currentTime = this.now()
    let window = this.windows.get(key)

    if (window === undefined || currentTime - window.windowStart >= this.windowMs) {
      window = { count: 0, windowStart: currentTime }
      this.windows.set(key, window)
    }

    window.count += 1

    if (window.count > this.limit) {
      const retryAfterMs = this.windowMs - (currentTime - window.windowStart)
      return { limited: true, retryAfterMs }
    }

    return { limited: false, retryAfterMs: 0 }
  }

  reset(): void {
    this.windows.clear()
  }
}

export interface LatencyConfig {
  delayMs?: number
  failureRate?: number
}

export interface LatencyResult {
  failed: boolean
}

export async function applyLatency(
  config: LatencyConfig,
  random: () => number = Math.random,
): Promise<LatencyResult> {
  if (config.delayMs !== undefined && config.delayMs > 0) {
    await new Promise((resolve) => setTimeout(resolve, config.delayMs))
  }

  const failureRate = config.failureRate ?? 0
  const failed = failureRate > 0 && random() < failureRate

  return { failed }
}
