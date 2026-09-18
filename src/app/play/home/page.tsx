import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getPlayAccount } from '@/lib/playAuth'
import { getPlayPool } from '@/lib/playDb'
import { getStreaks, getXp, loadClassBoard } from '@/lib/playProgress'
import { loadBadges } from '@/lib/playBadges'
import BadgeSeal from '../BadgeSeal'
import SignOutButton from './SignOutButton'

type Game = { name: string; mode: string; blurb: string; href?: string; cta?: string }

const STUDENT_GAMES: Game[] = [
  { name: 'Join a live game', mode: 'Live, hosted by your teacher', blurb: 'Enter the code on your teacher’s screen and race the class.', href: '/play/live', cta: 'Join' },
  { name: 'Topic Mastery', mode: 'Single player', blurb: 'Practice one topic at a time and watch your mastery grow.', href: '/play/topic-mastery' },
  { name: 'Math Duels', mode: 'Multiplayer', blurb: 'Challenge a student in your grade to the same questions and compare scores.', href: '/play/duels' },
]

const TEACHER_GAMES: Game[] = [
  { name: 'Host a live game', mode: 'Live classroom game', blurb: 'Create a game, share the code, and run it on the projector while students play on their own devices.', href: '/play/host', cta: 'Host' },
  { name: 'Jeopardy board', mode: 'Live classroom game', blurb: 'Pick categories and run a buzz-in board on the projector. Students buzz from their own devices and you judge the answers.', href: '/play/host/board', cta: 'Host' },
  { name: 'Class progress', mode: 'Leaderboards and streaks', blurb: 'See how each class is doing: XP, day streaks and who has not played yet.', href: '/play/host/classes', cta: 'View' },
  { name: 'Game questions', mode: 'Question bank', blurb: 'Add, edit and approve the questions used in live games, Topic Mastery and Math Duels.', href: '/play/host/questions', cta: 'Manage' },
]

export default async function PlayHomePage() {
  const account = await getPlayAccount()
  if (!account) redirect('/play/login')

  const games = account.role === 'teacher' ? TEACHER_GAMES : STUDENT_GAMES

  // A student's streak, weekly XP and standing in their class, computed live.
  const badges = account.role === 'student' ? await loadBadges(account.id) : null
  let progress: { current: number; best: number; playedToday: boolean; weekXp: number; className: string | null; rank: number | null } | null = null
  if (account.role === 'student') {
    const [streaks, week, cls] = await Promise.all([
      getStreaks([account.id]),
      getXp([account.id], 'week'),
      getPlayPool().query('select c.id, c.name from play_class_members m join play_classes c on c.id = m.class_id where m.account_id = $1 order by c.name limit 1', [account.id]),
    ])
    const streak = streaks.get(account.id)!
    let rank: number | null = null
    if (cls.rows[0]) rank = (await loadClassBoard(cls.rows[0].id, 'week', account.id))?.rows.find((r) => r.isMe)?.rank ?? null
    progress = { current: streak.current, best: streak.best, playedToday: streak.playedToday, weekXp: week.get(account.id) ?? 0, className: cls.rows[0]?.name ?? null, rank }
  }

  return (
    <div className="page-container" style={{ maxWidth: 680 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div>
          <p className="portal-page-title" style={{ margin: 0 }}>Smart Assess Play</p>
          <p style={{ margin: '4px 0 0', fontSize: 14, color: 'var(--text-secondary)' }}>Welcome, {account.displayName}</p>
        </div>
        <SignOutButton />
      </div>

      {badges && badges.newCount > 0 && (
        <Link href="/play/badges" className="card" style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 16, borderColor: 'var(--accent)', background: 'var(--accent-light)', textDecoration: 'none', color: 'inherit' }}>
          <div style={{ display: 'flex' }}>
            {badges.earned.filter((b) => b.isNew).slice(0, 3).map((b, i) => (
              <span key={b.key} style={{ marginLeft: i === 0 ? 0 : -12 }}><BadgeSeal mark={b.mark} category={b.category} size={44} label={b.name} /></span>
            ))}
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 800 }}>You earned {badges.newCount} new badge{badges.newCount !== 1 ? 's' : ''}!</div>
            <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{badges.earned.filter((b) => b.isNew).map((b) => b.name).slice(0, 3).join(', ')}{badges.newCount > 3 ? ` and ${badges.newCount - 3} more` : ''}</div>
          </div>
          <span className="btn btn-primary" style={{ fontSize: 13, padding: '6px 14px' }}>See badges</span>
        </Link>
      )}

      {progress && (
        <div className="card" style={{ display: 'flex', flexWrap: 'wrap', gap: 20, alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <div style={{ display: 'flex', gap: 28, flexWrap: 'wrap' }}>
            <div>
              <div style={{ fontSize: 30, fontWeight: 800, lineHeight: 1, color: progress.current > 0 ? 'var(--accent-dark)' : 'var(--text-muted)' }}>{progress.current}<span style={{ fontSize: 14, fontWeight: 600 }}> day{progress.current !== 1 ? 's' : ''}</span></div>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 4 }}>
                {progress.current === 0 ? 'Play today to start a streak' : progress.playedToday ? `Streak kept today. Best: ${progress.best}` : `Play today to keep it going. Best: ${progress.best}`}
              </div>
            </div>
            <div>
              <div style={{ fontSize: 30, fontWeight: 800, lineHeight: 1 }}>{progress.weekXp}<span style={{ fontSize: 14, fontWeight: 600 }}> XP</span></div>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 4 }}>
                {progress.className ? (progress.rank ? `#${progress.rank} in ${progress.className} this week` : `Earn XP to join the ${progress.className} board`) : 'This week'}
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <Link href="/play/badges" className="btn btn-secondary" style={{ fontSize: 13, padding: '6px 14px' }}>Badges{badges ? ` ${badges.earned.length}/${badges.earned.length + badges.locked.length}` : ''}</Link>
            {progress.className && <Link href="/play/leaderboard" className="btn btn-secondary" style={{ fontSize: 13, padding: '6px 14px' }}>Class leaderboard</Link>}
          </div>
        </div>
      )}

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
