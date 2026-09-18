import { NextResponse } from 'next/server'
import { getPlayPool } from '@/lib/playDb'
import { getPlayTeacherId } from '@/lib/playAuth'

// Topics a teacher can host, counting only tap-to-answer questions since that
// is all a live game uses.
export async function GET() {
  const teacherId = await getPlayTeacherId()
  if (!teacherId) return NextResponse.json({ error: 'Not signed in.' }, { status: 401 })
  try {
    const { rows } = await getPlayPool().query(
      `select subject, topic, count(*)::int as question_count
         from play_questions
        where status = 'approved' and question_type in ('multiple_choice', 'true_false')
        group by 1, 2 order by 1, 2`
    )
    return NextResponse.json({ topics: rows.map((r) => ({ subject: r.subject, topic: r.topic, questionCount: r.question_count })) })
  } catch (err) {
    console.error('Play host topics failed', err)
    return NextResponse.json({ error: 'Something went wrong loading topics.' }, { status: 500 })
  }
}
