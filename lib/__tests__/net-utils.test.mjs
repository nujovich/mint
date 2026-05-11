import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
import { readFileSync } from 'node:fs'
import { hasDnsResultOrderOverride, isWSL2 } from '../net-utils.mjs'

vi.mock('node:fs', () => ({
  readFileSync: vi.fn(),
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
      if (String(path).includes('osrelease')) return '5.15.153.1-microsoft-standard-WSL2'
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
    vi.mocked(readFileSync).mockImplementation(() => { throw new Error('ENOENT') })
    expect(isWSL2()).toBe(false)
  })
})
