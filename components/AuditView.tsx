'use client'

import { useState } from 'react'
import type { AuditReport, ColorDecision, UserDecisions } from '@/lib/types'

interface Props {
  audit: AuditReport
  onResolve: (decisions: UserDecisions) => void
}

function nearestScaleValue(pxStr: string, scale: Record<string, string>): string | null {
  const val = parseInt(pxStr)
  if (isNaN(val)) return null
  let best: string | null = null
  let bestDiff = Infinity
  for (const sv of Object.values(scale)) {
    const diff = Math.abs(val - parseInt(sv))
    if (diff < bestDiff) { bestDiff = diff; best = sv }
  }
  return best
}

export default function AuditView({ audit, onResolve }: Props) {
  const [colorDecisions, setColorDecisions] = useState<ColorDecision[]>(() =>
    audit.colorClusters.map((c) => ({
      clusterId: c.id,
      name: c.suggestedName,
      value: c.representative,
      include: true,
    }))
  )

  const [fontDecisions, setFontDecisions] = useState<string[]>(() =>
    audit.fonts.filter((f) => !f.isSystemFont).map((f) => f.family)
  )

  const spacingScale = audit.spacing.suggestedScale

  const chaosColor =
    audit.chaosScore <= 3 ? '#4ade80' : audit.chaosScore <= 6 ? '#fbbf24' : '#f87171'

  const toggleFont = (family: string) => {
    setFontDecisions((prev) =>
      prev.includes(family) ? prev.filter((f) => f !== family) : [...prev, family]
    )
  }

  const handleResolve = () => {
    onResolve({ colors: colorDecisions, fonts: fontDecisions, spacingScale })
  }

  const includedColors = colorDecisions.filter((d) => d.include).length

  return (
    <div style={{ maxWidth: 860, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 24, paddingBottom: 60 }}>

      {/* Chaos card */}
      <div style={{ padding: '20px 24px', borderRadius: 12, border: '1px solid var(--border)', background: 'var(--panel)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <div style={{ fontSize: 13, fontWeight: 500 }}>Chaos Score</div>
          <div style={{ fontSize: 22, fontWeight: 700, color: chaosColor, fontVariantNumeric: 'tabular-nums' }}>
            {audit.chaosScore}<span style={{ fontSize: 14, fontWeight: 400, color: 'var(--text-faint)' }}>/10</span>
          </div>
        </div>
        <div style={{ height: 6, borderRadius: 99, background: 'var(--surface-2)', overflow: 'hidden', marginBottom: 12 }}>
          <div style={{ height: '100%', width: `${audit.chaosScore * 10}%`, background: chaosColor, borderRadius: 99, transition: 'width 0.6s ease' }} />
        </div>
        <p style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.6, margin: 0 }}>{audit.summary}</p>
      </div>

      {/* Color clusters */}
      <section>
        <SectionLabel>
          Colors — {audit.colorClusters.length} clusters · {includedColors} included
        </SectionLabel>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {audit.colorClusters.map((cluster, i) => {
            const decision = colorDecisions[i]
            const included = decision.include

            return (
              <div
                key={cluster.id}
                className="mint-cluster-row"
                style={{
                  padding: '14px 16px',
                  borderRadius: 10,
                  border: `1px solid ${included ? 'var(--border)' : 'rgba(255,255,255,0.05)'}`,
                  background: included ? 'var(--panel)' : 'var(--surface)',
                  opacity: included ? 1 : 0.45,
                  transition: 'opacity 0.2s, border-color 0.2s',
                }}
              >
                {/* Swatches */}
                <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', flex: '0 0 auto' }}>
                  {cluster.samples.slice(0, 6).map((s) => (
                    <button
                      key={s.hex}
                      onClick={() =>
                        setColorDecisions((prev) =>
                          prev.map((d, idx) => idx === i ? { ...d, value: s.hex } : d)
                        )
                      }
                      title={`${s.hex} · used ${s.usageCount}×`}
                      style={{
                        width: 32,
                        height: 32,
                        borderRadius: 6,
                        background: s.hex,
                        border: decision.value === s.hex ? '2px solid #fff' : '2px solid transparent',
                        boxShadow: decision.value === s.hex ? '0 0 0 2px rgba(99,102,241,0.7)' : '0 0 0 1px rgba(0,0,0,0.2)',
                        cursor: 'pointer',
                        flexShrink: 0,
                      }}
                    />
                  ))}
                </div>

                {/* Name + contexts */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                    <input
                      value={decision.name}
                      onChange={(e) =>
                        setColorDecisions((prev) =>
                          prev.map((d, idx) => idx === i ? { ...d, name: e.target.value } : d)
                        )
                      }
                      style={{
                        fontSize: 12,
                        fontWeight: 500,
                        background: 'var(--surface)',
                        border: '1px solid var(--border)',
                        borderRadius: 6,
                        padding: '3px 8px',
                        color: 'var(--text)',
                        fontFamily: 'var(--mono)',
                        width: 130,
                      }}
                    />
                    <span style={{ fontSize: 11, color: 'var(--text-faint)', fontFamily: 'var(--mono)' }}>
                      {decision.value}
                    </span>
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                    {cluster.samples.flatMap((s) => s.contexts).slice(0, 4).map((ctx, ci) => (
                      <span key={ci} style={{ fontSize: 10, padding: '1px 6px', borderRadius: 4, background: 'var(--surface-2)', color: 'var(--text-faint)', fontFamily: 'var(--mono)' }}>
                        {ctx}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Status icon — shows current state */}
                <div style={{ display: 'flex', flexShrink: 0, alignItems: 'center', paddingTop: 2 }}>
                  {included ? (
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#4ade80" strokeWidth="2.5">
                      <path d="M20 6L9 17l-5-5" />
                    </svg>
                  ) : (
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#f87171" strokeWidth="2.5">
                      <path d="M18 6L6 18M6 6l12 12" />
                    </svg>
                  )}
                </div>

                {/* Action button — says what WILL happen on click */}
                <button
                  onClick={() =>
                    setColorDecisions((prev) =>
                      prev.map((d, idx) => idx === i ? { ...d, include: !d.include } : d)
                    )
                  }
                  style={{
                    fontSize: 11,
                    padding: '4px 10px',
                    borderRadius: 6,
                    border: included
                      ? '1px solid var(--border)'
                      : '1px solid rgba(99,102,241,0.3)',
                    background: included
                      ? 'transparent'
                      : 'rgba(99,102,241,0.06)',
                    color: included ? 'var(--text-faint)' : '#818cf8',
                    cursor: 'pointer',
                    flexShrink: 0,
                    fontFamily: 'var(--font)',
                    transition: 'all 0.15s',
                  }}
                >
                  {included ? 'Exclude' : 'Include'}
                </button>
              </div>
            )
          })}
        </div>
      </section>

      {/* Typography */}
      <section>
        <SectionLabel>Typography — {audit.fonts.length} {audit.fonts.length === 1 ? 'family' : 'families'}</SectionLabel>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {audit.fonts.map((font) => {
            const isChecked = fontDecisions.includes(font.family)
            const isSystem = font.isSystemFont

            return (
              <label
                key={font.family}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  padding: '10px 14px',
                  borderRadius: 8,
                  border: '1px solid var(--border)',
                  background: 'var(--panel)',
                  cursor: isSystem ? 'default' : 'pointer',
                  opacity: isSystem ? 0.5 : 1,
                }}
              >
                <input
                  type="checkbox"
                  checked={isSystem ? false : isChecked}
                  disabled={isSystem}
                  onChange={() => !isSystem && toggleFont(font.family)}
                  style={{ accentColor: '#6366f1', width: 14, height: 14 }}
                />
                <div style={{ flex: 1 }}>
                  <span style={{ fontSize: 13, fontWeight: 500, fontFamily: `"${font.family}", sans-serif` }}>
                    {font.family}
                  </span>
                  {isSystem && (
                    <span style={{ marginLeft: 8, fontSize: 10, color: 'var(--text-faint)', padding: '1px 5px', borderRadius: 4, background: 'var(--surface-2)' }}>
                      system
                    </span>
                  )}
                </div>
                <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                  {font.usages.slice(0, 3).map((u, i) => (
                    <span key={i} style={{ fontSize: 10, padding: '1px 6px', borderRadius: 4, background: 'var(--surface-2)', color: 'var(--text-faint)', fontFamily: 'var(--mono)' }}>
                      {u}
                    </span>
                  ))}
                </div>
              </label>
            )
          })}
        </div>
      </section>

      {/* Spacing */}
      <section>
        <SectionLabel>
          Spacing — {audit.spacing.found.length} {audit.spacing.found.length === 1 ? 'value' : 'values'} · {audit.spacing.nonScaleValues.length} off-scale
        </SectionLabel>

        {/* 4px grid explanation */}
        <div style={{
          padding: '10px 14px',
          borderRadius: 8,
          background: 'rgba(251,191,36,0.06)',
          border: '1px solid rgba(251,191,36,0.15)',
          fontSize: 11,
          color: 'var(--text-muted)',
          lineHeight: 1.65,
          marginBottom: 12,
        }}>
          <strong style={{ color: 'var(--text)', fontWeight: 500 }}>Why a 4px grid?</strong>
          {' '}Values divisible by 4 align to the same grid used by Tailwind CSS, Material Design, and Apple HIG — keeping layouts consistent and predictable. Values highlighted in{' '}
          <span style={{ color: '#fbbf24' }}>amber</span> are not divisible by 4 and are candidates for rounding to the nearest scale step.
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {/* Found chips */}
          <div>
            <div style={{ fontSize: 11, color: 'var(--text-faint)', marginBottom: 8 }}>Found values</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
              {audit.spacing.found.map((val) => {
                const isOffScale = audit.spacing.nonScaleValues.includes(val)
                const nearest = isOffScale ? nearestScaleValue(val, spacingScale) : null

                return (
                  <span
                    key={val}
                    title={nearest ? `Nearest scale value: ${nearest}` : undefined}
                    style={{
                      fontSize: 11,
                      padding: '3px 9px',
                      borderRadius: 6,
                      fontFamily: 'var(--mono)',
                      background: isOffScale ? 'rgba(251,191,36,0.08)' : 'var(--surface)',
                      border: `1px solid ${isOffScale ? 'rgba(251,191,36,0.3)' : 'var(--border)'}`,
                      color: isOffScale ? '#fbbf24' : 'var(--text-muted)',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 4,
                    }}
                  >
                    {val}
                    {nearest && (
                      <>
                        <span style={{ opacity: 0.5 }}>→</span>
                        <span style={{ color: 'rgba(251,191,36,0.7)' }}>{nearest}</span>
                      </>
                    )}
                  </span>
                )
              })}
            </div>
          </div>

          {/* Suggested scale */}
          <div>
            <div style={{ fontSize: 11, color: 'var(--text-faint)', marginBottom: 8 }}>Suggested scale (4px grid)</div>
            <div className="mint-scale-grid">
              {Object.entries(spacingScale).map(([key, val]) => (
                <div
                  key={key}
                  style={{ padding: '6px 10px', borderRadius: 7, background: 'var(--panel)', border: '1px solid var(--border)', textAlign: 'center' }}
                >
                  <div style={{ fontSize: 10, color: 'var(--text-faint)', fontFamily: 'var(--mono)' }}>{key}</div>
                  <div style={{ fontSize: 12, fontWeight: 500, fontFamily: 'var(--mono)', color: 'var(--text)' }}>{val}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 8 }}>
        <button
          onClick={handleResolve}
          disabled={includedColors === 0}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '11px 32px',
            borderRadius: 10,
            border: 'none',
            background: includedColors > 0 ? '#6366f1' : 'var(--surface)',
            color: includedColors > 0 ? '#fff' : 'var(--text-muted)',
            fontSize: 13,
            fontWeight: 500,
            fontFamily: 'var(--font)',
            cursor: includedColors > 0 ? 'pointer' : 'not-allowed',
          }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
          </svg>
          Generate clean tokens
        </button>
      </div>
    </div>
  )
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.07em', color: 'var(--text-faint)', textTransform: 'uppercase', marginBottom: 10 }}>
      {children}
    </div>
  )
}
