import { NextResponse } from 'next/server'
import { getPlayPool } from '@/lib/playDb'
import { getPlayTeacherId } from '@/lib/playAuth'

// The classes this teacher teaches.
export async function GET() {
  const teacherId = await getPlayTeacherId()
  if (!teacherId) return NextResponse.json({ error: 'Not signed in.' }, { status: 401 })
  try {
    const { rows } = await getPlayPool().query(
      `select c.id, c.name, c.grade_label, (select count(*)::int from play_class_members m where m.class_id = c.id) as students
         from play_class_teachers t join play_classes c on c.id = t.class_id
        where t.account_id = $1 order by c.grade_label, c.name`,
      [teacherId]
    )
    return NextResponse.json({ classes: rows.map((r) => ({ id: r.id, name: r.name, gradeLabel: r.grade_label, students: r.students })) })
  } catch (err) {
    console.error('Play teacher classes failed', err)
    return NextResponse.json({ error: 'Something went wrong loading your classes.' }, { status: 500 })
  }
}
