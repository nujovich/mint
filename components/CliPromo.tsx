'use client'

import { useState } from 'react'

const COMMANDS = [
  'npx mint-ds audit ./src/styles',
  'npx mint-ds export --target tailwind',
  'npx mint-ds export --target react',
]

const DOCS_URL = 'https://github.com/nujovich/mint#cli'

export default function CliPromo() {
  const [copied, setCopied] = useState(false)

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(COMMANDS.join('\n'))
      setCopied(true)
      setTimeout(() => setCopied(false), 1800)
    } catch {
      // ignore — older browsers / non-secure contexts
    }
  }

  return (
    <section
      aria-label="Try the CLI"
      style={{
        maxWidth: 720,
        margin: '0 auto 32px',
        padding: '0 16px',
      }}
    >
      <div
        style={{
          borderRadius: 12,
          border: '1px solid var(--border)',
          background: 'var(--panel)',
          overflow: 'hidden',
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', borderBottom: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--accent-strong)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="4 17 10 11 4 5" />
              <line x1="12" y1="19" x2="20" y2="19" />
            </svg>
            <span style={{ fontSize: 13, fontWeight: 600 }}>Try the CLI</span>
            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
              · run Mint against a whole folder
            </span>
          </div>
          <span style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-faint)' }}>
            Node ≥ 20
          </span>
        </div>

        {/* Commands */}
        <pre style={{ margin: 0, padding: '14px 18px', fontFamily: 'var(--mono)', fontSize: 12.5, lineHeight: 1.85, color: 'var(--text)', background: 'transparent', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
          {COMMANDS.map((cmd, i) => (
            <div key={i} style={{ display: 'flex', gap: 10 }}>
              <span style={{ color: 'var(--text-faint)', userSelect: 'none' }}>$</span>
              <span><span style={{ color: 'var(--accent-strong)' }}>{cmd.split(' ')[0]}</span> {cmd.split(' ').slice(1).join(' ')}</span>
            </div>
          ))}
        </pre>

        {/* Authentication */}
        <AuthBlock />

        {/* Actions */}
        <div style={{ display: 'flex', gap: 8, padding: '10px 12px', borderTop: '1px solid var(--border)', background: 'var(--surface)' }}>
          <button
            onClick={copy}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '6px 12px',
              borderRadius: 7,
              border: '1px solid rgba(129,140,248,0.6)',
              background: copied ? 'rgba(94,226,154,0.18)' : '#6366f1',
              color: copied ? '#5ee29a' : '#fff',
              fontSize: 12,
              fontWeight: 500,
              fontFamily: 'var(--font)',
              cursor: 'pointer',
              transition: 'all 0.15s',
            }}
          >
            {copied ? (
              <>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M20 6L9 17l-5-5" />
                </svg>
                Copied
              </>
            ) : (
              <>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="9" y="9" width="13" height="13" rx="2" />
                  <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                </svg>
                Copy commands
              </>
            )}
          </button>

          <a
            href={DOCS_URL}
            target="_blank"
            rel="noreferrer noopener"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '6px 12px',
              borderRadius: 7,
              border: '1px solid var(--border)',
              background: 'transparent',
              color: 'var(--text)',
              fontSize: 12,
              fontWeight: 500,
              fontFamily: 'var(--font)',
              textDecoration: 'none',
            }}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 .5C5.6.5.5 5.6.5 12c0 5.1 3.3 9.4 7.9 10.9.6.1.8-.3.8-.6v-2c-3.2.7-3.9-1.5-3.9-1.5-.5-1.3-1.3-1.7-1.3-1.7-1.1-.7.1-.7.1-.7 1.2.1 1.8 1.2 1.8 1.2 1 1.8 2.7 1.3 3.4 1 .1-.8.4-1.3.7-1.6-2.6-.3-5.3-1.3-5.3-5.7 0-1.3.4-2.3 1.2-3.1-.1-.3-.5-1.5.1-3.1 0 0 1-.3 3.3 1.2.9-.3 2-.4 3-.4s2.1.1 3 .4c2.3-1.5 3.3-1.2 3.3-1.2.7 1.6.2 2.8.1 3.1.8.8 1.2 1.9 1.2 3.1 0 4.4-2.7 5.4-5.3 5.7.4.4.8 1.1.8 2.2v3.3c0 .3.2.7.8.6 4.6-1.5 7.9-5.8 7.9-10.9C23.5 5.6 18.4.5 12 .5z" />
            </svg>
            View docs on GitHub
          </a>

        </div>
      </div>
    </section>
  )
}

const AUTH_SHELLS: { label: string; prompt: string; cmd: string }[] = [
  { label: 'bash · zsh · WSL', prompt: '$', cmd: 'export ANTHROPIC_API_KEY=sk-ant-...' },
  { label: 'PowerShell',       prompt: '>', cmd: '$env:ANTHROPIC_API_KEY = "sk-ant-..."' },
  { label: 'Windows CMD',      prompt: '>', cmd: 'set ANTHROPIC_API_KEY=sk-ant-...' },
]

function AuthBlock() {
  const [shellIdx, setShellIdx] = useState(0)
  const active = AUTH_SHELLS[shellIdx]

  return (
    <div style={{ borderTop: '1px solid var(--border)', padding: '12px 16px 14px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8, marginBottom: 8 }}>
        <span style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-faint)' }}>
          Authentication
        </span>
        <div role="tablist" aria-label="Shell" style={{ display: 'flex', gap: 2, background: 'var(--surface)', borderRadius: 7, padding: 2, border: '1px solid var(--border)' }}>
          {AUTH_SHELLS.map((s, i) => (
            <button
              key={s.label}
              role="tab"
              aria-selected={i === shellIdx}
              onClick={() => setShellIdx(i)}
              style={{
                padding: '3px 9px',
                borderRadius: 5,
                border: 'none',
                background: i === shellIdx ? 'var(--surface-2)' : 'transparent',
                color: i === shellIdx ? 'var(--text)' : 'var(--text-muted)',
                fontSize: 10.5,
                fontFamily: 'var(--font)',
                fontWeight: i === shellIdx ? 500 : 400,
                cursor: 'pointer',
              }}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>

      <pre style={{ margin: 0, fontFamily: 'var(--mono)', fontSize: 12, lineHeight: 1.7, color: 'var(--text)', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
        <div style={{ display: 'flex', gap: 10 }}>
          <span style={{ color: 'var(--text-faint)', userSelect: 'none' }}>{active.prompt}</span>
          <span>{active.cmd}</span>
        </div>
      </pre>

      <p style={{ marginTop: 8, fontSize: 11.5, color: 'var(--text-muted)', lineHeight: 1.55 }}>
        Or pass the key per-command with{' '}
        <code style={{ fontFamily: 'var(--mono)', fontSize: 11, padding: '1px 5px', borderRadius: 4, background: 'var(--surface)', color: 'var(--accent-strong)' }}>
          --api-key sk-ant-...
        </code>{' '}
        — handy for CI or one-off runs.
      </p>
    </div>
  )
}
