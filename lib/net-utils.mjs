// Network/environment utilities shared by the LLM provider clients.
// Kept dependency-free so it runs in plain Node without a build step.
//
// Background (issue #19): on WSL2, NAT routing can resolve a host to an IPv6
// address that isn't reachable, making fetch() hang until ETIMEDOUT. We force
// IPv4-first DNS resolution only on WSL2, and retry transient network failures.

import { readFileSync } from 'node:fs'
import { setDefaultResultOrder } from 'node:dns'

// Network error codes that benefit from a retry under WSL2's flaky NAT.
// HTTP errors (4xx/5xx) are NOT retried — callers surface those as-is.
const RETRYABLE_NET_CODES = new Set([
  'ETIMEDOUT',
  'ECONNRESET',
  'ECONNREFUSED',
  'EAI_AGAIN',
  'UND_ERR_SOCKET',
  'UND_ERR_CONNECT_TIMEOUT',
])

const DEFAULT_BACKOFFS_MS = [500, 1500]

function defaultSleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export function hasDnsResultOrderOverride() {
  if (process.env.NODE_OPTIONS?.includes('--dns-result-order')) return true

  for (let i = 0; i < process.execArgv.length; i++) {
    const arg = process.execArgv[i]
    if (arg === '--dns-result-order') return true
    if (arg?.startsWith('--dns-result-order=')) return true
  }

  return false
}

// Returns true only when running inside WSL2 (Windows Subsystem for Linux v2).
// Generic WSL env vars such as WSL_DISTRO_NAME / WSL_INTEROP are not enough to
// distinguish WSL1 from WSL2, so check kernel metadata for a WSL2-specific
// marker instead.
export function isWSL2() {
  try {
    if (/wsl2/i.test(readFileSync('/proc/sys/kernel/osrelease', 'utf8')))
      return true
  } catch {}

  try {
    return /microsoft.*wsl2|wsl2.*microsoft/i.test(
      readFileSync('/proc/version', 'utf8')
    )
  } catch {
    return false
  }
}

// Force IPv4-first DNS only on WSL2 so that other hosts keep their default
// (verbatim) ordering. Honors any user-provided --dns-result-order override.
// Returns true when the workaround was applied. Safe to call once at startup.
export function applyWsl2DnsWorkaround() {
  if (isWSL2() && !hasDnsResultOrderOverride()) {
    setDefaultResultOrder('ipv4first')
    return true
  }
  return false
}

export function isRetryableNetworkError(err) {
  if (!err) return false
  const codes = []
  if (err.code) codes.push(err.code)
  if (err.cause?.code) codes.push(err.cause.code)
  for (const inner of err.cause?.errors || []) {
    if (inner?.code) codes.push(inner.code)
  }
  return codes.some((c) => RETRYABLE_NET_CODES.has(c))
}

// fetch() wrapper that retries only transient network failures (never HTTP
// responses). Returns the Response so callers keep their own status handling.
export async function fetchWithRetry(url, init, options = {}) {
  const {
    backoffsMs = DEFAULT_BACKOFFS_MS,
    sleep = defaultSleep,
    onRetry,
  } = options

  for (let attempt = 0; attempt <= backoffsMs.length; attempt++) {
    try {
      return await fetch(url, init)
    } catch (err) {
      if (attempt < backoffsMs.length && isRetryableNetworkError(err)) {
        if (onRetry) onRetry(attempt, err, backoffsMs[attempt])
        await sleep(backoffsMs[attempt])
        continue
      }
      throw err
    }
  }
}
