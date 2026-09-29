const GAMES = [
  { name: 'Topic Mastery', icon: 'ti-target-arrow', tag: 'Solo practice' },
  { name: 'Math Duels', icon: 'ti-swords', tag: 'Head to head' },
  { name: 'Live Quiz', icon: 'ti-device-gamepad-2', tag: 'Whole class' },
  { name: 'Jeopardy', icon: 'ti-trophy', tag: 'Buzz in' },
  { name: 'Tug of War', icon: 'ti-arrows-left-right', tag: 'Team vs team' },
] as const

// A teaser, not a working game: no backend behind this yet. Kept deliberately light on words —
// the tiles do the telling, not paragraphs.
export default function PlayComingSoon() {
  return (
    <div style={{ maxWidth: 760, margin: '0 auto', textAlign: 'center', padding: '8px 0 24px' }}>
      <div className="play-badge">
        <i className="ti ti-sparkles" aria-hidden="true" />
        Coming soon
      </div>
      <h1 className="play-title">Smart Play</h1>
      <p style={{ margin: '0 0 32px', fontSize: 14, color: 'var(--text-secondary)' }}>Practice, but make it a game.</p>

      <div className="play-grid">
        {GAMES.map((g, i) => (
          <div key={g.name} className="play-tile" style={{ animationDelay: `${i * 70}ms` }}>
            <div className="play-tile-icon"><i className={`ti ${g.icon}`} aria-hidden="true" /></div>
            <p className="play-tile-name">{g.name}</p>
            <p className="play-tile-tag">{g.tag}</p>
            <span className="play-tile-soon">Soon</span>
          </div>
        ))}
      </div>

      <style>{`
        .play-badge {
          display: inline-flex; align-items: center; gap: 6px; margin-bottom: 14px;
          padding: 6px 14px; border-radius: 100px; background: var(--accent-light); color: var(--accent-dark);
          font-size: 12px; font-weight: 700; letter-spacing: 0.4px; text-transform: uppercase;
        }
        .play-title {
          font-family: 'Fraunces', serif; font-weight: 600; font-size: 36px; letter-spacing: -0.6px;
          color: var(--text-primary); margin: 0 0 6px; text-transform: none;
        }
        .play-grid {
          display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 14px;
        }
        .play-tile {
          position: relative; padding: 22px 14px; border-radius: 16px; background: var(--card-bg);
          border: 1px solid var(--border); transition: transform 0.2s ease, box-shadow 0.2s ease;
        }
        .play-tile-icon {
          width: 46px; height: 46px; margin: 0 auto 12px; border-radius: 13px;
          background: var(--accent-light); color: var(--accent-dark);
          display: flex; align-items: center; justify-content: center; font-size: 21px;
        }
        .play-tile-name { margin: 0; font-size: 14px; font-weight: 700; color: var(--text-primary); }
        .play-tile-tag { margin: 2px 0 0; font-size: 12px; color: var(--text-muted); }
        .play-tile-soon {
          position: absolute; top: 10px; right: 10px; font-size: 10px; font-weight: 700;
          letter-spacing: 0.4px; text-transform: uppercase; color: var(--accent-dark);
          background: var(--accent-light); border-radius: 100px; padding: 3px 8px;
        }
        @media (hover: hover) {
          .play-tile:hover { transform: translateY(-3px); box-shadow: 0 10px 24px -12px rgba(30,18,8,0.18); }
        }
        @media (prefers-reduced-motion: no-preference) {
          .play-tile { animation: playTileIn 0.35s ease both; }
        }
        @keyframes playTileIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>
    </div>
  )
}
