'use client'

import { useEffect, useRef, useState } from 'react'
import type { AuditReport, DSTokens, UserDecisions } from '@/lib/types'
import CssInput from '@/components/CssInput'
import AuditView from '@/components/AuditView'
import TokenPreview from '@/components/TokenPreview'
import ExportPanel from '@/components/ExportPanel'
import CoffeeLoader from '@/components/CoffeeLoader'
import StepBar from '@/components/StepBar'

type WizardStep = 'input' | 'audit' | 'tokens'
type PreviewTab = 'visual' | 'json' | 'export'

interface AuditHistoryEntry {
  id: string
  brand: string
  chaosScore: number
  css: string
  audit: AuditReport
}

export default function Home() {
  const [step, setStep] = useState<WizardStep>('input')
  const [css, setCss] = useState('')
  const [audit, setAudit] = useState<AuditReport | null>(null)
  const [tokens, setTokens] = useState<DSTokens | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [previewTab, setPreviewTab] = useState<PreviewTab>('visual')
  const [auditHistory, setAuditHistory] = useState<AuditHistoryEntry[]>([])
  const [historyHydrated, setHistoryHydrated] = useState(false)
  const [historyOpen, setHistoryOpen] = useState(false)
  const historyRef = useRef<HTMLDivElement>(null)

  // Hydrate history from localStorage once on mount.
  useEffect(() => {
    try {
      const raw = localStorage.getItem('mint-audit-history')
      if (raw) {
        const parsed = JSON.parse(raw)
        if (Array.isArray(parsed)) setAuditHistory(parsed)
      }
    } catch {
      // ignore corrupt storage
    }
    setHistoryHydrated(true)
  }, [])

  // Persist history (cap at 10 most recent) whenever it changes.
  useEffect(() => {
    if (!historyHydrated) return
    try {
      localStorage.setItem('mint-audit-history', JSON.stringify(auditHistory.slice(0, 10)))
    } catch {
      // storage may be full or disabled
    }
  }, [auditHistory, historyHydrated])

  useEffect(() => {
    if (!historyOpen) return
    const handler = (e: MouseEvent) => {
      if (historyRef.current && !historyRef.current.contains(e.target as Node)) {
        setHistoryOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [historyOpen])

  const handleAudit = async (inputCss: string) => {
    setLoading(true)
    setError('')
    setCss(inputCss)

    try {
      const res = await fetch('/api/audit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ css: inputCss }),
      })
      const data = await res.json()
      if (data.error) throw new Error(data.error)

      const entry: AuditHistoryEntry = {
        id: Date.now().toString(),
        brand: data.audit.brand || 'Untitled',
        chaosScore: data.audit.chaosScore,
        css: inputCss,
        audit: data.audit,
      }
      setAuditHistory((prev) => [entry, ...prev].slice(0, 10))
      setAudit(data.audit)
      setStep('audit')
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setLoading(false)
    }
  }

  const handleResolve = async (decisions: UserDecisions) => {
    setLoading(true)
    setError('')

    try {
      const res = await fetch('/api/resolve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ css, decisions }),
      })
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      setTokens(data.tokens)
      setStep('tokens')
      setPreviewTab('visual')
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setLoading(false)
    }
  }

  const restoreAudit = (entry: AuditHistoryEntry) => {
    setAudit(entry.audit)
    setCss(entry.css)
    setTokens(null)
    setError('')
    setStep('audit')
    setHistoryOpen(false)
  }

  const clearHistory = () => {
    setAuditHistory([])
    setHistoryOpen(false)
  }

  const reset = () => {
    setStep('input')
    setCss('')
    setAudit(null)
    setTokens(null)
    setError('')
    setHistoryOpen(false)
  }

  // ── Step: input ──────────────────────────────────────────────────────────────
  if (step === 'input') {
    const hasHistory = auditHistory.length > 0
    return (
      <div>
        {loading && <CoffeeLoader />}
        <CssInput onAudit={handleAudit} loading={loading} compact={hasHistory} />
        {hasHistory && (
          <RecentAudits history={auditHistory} onRestore={restoreAudit} onClear={clearHistory} />
        )}
        {error && <ErrorToast message={error} />}
      </div>
    )
  }

  // ── Step: audit ──────────────────────────────────────────────────────────────
  if (step === 'audit' && audit) {
    const chaosColor = audit.chaosScore <= 3 ? '#4ade80' : audit.chaosScore <= 6 ? '#fbbf24' : '#f87171'

    return (
      <div style={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
        {loading && <CoffeeLoader />}

        <header className="mint-header" style={{ position: 'relative' }}>
          <button
            onClick={reset}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '5px 10px', borderRadius: 7, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-muted)', fontSize: 12, fontFamily: 'var(--font)', cursor: 'pointer' }}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 12H5M12 19l-7-7 7-7" /></svg>
            New
          </button>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 7, height: 7, borderRadius: '50%', background: chaosColor, flexShrink: 0 }} />
            <span style={{ fontSize: 13, fontWeight: 500 }}>{audit.brand || 'Asset Audit'}</span>
            <span className="mint-header-detail" style={{ fontSize: 11, color: 'var(--text-faint)' }}>
              — {audit.colorClusters.length} clusters · chaos {audit.chaosScore}/10
            </span>
          </div>

          {/* History button — only shown when there are multiple audits */}
          {auditHistory.length > 1 && (
            <div ref={historyRef} style={{ position: 'relative' }}>
              <button
                onClick={() => setHistoryOpen((o) => !o)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 5,
                  padding: '4px 10px',
                  borderRadius: 7,
                  border: `1px solid ${historyOpen ? 'rgba(99,102,241,0.4)' : 'var(--border)'}`,
                  background: historyOpen ? 'rgba(99,102,241,0.08)' : 'transparent',
                  color: historyOpen ? '#818cf8' : 'var(--text-muted)',
                  fontSize: 11,
                  fontFamily: 'var(--font)',
                  cursor: 'pointer',
                }}
              >
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10" /><path d="M12 6v6l4 2" />
                </svg>
                History ({auditHistory.length})
                <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d={historyOpen ? 'M18 15l-6-6-6 6' : 'M6 9l6 6 6-6'} />
                </svg>
              </button>

              {historyOpen && (
                <div style={{
                  position: 'absolute',
                  top: 34,
                  left: 0,
                  zIndex: 100,
                  minWidth: 240,
                  borderRadius: 10,
                  border: '1px solid var(--border)',
                  background: 'var(--panel)',
                  boxShadow: '0 8px 24px rgba(0,0,0,0.3)',
                  overflow: 'hidden',
                }}>
                  {auditHistory.map((entry, idx) => {
                    const ec = entry.chaosScore <= 3 ? '#4ade80' : entry.chaosScore <= 6 ? '#fbbf24' : '#f87171'
                    const isCurrent = entry.audit === audit
                    return (
                      <button
                        key={entry.id}
                        onClick={() => restoreAudit(entry)}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 10,
                          width: '100%',
                          padding: '10px 14px',
                          borderBottom: idx < auditHistory.length - 1 ? '1px solid var(--border)' : 'none',
                          background: isCurrent ? 'rgba(99,102,241,0.07)' : 'transparent',
                          border: 'none',
                          cursor: 'pointer',
                          textAlign: 'left',
                          fontFamily: 'var(--font)',
                        }}
                      >
                        <div style={{ width: 7, height: 7, borderRadius: '50%', background: ec, flexShrink: 0 }} />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {entry.brand}
                          </div>
                          <div style={{ fontSize: 10, color: 'var(--text-faint)' }}>
                            chaos {entry.chaosScore}/10 · {entry.audit.colorClusters.length} clusters
                          </div>
                        </div>
                        {isCurrent && (
                          <span style={{ fontSize: 9, padding: '1px 5px', borderRadius: 4, background: 'rgba(99,102,241,0.15)', color: '#818cf8', fontWeight: 500, letterSpacing: '0.05em', textTransform: 'uppercase' }}>
                            current
                          </span>
                        )}
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
          )}

          <div className="mint-stepbar-hide" style={{ marginLeft: 'auto' }}>
            <StepBar current={1} />
          </div>
        </header>

        <div className="mint-body" style={{ flex: 1, overflowY: 'auto' }}>
          <div style={{ marginBottom: 24 }}>
            <div style={{ fontSize: 18, fontWeight: 600, letterSpacing: '-0.01em', marginBottom: 6 }}>
              Review the analysis
            </div>
            <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>
              Claude identified these tokens. Decide what to keep before generating the design system.
            </div>
          </div>
          <AuditView audit={audit} onResolve={handleResolve} />
        </div>

        {error && <ErrorToast message={error} />}
      </div>
    )
  }

  // ── Step: tokens ─────────────────────────────────────────────────────────────
  if (step === 'tokens' && tokens) {
    const TABS: { key: PreviewTab; label: string }[] = [
      { key: 'visual', label: 'Preview' },
      { key: 'json', label: 'JSON' },
      { key: 'export', label: 'Export' },
    ]

    return (
      <div style={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
        <header className="mint-header">
          <button
            onClick={reset}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '5px 10px', borderRadius: 7, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-muted)', fontSize: 12, fontFamily: 'var(--font)', cursor: 'pointer' }}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 12H5M12 19l-7-7 7-7" /></svg>
            New
          </button>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 7, height: 7, borderRadius: '50%', background: '#4ade80', flexShrink: 0 }} />
            <span style={{ fontSize: 13, fontWeight: 500 }}>{tokens.brand || 'Design System'}</span>
            <span className="mint-header-detail" style={{ fontSize: 11, color: 'var(--text-faint)' }}>
              — {tokens.colors.length} colors · {Object.keys(tokens.spacing).length} spacing · {Object.keys(tokens.borderRadius).length} radii
            </span>
          </div>

          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 16 }}>
            <div className="mint-stepbar-hide">
              <StepBar current={3} />
            </div>
            <div style={{ display: 'flex', gap: 2, background: 'var(--surface)', borderRadius: 8, padding: 3, border: '1px solid var(--border)' }}>
              {TABS.map(({ key, label }) => (
                <button
                  key={key}
                  onClick={() => setPreviewTab(key)}
                  style={{
                    padding: '4px 14px',
                    borderRadius: 6,
                    border: 'none',
                    background: previewTab === key ? 'var(--surface-2)' : 'transparent',
                    color: previewTab === key ? 'var(--text)' : 'var(--text-muted)',
                    fontSize: 12,
                    fontFamily: 'var(--font)',
                    fontWeight: previewTab === key ? 500 : 400,
                    cursor: 'pointer',
                    position: 'relative',
                  }}
                >
                  {label}
                  {key === 'export' && previewTab !== 'export' && (
                    <span style={{ position: 'absolute', top: 4, right: 4, width: 5, height: 5, borderRadius: '50%', background: '#818cf8' }} />
                  )}
                </button>
              ))}
            </div>
          </div>
        </header>

        <div className="mint-body" style={{ flex: 1, overflowY: 'auto' }}>
          {previewTab === 'visual' && <TokenPreview tokens={tokens} />}

          {previewTab === 'json' && (
            <pre style={{ fontSize: 11.5, lineHeight: 1.75, color: '#9090c0' }}>
              {JSON.stringify(tokens, null, 2)}
            </pre>
          )}

          {previewTab === 'export' && (
            <div style={{ maxWidth: 960, margin: '0 auto' }}>
              <div style={{ marginBottom: 28 }}>
                <div style={{ fontSize: 18, fontWeight: 600, letterSpacing: '-0.01em', marginBottom: 6 }}>
                  Export tokens
                </div>
                <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                  Pick a format and Claude generates a ready-to-use file for your project.
                </div>
              </div>
              <ExportPanel tokens={tokens} />
            </div>
          )}
        </div>
      </div>
    )
  }

  return null
}

function ErrorToast({ message }: { message: string }) {
  return (
    <div style={{ position: 'fixed', bottom: 20, left: '50%', transform: 'translateX(-50%)', padding: '10px 18px', borderRadius: 8, background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.25)', color: '#fca5a5', fontSize: 12, zIndex: 1000 }}>
      {message}
    </div>
  )
}

interface RecentAuditsProps {
  history: AuditHistoryEntry[]
  onRestore: (entry: AuditHistoryEntry) => void
  onClear: () => void
}

function RecentAudits({ history, onRestore, onClear }: RecentAuditsProps) {
  return (
    <section
      aria-label="Recent audits"
      style={{
        maxWidth: 760,
        margin: '0 auto',
        padding: '0 16px 56px',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 12 }}>
        <h2 style={{ fontSize: 12, fontWeight: 600, letterSpacing: '0.07em', color: 'var(--text-faint)', textTransform: 'uppercase', margin: 0 }}>
          Recent audits
        </h2>
        <button
          onClick={onClear}
          style={{
            fontSize: 11,
            padding: '3px 9px',
            borderRadius: 6,
            border: '1px solid var(--border)',
            background: 'transparent',
            color: 'var(--text-muted)',
            fontFamily: 'var(--font)',
          }}
        >
          Clear
        </button>
      </div>

      <ul style={{ listStyle: 'none', display: 'grid', gap: 8, gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', padding: 0, margin: 0 }}>
        {history.map((entry) => {
          const ec = entry.chaosScore <= 3 ? '#5ee29a' : entry.chaosScore <= 6 ? '#fcd34d' : '#fca5a5'
          return (
            <li key={entry.id}>
              <button
                onClick={() => onRestore(entry)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  width: '100%',
                  padding: '12px 14px',
                  borderRadius: 10,
                  border: '1px solid var(--border)',
                  background: 'var(--panel)',
                  color: 'var(--text)',
                  cursor: 'pointer',
                  textAlign: 'left',
                  fontFamily: 'var(--font)',
                  transition: 'border-color 0.15s, transform 0.15s',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--border-hover)' }}
                onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--border)' }}
              >
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: ec, flexShrink: 0 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {entry.brand}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                    chaos {entry.chaosScore}/10 · {entry.audit.colorClusters.length} clusters
                  </div>
                </div>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ color: 'var(--text-faint)', flexShrink: 0 }}>
                  <path d="M9 18l6-6-6-6" />
                </svg>
              </button>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
