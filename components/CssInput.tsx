'use client'

import { useRef, useState, type DragEvent } from 'react'

interface Props {
  onAudit: (css: string) => void
  loading: boolean
  compact?: boolean
}

export default function CssInput({ onAudit, loading, compact = false }: Props) {
  const [css, setCss] = useState('')
  const [dragging, setDragging] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const handleDrop = (e: DragEvent) => {
    e.preventDefault()
    setDragging(false)
    const file = e.dataTransfer.files[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => setCss(ev.target?.result as string)
    reader.readAsText(file)
  }

  const charCount = css.length
  const hasContent = css.trim().length > 100

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: compact ? 'flex-start' : 'center', minHeight: compact ? 'auto' : '100vh', padding: compact ? '48px 16px 24px' : '40px 16px' }}>

      {/* Header */}
      <div style={{ textAlign: 'center', marginBottom: compact ? 24 : 40 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, marginBottom: 12 }}>
          <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
            <rect width="28" height="28" rx="8" fill="rgba(99,102,241,0.15)" />
            <path d="M8 9h12M8 14h6M8 19h9" stroke="#818cf8" strokeWidth="1.5" strokeLinecap="round" />
            <circle cx="20" cy="19" r="3.5" fill="rgba(99,102,241,0.3)" stroke="#818cf8" strokeWidth="1" />
            <path d="M19 19l1 1 2-2" stroke="#818cf8" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <span style={{ fontSize: 18, fontWeight: 600, letterSpacing: '-0.02em' }}>CSS Audit</span>
        </div>
        <p style={{ fontSize: 13, color: 'var(--text-muted)', maxWidth: 440, lineHeight: 1.6 }}>
          Paste your real CSS, SCSS, or HTML — legacy, Bootstrap, whatever.<br />
          Claude identifies the chaos and generates the design system that should have existed.
        </p>
      </div>

      {/* Drop zone + textarea */}
      <div
        onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        className="mint-input-wrap"
        style={{
          borderRadius: 12,
          border: `1.5px dashed ${dragging ? 'rgba(99,102,241,0.6)' : 'var(--border-hover)'}`,
          background: dragging ? 'rgba(99,102,241,0.05)' : 'var(--panel)',
          transition: 'all 0.15s',
          position: 'relative',
        }}
      >
        {/* Top bar */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', borderBottom: '1px solid var(--border)' }}>
          <span style={{ fontSize: 11, color: 'var(--text-faint)', fontFamily: 'var(--mono)' }}>styles.css · _tokens.scss · index.html</span>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            {charCount > 0 && (
              <span style={{ fontSize: 11, color: 'var(--text-faint)', fontFamily: 'var(--mono)' }}>
                {(charCount / 1000).toFixed(1)}k chars
              </span>
            )}
            <label style={{ fontSize: 11, color: 'rgba(99,102,241,0.8)', cursor: 'pointer', padding: '3px 8px', borderRadius: 6, border: '1px solid rgba(99,102,241,0.25)', background: 'rgba(99,102,241,0.06)' }}>
              Subir archivo
              <input
                type="file"
                accept=".css,.scss,.html,.htm"
                style={{ display: 'none' }}
                onChange={(e) => {
                  const file = e.target.files?.[0]
                  if (!file) return
                  const reader = new FileReader()
                  reader.onload = (ev) => setCss(ev.target?.result as string)
                  reader.readAsText(file)
                }}
              />
            </label>
          </div>
        </div>

        <textarea
          ref={textareaRef}
          value={css}
          onChange={(e) => setCss(e.target.value)}
          placeholder="Paste your CSS, SCSS, or HTML here..."
          rows={16}
          style={{
            width: '100%',
            resize: 'vertical',
            padding: '16px',
            background: 'transparent',
            border: 'none',
            borderRadius: '0 0 12px 12px',
            fontSize: 12,
            lineHeight: 1.7,
            color: hasContent ? 'var(--text)' : 'var(--text-faint)',
            minHeight: 240,
          }}
        />

        {dragging && (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 12, background: 'rgba(99,102,241,0.08)', backdropFilter: 'blur(2px)' }}>
            <span style={{ fontSize: 13, color: 'rgba(99,102,241,0.9)' }}>Soltá el archivo acá</span>
          </div>
        )}
      </div>

      {/* Action */}
      <div style={{ marginTop: 20, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
        <button
          onClick={() => onAudit(css)}
          disabled={!hasContent || loading}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '10px 28px',
            borderRadius: 10,
            border: 'none',
            background: hasContent && !loading ? '#6366f1' : 'var(--surface)',
            color: hasContent && !loading ? '#fff' : 'var(--text-muted)',
            fontSize: 13,
            fontWeight: 500,
            fontFamily: 'var(--font)',
            cursor: hasContent && !loading ? 'pointer' : 'not-allowed',
          }}
        >
          {loading ? (
            <>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ animation: 'spin 1s linear infinite' }}>
                <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
              </svg>
              Analyzing CSS...
            </>
          ) : (
            <>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="11" cy="11" r="8" />
                <path d="M21 21l-4.35-4.35M11 8v6M8 11h6" />
              </svg>
              Audit CSS
            </>
          )}
        </button>
        {!hasContent && (
          <p style={{ fontSize: 11, color: 'var(--text-faint)' }}>
            At least 100 characters of CSS required
          </p>
        )}
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}
