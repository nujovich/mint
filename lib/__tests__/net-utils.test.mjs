import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
import { readFileSync } from 'node:fs'
import { setDefaultResultOrder } from 'node:dns'
import {
  hasDnsResultOrderOverride,
  isWSL2,
  isRetryableNetworkError,
  fetchWithRetry,
  applyWsl2DnsWorkaround,
} from '../net-utils.mjs'

vi.mock('node:fs', () => ({
  readFileSync: vi.fn(),
}))

vi.mock('node:dns', () => ({
  setDefaultResultOrder: vi.fn(),
}))

describe('hasDnsResultOrderOverride', () => {
  let originalExecArgv

  beforeEach(() => {
    originalExecArgv = process.execArgv
    process.execArgv = []
    vi.stubEnv('NODE_OPTIONS', '')
  })

  afterEach(() => {
    process.execArgv = originalExecArgv
    vi.unstubAllEnvs()
  })

  it('returns true when NODE_OPTIONS includes --dns-result-order', () => {
    vi.stubEnv('NODE_OPTIONS', '--dns-result-order=verbatim')
    expect(hasDnsResultOrderOverride()).toBe(true)
  })

  it('returns true when execArgv contains --dns-result-order', () => {
    process.execArgv = ['--dns-result-order']
    expect(hasDnsResultOrderOverride()).toBe(true)
  })

  it('returns true when execArgv contains --dns-result-order=value', () => {
    process.execArgv = ['--dns-result-order=verbatim']
    expect(hasDnsResultOrderOverride()).toBe(true)
  })

  it('returns false when neither NODE_OPTIONS nor execArgv signal an override', () => {
    expect(hasDnsResultOrderOverride()).toBe(false)
  })
})

describe('isWSL2', () => {
  afterEach(() => {
    vi.mocked(readFileSync).mockReset()
  })

  it('returns true when /proc/sys/kernel/osrelease contains wsl2', () => {
    vi.mocked(readFileSync).mockImplementation((path) => {
      if (String(path).includes('osrelease'))
        return '5.15.153.1-microsoft-standard-WSL2'
      throw new Error('ENOENT')
    })
    expect(isWSL2()).toBe(true)
  })

  it('returns true when /proc/version matches microsoft.*wsl2 pattern', () => {
    vi.mocked(readFileSync).mockImplementation((path) => {
      if (String(path).includes('osrelease')) throw new Error('ENOENT')
      return 'Linux version 5.15.0-microsoft-standard-WSL2 (gcc)'
    })
    expect(isWSL2()).toBe(true)
  })

  it('returns true when /proc/version matches wsl2.*microsoft pattern', () => {
    vi.mocked(readFileSync).mockImplementation((path) => {
      if (String(path).includes('osrelease')) throw new Error('ENOENT')
      return 'Linux WSL2-microsoft kernel'
    })
    expect(isWSL2()).toBe(true)
  })

  it('returns false when /proc/version contains microsoft but not wsl2', () => {
    vi.mocked(readFileSync).mockImplementation((path) => {
      if (String(path).includes('osrelease')) throw new Error('ENOENT')
      return 'Linux microsoft version'
    })
    expect(isWSL2()).toBe(false)
  })

  it('returns false when /proc/version has no microsoft or wsl2', () => {
    vi.mocked(readFileSync).mockImplementation((path) => {
      if (String(path).includes('osrelease')) throw new Error('ENOENT')
      return 'Linux 5.15.0 Ubuntu'
    })
    expect(isWSL2()).toBe(false)
  })

  it('returns false when both reads throw', () => {
    vi.mocked(readFileSync).mockImplementation(() => {
      throw new Error('ENOENT')
    })
    expect(isWSL2()).toBe(false)
  })
})

describe('isRetryableNetworkError', () => {
  it.each([
    'ETIMEDOUT',
    'ECONNRESET',
    'ECONNREFUSED',
    'EAI_AGAIN',
    'UND_ERR_SOCKET',
    'UND_ERR_CONNECT_TIMEOUT',
  ])('returns true for top-level code %s', (code) => {
    expect(
      isRetryableNetworkError(Object.assign(new Error('x'), { code }))
    ).toBe(true)
  })

  it('returns true when the code is on err.cause', () => {
    const err = new Error('fetch failed')
    err.cause = Object.assign(new Error('inner'), { code: 'ECONNRESET' })
    expect(isRetryableNetworkError(err)).toBe(true)
  })

  it('returns true when a retryable code is nested in cause.errors (undici aggregate)', () => {
    const err = new Error('fetch failed')
    err.cause = { errors: [{ code: 'EAI_AGAIN' }, { code: 'ETIMEDOUT' }] }
    expect(isRetryableNetworkError(err)).toBe(true)
  })

  it('returns false for a plain error with no network code', () => {
    expect(
      isRetryableNetworkError(new Error('Anthropic API error (500)'))
    ).toBe(false)
  })

  it('returns false for a non-retryable code', () => {
    expect(
      isRetryableNetworkError(
        Object.assign(new Error('x'), { code: 'ENOTFOUND' })
      )
    ).toBe(false)
  })

  it('returns false for null/undefined', () => {
    expect(isRetryableNetworkError(null)).toBe(false)
    expect(isRetryableNetworkError(undefined)).toBe(false)
  })
})

describe('fetchWithRetry', () => {
  const noSleep = () => Promise.resolve()

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('returns the response on the first successful attempt', async () => {
    const response = { ok: true, status: 200 }
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(response)

    const result = await fetchWithRetry(
      'https://x',
      { method: 'POST' },
      { sleep: noSleep }
    )

    expect(result).toBe(response)
    expect(fetchSpy).toHaveBeenCalledTimes(1)
    expect(fetchSpy).toHaveBeenCalledWith('https://x', { method: 'POST' })
  })

  it('retries transient network errors then succeeds', async () => {
    const response = { ok: true, status: 200 }
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockRejectedValueOnce(
        Object.assign(new Error('boom'), { code: 'ETIMEDOUT' })
      )
      .mockRejectedValueOnce(
        Object.assign(new Error('boom'), { code: 'ECONNRESET' })
      )
      .mockResolvedValue(response)

    const result = await fetchWithRetry(
      'https://x',
      {},
      { backoffsMs: [0, 0], sleep: noSleep }
    )

    expect(result).toBe(response)
    expect(fetchSpy).toHaveBeenCalledTimes(3)
  })

  it('does not retry a non-retryable error', async () => {
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockRejectedValue(
        Object.assign(new Error('nope'), { code: 'ENOTFOUND' })
      )

    await expect(
      fetchWithRetry('https://x', {}, { backoffsMs: [0, 0], sleep: noSleep })
    ).rejects.toThrow('nope')
    expect(fetchSpy).toHaveBeenCalledTimes(1)
  })

  it('gives up and rethrows after exhausting retries', async () => {
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockRejectedValue(
        Object.assign(new Error('still down'), { code: 'ETIMEDOUT' })
      )

    await expect(
      fetchWithRetry('https://x', {}, { backoffsMs: [0, 0], sleep: noSleep })
    ).rejects.toThrow('still down')
    expect(fetchSpy).toHaveBeenCalledTimes(3)
  })

  it('invokes onRetry for each retry with attempt index and delay', async () => {
    vi.spyOn(globalThis, 'fetch')
      .mockRejectedValueOnce(
        Object.assign(new Error('boom'), { code: 'ETIMEDOUT' })
      )
      .mockResolvedValue({ ok: true })
    const onRetry = vi.fn()

    await fetchWithRetry(
      'https://x',
      {},
      { backoffsMs: [7, 9], sleep: noSleep, onRetry }
    )

    expect(onRetry).toHaveBeenCalledTimes(1)
    expect(onRetry).toHaveBeenCalledWith(0, expect.any(Error), 7)
  })
})

describe('applyWsl2DnsWorkaround', () => {
  beforeEach(() => {
    process.execArgv = []
    vi.stubEnv('NODE_OPTIONS', '')
  })

  afterEach(() => {
    vi.mocked(readFileSync).mockReset()
    vi.mocked(setDefaultResultOrder).mockReset()
    vi.unstubAllEnvs()
  })

  it('forces ipv4first when on WSL2 without an override', () => {
    vi.mocked(readFileSync).mockImplementation((path) => {
      if (String(path).includes('osrelease'))
        return '5.15-microsoft-standard-WSL2'
      throw new Error('ENOENT')
    })

    expect(applyWsl2DnsWorkaround()).toBe(true)
    expect(setDefaultResultOrder).toHaveBeenCalledWith('ipv4first')
  })

  it('does nothing when not on WSL2', () => {
    vi.mocked(readFileSync).mockImplementation(() => 'Linux Ubuntu')

    expect(applyWsl2DnsWorkaround()).toBe(false)
    expect(setDefaultResultOrder).not.toHaveBeenCalled()
  })

  it('does not override an explicit user --dns-result-order', () => {
    vi.mocked(readFileSync).mockImplementation((path) => {
      if (String(path).includes('osrelease')) return 'microsoft-standard-WSL2'
      throw new Error('ENOENT')
    })
    vi.stubEnv('NODE_OPTIONS', '--dns-result-order=verbatim')

    expect(applyWsl2DnsWorkaround()).toBe(false)
    expect(setDefaultResultOrder).not.toHaveBeenCalled()
  })
})
