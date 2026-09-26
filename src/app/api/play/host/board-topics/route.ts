import { NextResponse } from 'next/server'
import { getPlayPool } from '@/lib/playDb'
import { getPlayTeacherId } from '@/lib/playAuth'

// Topics a teacher can turn into board categories. Any approved question type
// works as a clue (the teacher judges spoken answers), so all types count.
export async function GET() {
  const teacherId = await getPlayTeacherId()
  if (!teacherId) return NextResponse.json({ error: 'Not signed in.' }, { status: 401 })
  try {
    const { rows } = await getPlayPool().query(
      `select subject, topic, count(*)::int as question_count from play_questions where status = 'approved' group by 1, 2 order by 1, 2`
    )
    return NextResponse.json({ topics: rows.map((r) => ({ subject: r.subject, topic: r.topic, questionCount: r.question_count })) })
  } catch (err) {
    console.error('Play board topics failed', err)
    return NextResponse.json({ error: 'Something went wrong loading topics.' }, { status: 500 })
  }
}
