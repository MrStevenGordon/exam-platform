import type { BadgeCategory } from '@/lib/playBadgeCatalog'

const TONES: Record<BadgeCategory, { bg: string; border: string; text: string }> = {
  streak: { bg: 'var(--accent-light)', border: 'var(--accent)', text: 'var(--accent-dark)' },
  xp: { bg: 'var(--success-bg)', border: 'var(--success)', text: 'var(--success)' },
  first: { bg: 'var(--warning-bg)', border: 'var(--warning)', text: 'var(--warning)' },
  skill: { bg: 'var(--card-bg)', border: 'var(--text-primary)', text: 'var(--text-primary)' },
}

// A round seal with a short mark. Locked badges are drawn flat and dashed so
// they read as "not yet" without relying on colour alone.
export default function BadgeSeal({ mark, category, locked, size = 56, label }: { mark: string; category: BadgeCategory; locked?: boolean; size?: number; label?: string }) {
  const tone = TONES[category]
  return (
    <span
      role="img"
      aria-label={label ?? mark}
      style={{
        width: size, height: size, borderRadius: '50%', flexShrink: 0,
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        fontWeight: 800, fontSize: mark.length > 3 ? size * 0.24 : size * 0.3, letterSpacing: -0.3,
        background: locked ? 'var(--page-bg)' : tone.bg,
        color: locked ? 'var(--text-muted)' : tone.text,
        border: `3px ${locked ? 'dashed' : 'solid'} ${locked ? 'var(--border-strong)' : tone.border}`,
        boxShadow: locked ? 'none' : `inset 0 0 0 2px ${tone.bg}`,
      }}
    >
      {mark}
    </span>
  )
}
