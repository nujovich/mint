'use client'

import type { DSTokens } from '@/lib/types'

interface Props {
  tokens: DSTokens
}

export default function TokenPreview({ tokens }: Props) {
  const primaryFont = tokens.typography.fontFamilies?.body || 'inherit'
  const displayFont = tokens.typography.fontFamilies?.display || primaryFont

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 32 }}>

      {/* Color palette */}
      <Section title="Color palette">
        {tokens.colors.map((color) => (
          <div key={color.name} style={{ marginBottom: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, flexWrap: 'wrap' }}>
              <div style={{ width: 16, height: 16, borderRadius: 4, background: color.value, border: '1px solid rgba(255,255,255,0.1)', flexShrink: 0 }} />
              <span style={{ fontSize: 12, color: 'var(--text-muted)', textTransform: 'capitalize' }}>{color.name}</span>
              <span style={{ fontSize: 11, color: 'var(--text-faint)', fontFamily: 'var(--mono)' }}>{color.value}</span>
              {color.description && (
                <span style={{ fontSize: 11, color: 'var(--text-faint)' }}>— {color.description}</span>
              )}
            </div>

            {color.scale ? (
              <div style={{ display: 'flex', gap: 2, borderRadius: 6, overflow: 'hidden' }}>
                {Object.entries(color.scale).map(([stop, hex]) => (
                  <div
                    key={stop}
                    title={`${stop}: ${hex}`}
                    style={{ flex: 1, height: 28, background: hex, cursor: 'default', transition: 'flex 0.15s' }}
                  />
                ))}
              </div>
            ) : (
              <div style={{ display: 'flex', gap: 6 }}>
                <div style={{ width: 80, height: 28, borderRadius: 6, background: color.value }} />
              </div>
            )}
          </div>
        ))}
      </Section>

      {/* Typography */}
      <Section title="Typography">
        <div className="mint-grid-2" style={{ marginBottom: 16 }}>
          {Object.entries(tokens.typography.fontFamilies).map(([role, family]) => (
            <div key={role} style={{ background: 'var(--surface)', borderRadius: 8, padding: '10px 14px', border: '1px solid var(--border)' }}>
              <div style={{ fontSize: 10, color: 'var(--text-faint)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{role}</div>
              <div style={{ fontFamily: `'${family}', sans-serif`, fontSize: 18, fontWeight: 600, color: 'var(--text)' }}>Aa</div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'var(--mono)', marginTop: 4 }}>{family}</div>
            </div>
          ))}
        </div>

        {/* Type scale */}
        <div style={{ background: 'var(--surface)', borderRadius: 8, padding: 16, border: '1px solid var(--border)', overflowX: 'auto' }}>
          {Object.entries(tokens.typography.fontSizes)
            .filter((_, i) => i % 2 === 0)
            .slice(0, 6)
            .map(([key, size]) => (
              <div key={key} style={{ display: 'flex', alignItems: 'baseline', gap: 12, marginBottom: 8 }}>
                <span style={{ fontSize: 10, color: 'var(--text-faint)', fontFamily: 'var(--mono)', minWidth: 28 }}>{key}</span>
                <span style={{ fontFamily: `'${primaryFont}', sans-serif`, fontSize: size, color: 'var(--text)', lineHeight: 1.2, whiteSpace: 'nowrap' }}>
                  The quick brown fox
                </span>
                <span style={{ fontSize: 10, color: 'var(--text-faint)', fontFamily: 'var(--mono)', marginLeft: 'auto', flexShrink: 0 }}>{size}</span>
              </div>
            ))}
        </div>
      </Section>

      {/* Components preview */}
      <Section title="Components">
        <ComponentPreview tokens={tokens} displayFont={displayFont} primaryFont={primaryFont} />
      </Section>

      {/* Spacing + radius grid */}
      <div className="mint-grid-2">
        <Section title="Spacing">
          {Object.entries(tokens.spacing).slice(0, 8).map(([key, val]) => (
            <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 5 }}>
              <div style={{ height: 8, background: 'rgba(99,102,241,0.35)', borderRadius: 2, width: Math.min(parseInt(val) * 0.8, 100), minWidth: 4 }} />
              <span style={{ fontSize: 10, color: 'var(--text-faint)', fontFamily: 'var(--mono)' }}>{key} · {val}</span>
            </div>
          ))}
        </Section>

        <Section title="Border radius">
          {Object.entries(tokens.borderRadius).slice(0, 6).map(([key, val]) => (
            <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 7 }}>
              <div style={{ width: 28, height: 28, background: 'rgba(99,102,241,0.2)', border: '1.5px solid rgba(99,102,241,0.4)', borderRadius: val === '9999px' ? '9999px' : val, flexShrink: 0 }} />
              <span style={{ fontSize: 10, color: 'var(--text-faint)', fontFamily: 'var(--mono)' }}>{key} · {val}</span>
            </div>
          ))}
        </Section>
      </div>

      {/* Shadows */}
      {Object.keys(tokens.shadows).length > 0 && (
        <Section title="Shadows">
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            {Object.entries(tokens.shadows).map(([key, val]) => (
              <div key={key} style={{ padding: '16px 20px', background: '#fff', borderRadius: 8, boxShadow: val, display: 'flex', flexDirection: 'column', gap: 4, minWidth: 100 }}>
                <span style={{ fontSize: 11, fontWeight: 500, color: '#111' }}>{key}</span>
                <span style={{ fontSize: 10, color: '#888', fontFamily: 'monospace', maxWidth: 120, wordBreak: 'break-all' }}>{val.split(',')[0]}</span>
              </div>
            ))}
          </div>
        </Section>
      )}
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.08em', color: 'var(--text-faint)', textTransform: 'uppercase', marginBottom: 12 }}>
        {title}
      </div>
      {children}
    </div>
  )
}

function ComponentPreview({ tokens, primaryFont }: { tokens: DSTokens; displayFont: string; primaryFont: string }) {
  const primary = tokens.colors.find((c) => c.name === 'primary' || c.name === 'brand')?.value ?? '#6366f1'
  const accent = tokens.colors.find((c) => c.name === 'accent' || c.name === 'secondary')?.value ?? '#f43f5e'
  const bg = tokens.colors.find((c) => c.name === 'background' || c.name === 'bg')?.value ?? '#ffffff'
  const textColor = tokens.colors.find((c) => c.name === 'text' || c.name === 'foreground')?.value ?? '#111827'
  const muted = tokens.colors.find((c) => c.name === 'muted')?.value ?? '#6b7280'
  const surface = tokens.colors.find((c) => c.name === 'surface')?.value ?? '#f9f9fb'
  const radius = tokens.borderRadius?.md ?? '8px'
  const radiusSm = tokens.borderRadius?.sm ?? '6px'

  return (
    <div style={{ background: bg, borderRadius: 10, padding: 20, border: '1px solid var(--border)' }}>

      {/* Buttons row */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 20 }}>
        {[
          { label: 'Primary', bg: primary, fg: '#fff', border: 'transparent' },
          { label: 'Secondary', bg: 'transparent', fg: primary, border: primary },
          { label: 'Accent', bg: accent, fg: '#fff', border: 'transparent' },
          { label: 'Ghost', bg: surface, fg: textColor, border: 'transparent' },
          { label: 'Disabled', bg: surface, fg: muted, border: 'transparent' },
        ].map(({ label, bg: btnBg, fg, border }) => (
          <button
            key={label}
            style={{ padding: '7px 16px', borderRadius: radiusSm, background: btnBg, color: fg, border: `1.5px solid ${border}`, fontSize: 12, fontWeight: 500, fontFamily: `'${primaryFont}', sans-serif`, cursor: 'pointer' }}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Cards row */}
      <div className="mint-grid-3" style={{ marginBottom: 20 }}>
        {[
          { cardBg: bg, fg: textColor, sub: muted, acc: primary + '22', label: 'Default card' },
          { cardBg: primary, fg: '#fff', sub: 'rgba(255,255,255,0.65)', acc: 'rgba(255,255,255,0.2)', label: 'Primary card' },
          { cardBg: surface, fg: textColor, sub: muted, acc: accent + '22', label: 'Surface card' },
        ].map(({ cardBg, fg, sub, acc, label }) => (
          <div key={label} style={{ background: cardBg, borderRadius: radius, padding: '14px', border: `1px solid ${muted}22` }}>
            <div style={{ width: 24, height: 24, borderRadius: radiusSm, background: acc, marginBottom: 8 }} />
            <div style={{ fontSize: 12, fontWeight: 600, color: fg, marginBottom: 3, fontFamily: `'${primaryFont}', sans-serif` }}>{label}</div>
            <div style={{ fontSize: 11, color: sub }}>Component description</div>
          </div>
        ))}
      </div>

      {/* Badges */}
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', marginBottom: 14 }}>
        {[
          { label: 'Primary', bg: primary + '18', fg: primary },
          { label: 'Accent', bg: accent + '18', fg: accent },
          { label: 'Neutral', bg: muted + '22', fg: muted },
          { label: 'Success', bg: '#16a34a22', fg: '#16a34a' },
        ].map(({ label, bg: badgeBg, fg }) => (
          <span key={label} style={{ padding: '3px 10px', borderRadius: '9999px', background: badgeBg, color: fg, fontSize: 11, fontWeight: 500 }}>
            {label}
          </span>
        ))}
      </div>

      {/* Inputs */}
      <div className="mint-grid-2">
        <div>
          <div style={{ fontSize: 11, color: muted, marginBottom: 4, fontFamily: `'${primaryFont}', sans-serif` }}>Email</div>
          <div style={{ padding: '7px 10px', border: `1px solid ${muted}40`, borderRadius: radiusSm, background: surface, fontSize: 12, color: muted }}>
            hello@example.com
          </div>
        </div>
        <div>
          <div style={{ fontSize: 11, color: muted, marginBottom: 4, fontFamily: `'${primaryFont}', sans-serif` }}>Error state</div>
          <div style={{ padding: '7px 10px', border: `1px solid ${accent}60`, borderRadius: radiusSm, background: surface, fontSize: 12, color: textColor }}>
            invalid field
          </div>
          <div style={{ fontSize: 10, color: accent, marginTop: 3 }}>This field is required</div>
        </div>
      </div>
    </div>
  )
}
