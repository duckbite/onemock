export type LogLevel = 'off' | 'basic' | 'verbose'

export interface LogEntry {
  method: string
  path: string
  status: number
  query?: Record<string, string>
  body?: unknown
  responseBody?: unknown
}

export interface Logger {
  log(entry: LogEntry): void
}

export function createLogger(
  level: LogLevel = 'off',
  sink: (message: string) => void = console.log,
): Logger {
  return {
    log(entry: LogEntry) {
      if (level === 'off') return

      const line = `[onemock] ${entry.method.toUpperCase()} ${entry.path} -> ${entry.status}`
      if (level === 'basic') {
        sink(line)
        return
      }

      sink(
        `${line}\n  query: ${JSON.stringify(entry.query ?? {})}\n  body: ${JSON.stringify(entry.body)}\n  response: ${JSON.stringify(entry.responseBody)}`,
      )
    },
  }
}
