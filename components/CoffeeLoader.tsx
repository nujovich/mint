'use client'

export default function CoffeeLoader() {
  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      background: 'rgba(14, 14, 20, 0.88)',
      backdropFilter: 'blur(12px)',
      zIndex: 9999,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 28,
      fontFamily: 'var(--font)',
    }}>
      <div className="coffee-float">
        <svg width="96" height="96" viewBox="0 0 96 96" fill="none">
          {/* Steam wisps */}
          <path className="steam steam-1" d="M32 44 Q28 34 33 24 Q38 14 34 6" stroke="#c8a96e" strokeWidth="3" strokeLinecap="round" fill="none" />
          <path className="steam steam-2" d="M46 42 Q42 31 47 20 Q52 9 48 1" stroke="#c8a96e" strokeWidth="3" strokeLinecap="round" fill="none" />
          <path className="steam steam-3" d="M60 44 Q56 34 61 24 Q66 14 62 6" stroke="#c8a96e" strokeWidth="3" strokeLinecap="round" fill="none" />
          {/* Cup body */}
          <rect x="12" y="47" width="64" height="38" rx="11" fill="#c8a96e" />
          {/* Coffee surface */}
          <ellipse cx="44" cy="49" rx="29" ry="6" fill="#7a4a28" />
          {/* Highlight on coffee */}
          <ellipse cx="36" cy="47" rx="8" ry="2.5" fill="rgba(255,255,255,0.12)" transform="rotate(-10 36 47)" />
          {/* Handle */}
          <path d="M76 57 Q92 57 92 67 Q92 77 76 77" stroke="#c8a96e" fill="none" strokeWidth="7" strokeLinecap="round" />
          {/* Saucer */}
          <ellipse cx="44" cy="88" rx="42" ry="6" fill="#c8a96e" opacity="0.35" />
          <ellipse cx="44" cy="88" rx="32" ry="4" fill="#c8a96e" opacity="0.25" />
        </svg>
      </div>

      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: 17, fontWeight: 600, color: '#eaeaf8', marginBottom: 8, letterSpacing: '-0.01em' }}>
          Claude is cooking something good...
        </div>
        <div style={{ fontSize: 13, color: '#8888c0', lineHeight: 1.7 }}>
          Go grab a real coffee ☕<br />
          <span style={{ color: '#606090' }}>Claude handles everything in the meantime</span>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
        <div className="dot dot-1" style={{ width: 6, height: 6, borderRadius: '50%', background: '#c8a96e' }} />
        <div className="dot dot-2" style={{ width: 6, height: 6, borderRadius: '50%', background: '#c8a96e' }} />
        <div className="dot dot-3" style={{ width: 6, height: 6, borderRadius: '50%', background: '#c8a96e' }} />
      </div>

      <style>{`
        .coffee-float {
          animation: coffeeFloat 3s ease-in-out infinite;
        }
        @keyframes coffeeFloat {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-10px); }
        }
        .steam {
          stroke-dasharray: 30;
          stroke-dashoffset: 30;
        }
        .steam-1 { animation: steamRise 2.4s ease-in-out infinite; }
        .steam-2 { animation: steamRise 2.4s ease-in-out infinite 0.5s; }
        .steam-3 { animation: steamRise 2.4s ease-in-out infinite 1s; }
        @keyframes steamRise {
          0% { stroke-dashoffset: 30; opacity: 0; }
          20% { opacity: 0.8; }
          80% { opacity: 0.4; }
          100% { stroke-dashoffset: -30; opacity: 0; }
        }
        .dot-1 { animation: dotPulse 1.4s ease-in-out infinite 0s; }
        .dot-2 { animation: dotPulse 1.4s ease-in-out infinite 0.2s; }
        .dot-3 { animation: dotPulse 1.4s ease-in-out infinite 0.4s; }
        @keyframes dotPulse {
          0%, 80%, 100% { opacity: 0.25; transform: scale(0.8); }
          40% { opacity: 1; transform: scale(1); }
        }
      `}</style>
    </div>
  )
}
