const DELAYS_MS = [0, 1000, 2000, 5000, 10000, 30000]

export function retryDelay(attempt: number): number {
  const base = DELAYS_MS[Math.min(attempt, DELAYS_MS.length - 1)] ?? 30000
  const jitter = Math.floor(Math.random() * 250)
  return base + jitter
}

export const MAX_RETRY_ATTEMPTS = 16
