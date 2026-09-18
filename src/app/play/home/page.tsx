import { redirect } from 'next/navigation'
import { getPlaySession } from '@/lib/playSession'
import { getPlayPool } from '@/lib/playDb'
import SignOutButton from './SignOutButton'

const GAMES = [
  { name: 'Topic Mastery', mode: 'Single player', blurb: 'Practice one topic at a time and watch your mastery grow.' },
  { name: 'Math Duels', mode: 'Multiplayer', blurb: 'Challenge a classmate to the same questions and compare scores.' },
]

export default async function PlayHomePage() {
  const session = await getPlaySession()
  if (!session) redirect('/play/login')

  const { rows } = await getPlayPool().query(
    'select display_name, student_id from play_accounts where id = $1 and is_active',
    [session.sub]
  )
  const account = rows[0]
  if (!account) redirect('/play/login')

  return (
    <div className="page-container" style={{ maxWidth: 680 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div>
          <p className="portal-page-title" style={{ margin: 0 }}>Smart Assess Play</p>
          <p style={{ margin: '4px 0 0', fontSize: 14, color: 'var(--text-secondary)' }}>Welcome, {account.display_name} (ID# {account.student_id})</p>
        </div>
        <SignOutButton />
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {GAMES.map((g) => (
          <div key={g.name} className="card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16 }}>
            <div>
              <div style={{ fontWeight: 700, fontSize: 15 }}>{g.name}</div>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>{g.mode} · {g.blurb}</div>
            </div>
            <span style={{ fontSize: 12, color: 'var(--text-muted)', flexShrink: 0 }}>Coming soon</span>
          </div>
        ))}
      </div>
    </div>
  )
}
