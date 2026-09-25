import { timeAgo, type PresenceInfo } from '@/lib/presence'

const LABEL = { online: 'Online', away: 'Away', offline: 'Offline' } as const

// A small coloured dot: green online, amber away, grey offline. Shows nothing
// when there is no status (the viewer is not allowed to see this person, or
// status is not switched on yet).
export default function PresenceDot({ info, showLabel = false }: { info?: PresenceInfo; showLabel?: boolean }) {
  if (!info) return null
  const label = LABEL[info.state]
  const seen = info.state === 'offline' && info.lastSeen ? ` · last seen ${timeAgo(info.lastSeen)}` : ''
  return (
    <span className="presence" title={`${label}${seen}`} role="img" aria-label={label}>
      <span className={`presence-dot presence-${info.state}`} aria-hidden="true" />
      {showLabel && <span className="presence-label">{label}</span>}
    </span>
  )
}
