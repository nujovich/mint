interface Props {
  current: 1 | 2 | 3
}

const STEPS = [
  { label: 'Audit' },
  { label: 'Tokens' },
  { label: 'Export' },
]

export default function StepBar({ current }: Props) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0 }}>
      {STEPS.map((step, i) => {
        const stepNum = i + 1
        const isDone = stepNum < current
        const isActive = stepNum === current

        return (
          <div key={step.label} style={{ display: 'flex', alignItems: 'center' }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
              <div style={{
                width: 10,
                height: 10,
                borderRadius: '50%',
                background: isActive ? '#6366f1' : isDone ? '#4ade80' : 'var(--border-hover)',
                boxShadow: isActive ? '0 0 0 3px rgba(99,102,241,0.2)' : 'none',
                transition: 'all 0.2s',
              }} />
              <span style={{
                fontSize: 10,
                fontWeight: isActive ? 500 : 400,
                color: isActive ? 'var(--text)' : isDone ? '#4ade80' : 'var(--text-faint)',
                letterSpacing: '0.03em',
                whiteSpace: 'nowrap',
              }}>
                {step.label}
              </span>
            </div>

            {i < STEPS.length - 1 && (
              <div style={{
                width: 48,
                height: 1,
                background: isDone ? 'rgba(74,222,128,0.4)' : 'var(--border)',
                marginBottom: 14,
                transition: 'background 0.2s',
              }} />
            )}
          </div>
        )
      })}
    </div>
  )
}
