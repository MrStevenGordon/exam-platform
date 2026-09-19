'use client'

import { useEffect, useRef, useState } from 'react'
import type { TugTeamView } from '@/lib/playTug'

export const TEAM_COLORS = ['#D4762A', '#2E6B8A'] as const
const TEAM_DARK = ['#A85A18', '#1F4A61'] as const
const SKIN = ['#F5D0B0', '#E0AC7B', '#B97A50', '#8A5A3A']
const HAIR = ['#3B2A1E', '#1E1712', '#6B4423', '#2A211B']

const W = 1000
const H = 330
const GROUND = 262
const CENTER = 500
const SHIFT = 120
const GAP = 40
const ROW_MAX = 8
const SIDE_MAX = 16

type Props = {
  teams: TugTeamView[]
  rope: number
  status: 'lobby' | 'running' | 'ended'
  winnerPosition: number | null
  // Whole numbers of correct answers move the figures; this is just for the "you" marker.
  myKey?: number | null
  // Compact scenes (phones) drop most name labels.
  compact?: boolean
}

type Pulse = { c: number; w: number; last: 'c' | 'w' | null }

// The Tug of War field: a rope with a real student on every position. The
// whole line slides toward the winning side as the rope moves; a correct
// answer makes that student heave (with a "+1"), a wrong one makes them
// stumble, and when a game is decided the winners cheer while the losers,
// dragged to the pit, topple in.
export default function TugScene({ teams, rope, status, winnerPosition, myKey = null, compact = false }: Props) {
  const seen = useRef<Record<number, { c: number; w: number }> | null>(null)
  const [pulses, setPulses] = useState<Record<number, Pulse>>({})
  const [ropeJerk, setRopeJerk] = useState(0)

  // Compare each student's counts with the last poll; a rise triggers an animation.
  useEffect(() => {
    const current: Record<number, { c: number; w: number }> = {}
    for (const t of teams) for (const m of t.members) current[m.key] = { c: m.correct, w: m.wrong }
    if (seen.current === null) { seen.current = current; return }
    const changes: Record<number, Pulse> = {}
    let anyPull = false
    for (const [k, v] of Object.entries(current)) {
      const key = Number(k)
      const prev = seen.current[key] ?? { c: v.c, w: v.w }
      if (v.c > prev.c || v.w > prev.w) {
        const before = pulses[key] ?? { c: 0, w: 0, last: null }
        changes[key] = { c: before.c + (v.c > prev.c ? 1 : 0), w: before.w + (v.w > prev.w ? 1 : 0), last: v.c > prev.c ? 'c' : 'w' }
        if (v.c > prev.c) anyPull = true
      }
    }
    seen.current = current
    if (Object.keys(changes).length > 0) setPulses((p) => ({ ...p, ...changes }))
    if (anyPull) setRopeJerk((n) => n + 1)
  }, [teams]) // eslint-disable-line react-hooks/exhaustive-deps

  const ended = status === 'ended'
  const decisive = ended && Math.abs(rope) > 0.999
  const dx = rope * SHIFT
  const left = teams[0]
  const right = teams[1]

  return (
    <div style={{ width: '100%' }}>
      <style>{CSS}</style>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label={sceneLabel(teams, rope, status, winnerPosition)} style={{ display: 'block', borderRadius: 12, background: '#FBF1E1' }}>
        {/* sky details, ground and the mud pit */}
        <rect x="0" y="0" width={W} height={H} fill="#FBF1E1" />
        <circle cx="880" cy="62" r="30" fill="#F6D9A2" />
        <rect x="0" y={GROUND} width={W} height={H - GROUND} fill="#D2B78C" />
        <rect x="0" y={GROUND} width={W} height="6" fill="#B9986A" />
        <ellipse cx={CENTER} cy={GROUND + 4} rx="78" ry="17" fill="#6B4F35" />
        <ellipse cx={CENTER} cy={GROUND + 1} rx="66" ry="11" fill="#7C5C3E" />
        {[-30, 4, 34].map((bx, i) => (
          <circle key={bx} className="tug-bubble" cx={CENTER + bx} cy={GROUND + 2} r={4 - i * 0.6} fill="#9A7853" style={{ animationDelay: `${i * 0.7}s` }} />
        ))}

        {/* centre flag and the win lines */}
        <line x1={CENTER} y1="118" x2={CENTER} y2={GROUND} stroke="#5B4030" strokeWidth="3" />
        <path d={`M ${CENTER} 118 L ${CENTER + 34} 130 L ${CENTER} 142 Z`} fill="#B03A28" />
        {[-1, 1].map((s) => (
          <g key={s}>
            <line x1={CENTER + s * SHIFT} y1="150" x2={CENTER + s * SHIFT} y2={GROUND} stroke="#8C6020" strokeWidth="2" strokeDasharray="6 6" opacity="0.7" />
            <text x={CENTER + s * SHIFT} y="144" textAnchor="middle" fontSize="13" fontWeight="700" fill="#8C6020" opacity="0.85">WIN</text>
          </g>
        ))}

        {/* team names and scores stay put; the line below slides */}
        {[left, right].map((t, i) =>
          t ? (
            <g key={i}>
              <text x={i === 0 ? 250 : 750} y="44" textAnchor="middle" fontSize="26" fontWeight="800" fill={TEAM_COLORS[i]}>{t.name}</text>
              <text x={i === 0 ? 250 : 750} y="66" textAnchor="middle" fontSize="15" fill="#6B4F35">
                {t.correct} correct{t.size > 0 ? ` · ${t.size} player${t.size !== 1 ? 's' : ''}` : ''}
              </text>
              {ended && winnerPosition === i && <text x={i === 0 ? 250 : 750} y="92" textAnchor="middle" fontSize="20" fontWeight="800" fill="#2D7A4F">WINNERS!</text>}
            </g>
          ) : null
        )}

        <g className="tug-line" style={{ transform: `translateX(${dx}px)` }}>
          <Rope left={left} right={right} jerk={ropeJerk} dx={dx} />
          {[left, right].map((team, ti) => {
            if (!team) return null
            const sign = ti === 0 ? -1 : 1
            const won = ended && winnerPosition === ti
            const lost = ended && winnerPosition !== null && winnerPosition !== ti
            const leading = ti === 0 ? rope < 0 : rope > 0
            const shown = team.members.slice(0, SIDE_MAX)
            return (
              <g key={ti}>
                {shown.map((m, i) => {
                  const back = i >= ROW_MAX
                  const idx = back ? i - ROW_MAX : i
                  const x = CENTER + sign * (70 + (idx + (back ? 0.5 : 0)) * GAP)
                  const y = back ? GROUND - 13 : GROUND
                  const p = pulses[m.key] ?? { c: 0, w: 0, last: null }
                  const mode = won ? 'cheer' : lost ? (decisive ? 'fall' : 'slump') : status === 'running' ? (leading ? 'lead' : 'strain') : 'idle'
                  return (
                    <Figure
                      key={m.key}
                      x={x}
                      y={y}
                      scale={back ? 0.86 : 1}
                      facing={ti === 0 ? 1 : -1}
                      color={TEAM_COLORS[ti]}
                      dark={TEAM_DARK[ti]}
                      skin={SKIN[m.key % SKIN.length]}
                      hair={HAIR[(m.key * 7) % HAIR.length]}
                      label={m.label}
                      showLabel={!compact || m.key === myKey}
                      labelAbove={back}
                      you={m.key === myKey}
                      mode={mode}
                      pulse={p}
                      order={i}
                    />
                  )
                })}
                {team.members.length > SIDE_MAX && (
                  <text x={CENTER + sign * (70 + (ROW_MAX + 0.5) * GAP)} y={GROUND - 30} textAnchor="middle" fontSize="14" fontWeight="700" fill="#6B4F35">+{team.members.length - SIDE_MAX}</text>
                )}
              </g>
            )
          })}
        </g>

        {ended && winnerPosition !== null && <Confetti side={winnerPosition === 0 ? 0 : 1} />}
        {ended && winnerPosition === null && (
          <text x={CENTER} y="100" textAnchor="middle" fontSize="24" fontWeight="800" fill="#6B4F35">It's a tie!</text>
        )}
        {status === 'lobby' && teams.every((t) => t.members.length === 0) && (
          <text x={CENTER} y="108" textAnchor="middle" fontSize="20" fill="#A08060">Waiting for players to join…</text>
        )}
      </svg>
    </div>
  )
}

function sceneLabel(teams: TugTeamView[], rope: number, status: string, winner: number | null): string {
  const names = teams.map((t) => t.name)
  if (status === 'ended') return winner === null ? 'Tug of war ended in a tie' : `Tug of war over. ${names[winner]} won.`
  if (Math.abs(rope) < 0.02) return `Tug of war: ${names[0]} and ${names[1]} are level`
  return `Tug of war: ${names[rope < 0 ? 0 : 1]} is pulling ahead`
}

function Rope({ left, right, jerk, dx }: { left?: TugTeamView; right?: TugTeamView; jerk: number; dx: number }) {
  const nl = Math.max(1, Math.min(ROW_MAX, left?.members.length ?? 0))
  const nr = Math.max(1, Math.min(ROW_MAX, right?.members.length ?? 0))
  const x1 = CENTER - (70 + (nl - 1) * GAP) + 20
  const x2 = CENTER + (70 + (nr - 1) * GAP) - 20
  const y = GROUND - 56
  return (
    <g key={jerk} className={jerk > 0 ? 'tug-jerk' : undefined}>
      <line x1={x1 - 14} y1={y} x2={x2 + 14} y2={y} stroke="#8B5E34" strokeWidth="7" strokeLinecap="round" />
      <line x1={x1 - 14} y1={y} x2={x2 + 14} y2={y} stroke="#C79A63" strokeWidth="7" strokeDasharray="5 7" strokeLinecap="round" />
      {/* the ribbon that shows who is ahead */}
      <rect x={CENTER - 6} y={y - 12} width="12" height="24" rx="2" fill="#B03A28" />
      <rect x={CENTER - 6} y={y - 12} width="12" height="6" rx="2" fill="#E0644F" />
      <title>{dx === 0 ? 'Level' : 'The rope has moved'}</title>
    </g>
  )
}

type FigureProps = {
  x: number
  y: number
  scale: number
  facing: 1 | -1
  color: string
  dark: string
  skin: string
  hair: string
  label: string
  showLabel: boolean
  labelAbove: boolean
  you: boolean
  mode: 'idle' | 'strain' | 'lead' | 'cheer' | 'fall' | 'slump'
  pulse: Pulse
  order: number
}

function Figure({ x, y, scale, facing, color, dark, skin, hair, label, showLabel, labelAbove, you, mode, pulse, order }: FigureProps) {
  const delay = ((order * 137) % 900) / 1000
  const anim = pulse.last === 'c' ? 'tug-heave' : pulse.last === 'w' ? 'tug-stumble' : ''
  return (
    <g transform={`translate(${x} ${y}) scale(${scale})`}>
      <g className="tug-pop" style={{ animationDelay: `${(order % 8) * 60}ms` }}>
        {/* keyed so a new pull restarts the animation from the start */}
        <g key={`${pulse.c}-${pulse.w}`} className={anim}>
          <g className={`tug-body tug-${mode}`} style={{ animationDelay: `${mode === 'fall' ? order * 90 : delay}s` }}>
            <g transform={`scale(${facing} 1)`}>
              {/* legs braced against the ground */}
              <path d="M 0 -30 L -14 0" stroke={dark} strokeWidth="8" strokeLinecap="round" />
              <path d="M 0 -30 L 12 -1" stroke={dark} strokeWidth="8" strokeLinecap="round" />
              <ellipse cx="-16" cy="1" rx="8" ry="3.5" fill="#3B2A1E" />
              <ellipse cx="14" cy="0" rx="8" ry="3.5" fill="#3B2A1E" />
              {/* torso and shorts */}
              <rect x="-10" y="-68" width="20" height="40" rx="7" fill={color} />
              <rect x="-10" y="-34" width="20" height="10" rx="3" fill={dark} />
              {/* arms reaching for the rope */}
              <path d="M 4 -62 L 27 -56" stroke={skin} strokeWidth="6" strokeLinecap="round" />
              <path d="M 1 -58 L 27 -56" stroke={skin} strokeWidth="6" strokeLinecap="round" />
              <circle cx="27" cy="-56" r="4.5" fill={skin} />
              {/* head */}
              <circle cx="1" cy="-80" r="11" fill={skin} />
              <path d="M -10 -82 A 11 11 0 0 1 12 -82 L 12 -85 Q 1 -96 -10 -85 Z" fill={hair} />
              <rect x="-10" y="-84" width="22" height="4" fill={color} />
              <circle cx="6" cy="-79" r="1.6" fill="#2A211B" />
              <path d="M 3 -73 Q 7 -71 10 -74" stroke="#7A3B2E" strokeWidth="1.6" fill="none" strokeLinecap="round" />
            </g>
          </g>
        </g>
        {pulse.last === 'c' && (
          <text key={`plus-${pulse.c}`} className="tug-plus" x="0" y="-104" textAnchor="middle" fontSize="20" fontWeight="800" fill={color}>+1</text>
        )}
        {pulse.last === 'w' && (
          <text key={`oops-${pulse.w}`} className="tug-plus" x="0" y="-104" textAnchor="middle" fontSize="18" fontWeight="800" fill="#B03A28">oops</text>
        )}
      </g>
      {you && <path d="M -7 -128 L 7 -128 L 0 -118 Z" fill="#1E1208" />}
      {showLabel && (
        // First names only, alternating heights, so neighbours never overlap.
        <text x="0" y={labelAbove ? (order % 2 ? -124 : -110) : order % 2 ? 34 : 20} textAnchor="middle" fontSize={you ? 13 : 11} fontWeight={you ? 800 : 600} fill={you ? '#1E1208' : '#6B4F35'}>
          {you ? 'YOU' : label.split(' ')[0].slice(0, 9)}
        </text>
      )}
    </g>
  )
}

function Confetti({ side }: { side: 0 | 1 }) {
  const base = side === 0 ? 40 : 540
  return (
    <g aria-hidden="true">
      {Array.from({ length: 28 }).map((_, i) => (
        <rect
          key={i}
          className="tug-confetti"
          x={base + ((i * 97) % 420)}
          y="-20"
          width="8"
          height="12"
          rx="1"
          fill={['#D4762A', '#2E6B8A', '#2D7A4F', '#E0A93B', '#B03A28'][i % 5]}
          style={{ animationDelay: `${(i % 9) * 0.35}s`, animationDuration: `${2.6 + (i % 5) * 0.4}s` }}
        />
      ))}
    </g>
  )
}

const CSS = `
.tug-line { transition: transform 0.9s cubic-bezier(.4,0,.2,1); }
.tug-body { transform-box: view-box; transform-origin: 0 0; }
.tug-idle { transform: rotate(-3deg); }
.tug-strain { animation: tug-strain 1.1s ease-in-out infinite alternate; }
.tug-lead { animation: tug-lead 0.9s ease-in-out infinite alternate; }
.tug-cheer { animation: tug-cheer 0.7s ease-in-out infinite; }
.tug-fall { animation: tug-fall 1.1s cubic-bezier(.5,0,.8,.6) forwards; }
.tug-slump { animation: tug-slump 0.9s ease-out forwards; }
.tug-heave { transform-box: view-box; transform-origin: 0 0; animation: tug-heave 0.7s ease-out; }
.tug-stumble { transform-box: view-box; transform-origin: 0 0; animation: tug-stumble 0.7s ease-out; }
.tug-pop { transform-box: view-box; transform-origin: 0 0; animation: tug-pop 0.5s cubic-bezier(.2,1.4,.4,1) both; }
.tug-plus { animation: tug-plus 1.1s ease-out forwards; }
.tug-jerk { animation: tug-jerk 0.45s ease-out; }
.tug-bubble { animation: tug-bubble 2.2s ease-in-out infinite; }
.tug-confetti { animation: tug-confetti 3.2s linear infinite; }
@keyframes tug-strain { from { transform: rotate(-4deg); } to { transform: rotate(-10deg); } }
@keyframes tug-lead { from { transform: rotate(-9deg); } to { transform: rotate(-16deg); } }
@keyframes tug-cheer { 0%, 100% { transform: translateY(0) rotate(0deg); } 50% { transform: translateY(-14px) rotate(-4deg); } }
@keyframes tug-fall { 0% { transform: rotate(6deg); } 100% { transform: translateY(10px) rotate(84deg); } }
@keyframes tug-slump { from { transform: rotate(-4deg); } to { transform: rotate(22deg) translateY(2px); } }
@keyframes tug-heave { 0% { transform: rotate(0deg) translateX(0); } 35% { transform: rotate(-22deg) translateX(-9px); } 100% { transform: rotate(0deg) translateX(0); } }
@keyframes tug-stumble { 0% { transform: rotate(0deg); } 20% { transform: rotate(14deg) translateY(-3px); } 45% { transform: rotate(-12deg); } 70% { transform: rotate(8deg); } 100% { transform: rotate(0deg); } }
@keyframes tug-pop { from { transform: scale(0); opacity: 0; } to { transform: scale(1); opacity: 1; } }
@keyframes tug-plus { 0% { opacity: 0; transform: translateY(6px); } 20% { opacity: 1; } 100% { opacity: 0; transform: translateY(-26px); } }
@keyframes tug-jerk { 0%, 100% { transform: translateX(0); } 25% { transform: translateX(-5px); } 60% { transform: translateX(4px); } }
@keyframes tug-bubble { 0%, 100% { transform: translateY(0); opacity: 0.9; } 50% { transform: translateY(-7px); opacity: 0.4; } }
@keyframes tug-confetti { from { transform: translateY(0) rotate(0deg); opacity: 1; } to { transform: translateY(360px) rotate(540deg); opacity: 0.9; } }
@media (prefers-reduced-motion: reduce) {
  .tug-strain, .tug-lead, .tug-cheer, .tug-bubble, .tug-confetti { animation: none; }
  .tug-line { transition: none; }
  .tug-heave, .tug-stumble, .tug-jerk, .tug-pop, .tug-plus { animation-duration: 0.01s; }
}
`
