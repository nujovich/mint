'use client'

import { useState } from 'react'
import type { DSTokens, ExportTarget } from '@/lib/types'
import { EXPORT_TARGETS } from '@/lib/types'
import CodeViewer from './CodeViewer'
import CoffeeLoader from './CoffeeLoader'

interface Props {
  tokens: DSTokens
}

interface ExportState {
  target: ExportTarget
  code: string
  loading: boolean
  error: string
}

const CATEGORY_ORDER = ['Tokens', 'Frameworks CSS', 'Components'] as const

export default function ExportPanel({ tokens }: Props) {
  const [exports, setExports] = useState<Record<string, ExportState>>({})
  const [activeTarget, setActiveTarget] = useState<ExportTarget | null>(null)

  const anyLoading = Object.values(exports).some((s) => s.loading)

  const handleExport = async (target: ExportTarget) => {
    if (exports[target]?.code && !exports[target]?.loading) {
      setActiveTarget(activeTarget === target ? null : target)
      return
    }

    setActiveTarget(target)
    setExports((prev) => ({
      ...prev,
      [target]: { target, code: '', loading: true, error: '' },
    }))

    try {
      const res = await fetch('/api/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tokens, target }),
      })
      const data = await res.json()

      if (data.error) throw new Error(data.error)

      setExports((prev) => ({
        ...prev,
        [target]: { target, code: data.code, loading: false, error: '' },
      }))
    } catch (err) {
      setExports((prev) => ({
        ...prev,
        [target]: { target, code: '', loading: false, error: (err as Error).message },
      }))
    }
  }

  const grouped = CATEGORY_ORDER.map((cat) => ({
    category: cat,
    targets: EXPORT_TARGETS.filter((t) => t.category === cat),
  }))

  const activeConfig = EXPORT_TARGETS.find((t) => t.target === activeTarget)
  const activeExport = activeTarget ? exports[activeTarget] : null

  return (
    <>
      {anyLoading && <CoffeeLoader />}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 36 }}>
        {grouped.map(({ category, targets }) => (
          <div key={category}>
            <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.08em', color: 'var(--text-faint)', textTransform: 'uppercase', marginBottom: 12 }}>
              {category}
            </div>
            <div className="mint-export-grid">
              {targets.map((cfg) => {
                const state = exports[cfg.target]
                const isActive = activeTarget === cfg.target
                const isDone = !!state?.code
                const isLoading = state?.loading

                return (
                  <button
                    key={cfg.target}
                    onClick={() => handleExport(cfg.target)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 12,
                      padding: '12px 16px',
                      borderRadius: 10,
                      border: `1px solid ${isActive ? 'rgba(99,102,241,0.45)' : isDone ? 'rgba(74,222,128,0.25)' : 'var(--border)'}`,
                      background: isActive ? 'rgba(99,102,241,0.09)' : isDone ? 'rgba(74,222,128,0.05)' : 'var(--surface)',
                      color: 'var(--text)',
                      textAlign: 'left',
                      fontFamily: 'var(--font)',
                      cursor: 'pointer',
                      transition: 'all 0.15s',
                    }}
                    onMouseEnter={(e) => {
                      if (!isActive) {
                        (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--border-hover)'
                        ;(e.currentTarget as HTMLButtonElement).style.background = 'var(--surface-2)'
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!isActive) {
                        const border = isDone ? 'rgba(74,222,128,0.25)' : 'var(--border)'
                        const bg = isDone ? 'rgba(74,222,128,0.05)' : 'var(--surface)'
                        ;(e.currentTarget as HTMLButtonElement).style.borderColor = border
                        ;(e.currentTarget as HTMLButtonElement).style.background = bg
                      }
                    }}
                  >
                    {/* Status dot */}
                    <div style={{ width: 8, height: 8, borderRadius: '50%', flexShrink: 0, background: isDone ? '#4ade80' : isLoading ? '#fbbf24' : 'var(--text-faint)', transition: 'background 0.2s' }} />

                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 2 }}>{cfg.label}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{cfg.description}</div>
                    </div>

                    {/* Ext badge */}
                    <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 5, background: 'var(--surface-2)', color: 'var(--text-faint)', fontFamily: 'var(--mono)', flexShrink: 0, border: '1px solid var(--border)' }}>
                      .{cfg.ext}
                    </span>

                    {/* State icon */}
                    {isLoading ? (
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#fbbf24" strokeWidth="2" style={{ animation: 'spin 1s linear infinite', flexShrink: 0 }}>
                        <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
                      </svg>
                    ) : isDone ? (
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={isActive ? 'rgba(99,102,241,0.8)' : '#4ade80'} strokeWidth="2" style={{ flexShrink: 0 }}>
                        <path d={isActive ? 'M18 15l-6-6-6 6' : 'M6 9l6 6 6-6'} />
                      </svg>
                    ) : (
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--text-faint)" strokeWidth="2" style={{ flexShrink: 0 }}>
                        <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
                      </svg>
                    )}
                  </button>
                )
              })}
            </div>

            {/* Error inline */}
            {activeExport?.error && activeTarget && EXPORT_TARGETS.find((t) => t.target === activeTarget)?.category === category && (
              <div style={{ marginTop: 10, padding: '10px 14px', borderRadius: 8, background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', fontSize: 12, color: '#f87171' }}>
                {activeExport.error}
              </div>
            )}
          </div>
        ))}

        {/* Code viewer — full width at bottom */}
        {activeExport?.code && activeConfig && (
          <CodeViewer
            code={activeExport.code}
            filename={activeConfig.filename}
            ext={activeConfig.ext}
            onClose={() => setActiveTarget(null)}
          />
        )}
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </>
  )
}
