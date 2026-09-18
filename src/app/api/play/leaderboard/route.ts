import { NextResponse } from 'next/server'
import { getPlayPool } from '@/lib/playDb'
import { getPlayAccount, UUID_RE } from '@/lib/playAuth'
import { loadClassBoard, type Period } from '@/lib/playProgress'

const STUDENT_TOP = 10

// A class leaderboard. Students can only open a class they are in and see the
// top ten plus their own row; teachers can only open classes they teach and
// see everyone, including who has not played.
export async function GET(request: Request) {
  const account = await getPlayAccount()
  if (!account) return NextResponse.json({ error: 'Not signed in.' }, { status: 401 })

  const sp = new URL(request.url).searchParams
  const classId = sp.get('classId') ?? ''
  const period: Period = sp.get('period') === 'all' ? 'all' : 'week'
  if (!UUID_RE.test(classId)) return NextResponse.json({ error: 'Class not found.' }, { status: 404 })

  try {
    const pool = getPlayPool()
    const allowed = account.role === 'teacher'
      ? await pool.query('select 1 from play_class_teachers where class_id = $1 and account_id = $2', [classId, account.id])
      : await pool.query('select 1 from play_class_members where class_id = $1 and account_id = $2', [classId, account.id])
    if (allowed.rows.length === 0) return NextResponse.json({ error: 'Class not found.' }, { status: 404 })

    const board = await loadClassBoard(classId, period, account.id)
    if (!board) return NextResponse.json({ error: 'Class not found.' }, { status: 404 })

    if (account.role === 'teacher') {
      return NextResponse.json({ role: 'teacher', period, className: board.className, gradeLabel: board.gradeLabel, rows: board.rows.map(({ isMe: _isMe, ...r }) => r) })
    }

    const ranked = board.rows.filter((r) => r.rank !== null)
    const me = board.rows.find((r) => r.isMe)
    const strip = (r: (typeof board.rows)[number]) => ({ rank: r.rank, name: r.name, xp: r.xp, streak: r.streak, isMe: r.isMe })
    return NextResponse.json({
      role: 'student',
      period,
      className: board.className,
      gradeLabel: board.gradeLabel,
      classSize: board.rows.length,
      rankedCount: ranked.length,
      top: ranked.slice(0, STUDENT_TOP).map(strip),
      me: me ? strip(me) : null,
    })
  } catch (err) {
    console.error('Play leaderboard failed', err)
    return NextResponse.json({ error: 'Something went wrong loading the leaderboard.' }, { status: 500 })
  }
}
