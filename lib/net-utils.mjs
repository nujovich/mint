// Internal network/environment utilities for lib/prompts.mjs.
// Not part of the published package surface — import directly from this
// module in tests rather than going through prompts.mjs.

import { readFileSync } from 'node:fs'

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
    if (/wsl2/i.test(readFileSync('/proc/sys/kernel/osrelease', 'utf8'))) return true
  } catch {}

  try {
    return /microsoft.*wsl2|wsl2.*microsoft/i.test(readFileSync('/proc/version', 'utf8'))
  } catch {
    return false
  }
}
