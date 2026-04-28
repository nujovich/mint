'use client'

import { useState } from 'react'

interface Props {
  code: string
  filename: string
  ext: string
  onClose: () => void
}

export default function CodeViewer({ code, filename, ext, onClose }: Props) {
  const [copied, setCopied] = useState(false)

  const copy = async () => {
    await navigator.clipboard.writeText(code)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const download = () => {
    const blob = new Blob([code], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${filename}.${ext}`
    a.click()
    URL.revokeObjectURL(url)
  }

  const lineCount = code.split('\n').length

  return (
    <div style={{ background: 'var(--panel)', border: '1px solid var(--border-hover)', borderRadius: 10, overflow: 'hidden', marginTop: 16, animation: 'slideDown 0.2s ease' }}>

      {/* Bar */}
      <div style={{ display: 'flex', alignItems: 'center', padding: '10px 14px', borderBottom: '1px solid var(--border)', gap: 10 }}>
        <div style={{ display: 'flex', gap: 5 }}>
          <div style={{ width: 10, height: 10, borderRadius: '50%', background: 'rgba(255,255,255,0.07)' }} />
          <div style={{ width: 10, height: 10, borderRadius: '50%', background: 'rgba(255,255,255,0.07)' }} />
          <div style={{ width: 10, height: 10, borderRadius: '50%', background: 'rgba(255,255,255,0.07)' }} />
        </div>
        <span style={{ fontSize: 11, color: 'var(--text-faint)', fontFamily: 'var(--mono)', marginRight: 'auto' }}>
          {filename}.{ext}
        </span>
        <span style={{ fontSize: 11, color: 'var(--text-faint)' }}>{lineCount} líneas</span>

        <button
          onClick={copy}
          style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '4px 10px', borderRadius: 6, border: '1px solid var(--border-hover)', background: 'transparent', color: copied ? '#4ade80' : 'var(--text-muted)', fontSize: 11, fontFamily: 'var(--font)' }}
        >
          {copied ? (
            <><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M20 6L9 17l-5-5" /></svg>Copiado</>
          ) : (
            <><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="9" y="9" width="13" height="13" rx="2" /><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" /></svg>Copiar</>
          )}
        </button>

        <button
          onClick={download}
          style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '4px 10px', borderRadius: 6, border: '1px solid rgba(99,102,241,0.3)', background: 'rgba(99,102,241,0.08)', color: 'rgba(129,140,248,0.9)', fontSize: 11, fontFamily: 'var(--font)' }}
        >
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3" /></svg>
          Descargar
        </button>

        <button
          onClick={onClose}
          style={{ display: 'flex', padding: '4px', borderRadius: 6, border: 'none', background: 'transparent', color: 'var(--text-faint)', fontFamily: 'var(--font)' }}
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12" /></svg>
        </button>
      </div>

      {/* Code */}
      <div style={{ overflowX: 'auto', maxHeight: 440 }}>
        <pre style={{ padding: '16px', fontSize: 12, lineHeight: 1.75, color: '#9090c0', minWidth: 'max-content' }}>
          {code}
        </pre>
      </div>

      <style>{`
        @keyframes slideDown {
          from { opacity: 0; transform: translateY(-6px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  )
}
