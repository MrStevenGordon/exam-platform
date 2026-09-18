import { NextResponse } from 'next/server'
import { getPlayPool } from '@/lib/playDb'
import { getPlayAccountId } from '@/lib/playAuth'
import { getStreaks, getXp, loadClassBoard } from '@/lib/playProgress'

// A student's own streak, XP and where they stand in each of their classes.
export async function GET() {
  const accountId = await getPlayAccountId()
  if (!accountId) return NextResponse.json({ error: 'Not signed in.' }, { status: 401 })
  try {
    const [streaks, week, total, classes] = await Promise.all([
      getStreaks([accountId]),
      getXp([accountId], 'week'),
      getXp([accountId], 'all'),
      getPlayPool().query(`select c.id, c.name, c.grade_label from play_class_members m join play_classes c on c.id = m.class_id where m.account_id = $1 order by c.name`, [accountId]),
    ])
    const classInfo = await Promise.all(
      classes.rows.map(async (c) => {
        const board = await loadClassBoard(c.id, 'week', accountId)
        const me = board?.rows.find((r) => r.isMe)
        return { id: c.id, name: c.name, gradeLabel: c.grade_label, size: board?.rows.length ?? 0, weekRank: me?.rank ?? null }
      })
    )
    return NextResponse.json({ streak: streaks.get(accountId), weekXp: week.get(accountId) ?? 0, totalXp: total.get(accountId) ?? 0, classes: classInfo })
  } catch (err) {
    console.error('Play progress failed', err)
    return NextResponse.json({ error: 'Something went wrong loading your progress.' }, { status: 500 })
  }
}
