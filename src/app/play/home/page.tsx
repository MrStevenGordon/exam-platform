import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getPlayAccount } from '@/lib/playAuth'
import SignOutButton from './SignOutButton'

type Game = { name: string; mode: string; blurb: string; href?: string; cta?: string }

const STUDENT_GAMES: Game[] = [
  { name: 'Join a live game', mode: 'Live, hosted by your teacher', blurb: 'Enter the code on your teacher’s screen and race the class.', href: '/play/live', cta: 'Join' },
  { name: 'Topic Mastery', mode: 'Single player', blurb: 'Practice one topic at a time and watch your mastery grow.', href: '/play/topic-mastery' },
  { name: 'Math Duels', mode: 'Multiplayer', blurb: 'Challenge a student in your grade to the same questions and compare scores.', href: '/play/duels' },
]

const TEACHER_GAMES: Game[] = [
  { name: 'Host a live game', mode: 'Live classroom game', blurb: 'Create a game, share the code, and run it on the projector while students play on their own devices.', href: '/play/host', cta: 'Host' },
  { name: 'Game questions', mode: 'Question bank', blurb: 'Add, edit and approve the questions used in live games, Topic Mastery and Math Duels.', href: '/play/host/questions', cta: 'Manage' },
]

export default async function PlayHomePage() {
  const account = await getPlayAccount()
  if (!account) redirect('/play/login')

  const games = account.role === 'teacher' ? TEACHER_GAMES : STUDENT_GAMES

  return (
    <div className="page-container" style={{ maxWidth: 680 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div>
          <p className="portal-page-title" style={{ margin: 0 }}>Smart Assess Play</p>
          <p style={{ margin: '4px 0 0', fontSize: 14, color: 'var(--text-secondary)' }}>Welcome, {account.displayName}</p>
        </div>
        <SignOutButton />
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {games.map((g) => (
          <div key={g.name} className="card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16 }}>
            <div>
              <div style={{ fontWeight: 700, fontSize: 15 }}>{g.name}</div>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>{g.mode} · {g.blurb}</div>
            </div>
            {g.href ? (
              <Link href={g.href} className="btn btn-primary" style={{ fontSize: 13, padding: '6px 16px', flexShrink: 0 }}>{g.cta ?? 'Play'}</Link>
            ) : (
              <span style={{ fontSize: 12, color: 'var(--text-muted)', flexShrink: 0 }}>Coming soon</span>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
