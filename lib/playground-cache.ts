import type { AuditReport, DSTokens, UserDecisions } from './types'

const AUDIT_PREFIX = 'mint-audit-cache-'
const RESOLVE_PREFIX = 'mint-resolve-cache-'

// `crypto` is a browser global but is not auto-globalised in the Vitest node
// environment. Resolve it lazily so the module loads in both runtimes without
// top-level await (which ES2017 target does not support).
async function getSubtleCrypto(): Promise<SubtleCrypto> {
  if (typeof crypto !== 'undefined') return crypto.subtle
  const { webcrypto } = await import('node:crypto')
  return webcrypto.subtle as unknown as SubtleCrypto
}

export function preprocessCss(css: string): string {
  return css
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/\/\/[^\n]*/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export async function hashContent(content: string): Promise<string> {
  const subtle = await getSubtleCrypto()
  const buf = await subtle.digest('SHA-256', new TextEncoder().encode(content))
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('')
}

export async function readAuditCache(css: string): Promise<AuditReport | null> {
  try {
    const hash = await hashContent(preprocessCss(css))
    const raw = localStorage.getItem(`${AUDIT_PREFIX}${hash}`)
    if (!raw) return null
    return (JSON.parse(raw) as { audit: AuditReport }).audit ?? null
  } catch {
    return null
  }
}

export async function writeAuditCache(css: string, audit: AuditReport): Promise<void> {
  try {
    const hash = await hashContent(preprocessCss(css))
    localStorage.setItem(`${AUDIT_PREFIX}${hash}`, JSON.stringify({ audit, savedAt: new Date().toISOString() }))
  } catch { /* storage full or disabled */ }
}

export async function readResolveCache(css: string, decisions: UserDecisions): Promise<DSTokens | null> {
  try {
    const hash = await hashContent(preprocessCss(css) + '|' + JSON.stringify(decisions))
    const raw = localStorage.getItem(`${RESOLVE_PREFIX}${hash}`)
    if (!raw) return null
    return (JSON.parse(raw) as { tokens: DSTokens }).tokens ?? null
  } catch {
    return null
  }
}

export async function writeResolveCache(css: string, decisions: UserDecisions, tokens: DSTokens): Promise<void> {
  try {
    const hash = await hashContent(preprocessCss(css) + '|' + JSON.stringify(decisions))
    localStorage.setItem(`${RESOLVE_PREFIX}${hash}`, JSON.stringify({ tokens, savedAt: new Date().toISOString() }))
  } catch { /* storage full or disabled */ }
}

export function clearPlaygroundCache(): void {
  try {
    const toRemove: string[] = []
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i)
      if (k && (k.startsWith(AUDIT_PREFIX) || k.startsWith(RESOLVE_PREFIX))) {
        toRemove.push(k)
      }
    }
    toRemove.forEach(k => localStorage.removeItem(k))
  } catch { /* ignore */ }
}
