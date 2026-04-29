'use client'

import { useEffect, useRef, useState } from 'react'
import type { AuditReport, DSTokens, UserDecisions } from '@/lib/types'
import CssInput from '@/components/CssInput'
import AuditView from '@/components/AuditView'
import TokenPreview from '@/components/TokenPreview'
import ExportPanel from '@/components/ExportPanel'
import CoffeeLoader from '@/components/CoffeeLoader'
import StepBar from '@/components/StepBar'
import CliPromo from '@/components/CliPromo'

type WizardStep = 'input' | 'audit' | 'tokens'
type PreviewTab = 'visual' | 'json' | 'export'
type Flavor = 'playground' | 'cli'

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
  const [flavor, setFlavor] = useState<Flavor>('playground')
  const historyRef = useRef<HTMLDivElement>(null)

  // Restore flavor preference from localStorage.
  useEffect(() => {
    try {
      const stored = localStorage.getItem('mint-flavor')
      if (stored === 'playground' || stored === 'cli') setFlavor(stored)
    } catch {
      // ignore
    }
  }, [])

  const selectFlavor = (next: Flavor) => {
    setFlavor(next)
    try {
      localStorage.setItem('mint-flavor', next)
    } catch {
      // ignore
    }
  }

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
      <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
        {loading && <CoffeeLoader />}

        <Hero />
        <FlavorSwitcher flavor={flavor} onChange={selectFlavor} />

        <main style={{ flex: 1, padding: '8px 0 40px' }}>
          {flavor === 'playground' ? (
            <CssInput onAudit={handleAudit} loading={loading} headerless />
          ) : (
            <CliFlavorPanel />
          )}
        </main>

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

function Hero() {
  return (
    <div style={{ textAlign: 'center', padding: '48px 16px 24px' }}>
      <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 12, marginBottom: 14 }}>
        <svg width="34" height="34" viewBox="0 0 28 28" fill="none">
          <rect width="28" height="28" rx="8" fill="rgba(99,102,241,0.18)" />
          <path d="M8 9h12M8 14h6M8 19h9" stroke="#818cf8" strokeWidth="1.5" strokeLinecap="round" />
          <circle cx="20" cy="19" r="3.5" fill="rgba(99,102,241,0.3)" stroke="#818cf8" strokeWidth="1" />
          <path d="M19 19l1 1 2-2" stroke="#818cf8" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <span style={{ fontSize: 26, fontWeight: 600, letterSpacing: '-0.025em' }}>Mint</span>
      </div>
      <p style={{ fontSize: 14, color: 'var(--text-muted)', maxWidth: 520, lineHeight: 1.6, margin: '0 auto' }}>
        Audit your legacy CSS, curate the chaos, and ship a clean design system.
      </p>
      <p style={{ fontSize: 12, color: 'var(--text-faint)', marginTop: 10, letterSpacing: '0.04em', textTransform: 'uppercase' }}>
        Available in two flavors — pick yours
      </p>
    </div>
  )
}

interface FlavorSwitcherProps {
  flavor: Flavor
  onChange: (next: Flavor) => void
}

function FlavorSwitcher({ flavor, onChange }: FlavorSwitcherProps) {
  const options: { key: Flavor; title: string; subtitle: string; icon: React.ReactNode }[] = [
    {
      key: 'playground',
      title: 'Playground',
      subtitle: 'Try Mint right in your browser — paste a snippet & go.',
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="4" width="18" height="14" rx="2" />
          <path d="M2 20h20" />
          <path d="M9 9l-2 2 2 2M13 9l2 2-2 2" />
        </svg>
      ),
    },
    {
      key: 'cli',
      title: 'CLI',
      subtitle: 'Run Mint over a whole repo from your terminal — CI-ready.',
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="4 17 10 11 4 5" />
          <line x1="12" y1="19" x2="20" y2="19" />
        </svg>
      ),
    },
  ]

  return (
    <div
      role="tablist"
      aria-label="Choose flavor"
      className="mint-grid-2"
      style={{ maxWidth: 720, width: '100%', margin: '0 auto', padding: '8px 16px 0' }}
    >
      {options.map((opt) => {
        const active = flavor === opt.key
        return (
          <button
            key={opt.key}
            role="tab"
            aria-selected={active}
            onClick={() => onChange(opt.key)}
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: 12,
              padding: '14px 16px',
              borderRadius: 12,
              border: `1.5px solid ${active ? 'rgba(129,140,248,0.7)' : 'var(--border)'}`,
              background: active ? 'rgba(99,102,241,0.10)' : 'var(--panel)',
              color: 'var(--text)',
              textAlign: 'left',
              fontFamily: 'var(--font)',
              cursor: 'pointer',
              transition: 'all 0.15s',
              boxShadow: active ? '0 0 0 4px rgba(99,102,241,0.10)' : 'none',
            }}
          >
            <span style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 36,
              height: 36,
              borderRadius: 9,
              background: active ? 'rgba(99,102,241,0.20)' : 'var(--surface)',
              color: active ? '#a5b0ff' : 'var(--text-muted)',
              flexShrink: 0,
            }}>
              {opt.icon}
            </span>
            <span style={{ flex: 1, minWidth: 0 }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
                <span style={{ fontSize: 14, fontWeight: 600 }}>{opt.title}</span>
                {active && (
                  <span style={{ fontSize: 9, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', padding: '2px 6px', borderRadius: 4, background: 'rgba(129,140,248,0.20)', color: 'var(--accent-strong)' }}>
                    Selected
                  </span>
                )}
              </span>
              <span style={{ display: 'block', fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.5 }}>
                {opt.subtitle}
              </span>
            </span>
          </button>
        )
      })}
    </div>
  )
}

function CliFlavorPanel() {
  return (
    <div style={{ padding: '24px 0 0' }}>
      <div style={{ maxWidth: 720, margin: '0 auto 18px', padding: '0 16px', textAlign: 'center' }}>
        <p style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.6, margin: 0 }}>
          The full audit + export pipeline ships as a CLI you can drop into any project or CI job.
        </p>
      </div>

      <div
        role="note"
        style={{
          maxWidth: 720,
          margin: '0 auto 18px',
          padding: '12px 16px',
          borderRadius: 10,
          border: '1px solid rgba(251,191,36,0.25)',
          background: 'rgba(251,191,36,0.08)',
          display: 'flex',
          alignItems: 'flex-start',
          gap: 10,
          marginLeft: 16,
          marginRight: 16,
        }}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fbbf24" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: 1 }}>
          <path d="M12 9v4M12 17h.01" />
          <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
        </svg>
        <div style={{ fontSize: 12.5, color: 'var(--text-muted)', lineHeight: 1.55 }}>
          <strong style={{ color: '#fbbf24', fontWeight: 600 }}>Heads up:</strong>{' '}
          Mint isn&apos;t published to npm yet, so the commands below won&apos;t resolve via{' '}
          <code style={{ fontFamily: 'var(--mono)', fontSize: 11.5, padding: '1px 5px', borderRadius: 4, background: 'rgba(255,255,255,0.06)' }}>npx</code>{' '}
          today. Sneak preview only — clone the repo to try it locally.
        </div>
      </div>

      <CliPromo />
    </div>
  )
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
