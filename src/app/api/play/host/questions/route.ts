import { NextResponse } from 'next/server'
import { getPlayPool } from '@/lib/playDb'
import { getPlayTeacherId } from '@/lib/playAuth'
import { QUESTION_TYPES, validateQuestionInput } from '@/lib/playQuestionInput'

const STATUS_FILTERS = ['draft', 'approved', 'archived']
const MAX_ROWS = 200

// One shared bank for the whole school. Any teacher can view and edit any
// question; each question records who created and last edited it.
export async function GET(request: Request) {
  const teacherId = await getPlayTeacherId()
  if (!teacherId) return NextResponse.json({ error: 'Not signed in.' }, { status: 401 })

  const sp = new URL(request.url).searchParams
  const subject = sp.get('subject') || null
  const topic = sp.get('topic') || null
  const status = sp.get('status') && STATUS_FILTERS.includes(sp.get('status')!) ? sp.get('status') : null
  const type = sp.get('type') && (QUESTION_TYPES as readonly string[]).includes(sp.get('type')!) ? sp.get('type') : null
  const q = (sp.get('q') || '').trim().slice(0, 100)
  const limitParam = Number(sp.get('limit') ?? MAX_ROWS)
  const limit = Number.isInteger(limitParam) ? Math.min(MAX_ROWS, Math.max(0, limitParam)) : MAX_ROWS
  const pattern = `%${q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`

  try {
    const pool = getPlayPool()
    const [rows, facets] = await Promise.all([
      pool.query(
        `select q.id, q.subject, q.topic, q.question_type, q.question_text, q.options, q.correct_answer, q.points,
                q.explanation, q.status, q.updated_at, q.source_question_id is not null as imported,
                c.display_name as created_by_name,
                (select count(*)::int from play_practice_answers a where a.question_id = q.id and a.answered_at is not null)
                + (select count(*)::int from play_duel_answers a where a.question_id = q.id)
                + (select count(*)::int from play_live_answers a where a.question_id = q.id) as times_answered
           from play_questions q
           left join play_accounts c on c.id = q.created_by
          where ($1::text is null or q.subject = $1)
            and ($2::text is null or q.topic = $2)
            and ($3::text is null or q.status = $3)
            and ($4::text is null or q.question_type = $4)
            and ($5 = '%%' or q.question_text ilike $5)
          order by q.updated_at desc, q.created_at desc
          limit $6`,
        [subject, topic, status, type, pattern, limit + 1]
      ),
      pool.query(`select subject, topic, count(*)::int as n from play_questions group by 1, 2 order by 1, 2`),
    ])
    const truncated = rows.rows.length > limit
    return NextResponse.json({
      questions: rows.rows.slice(0, limit).map((r) => ({
        id: r.id,
        subject: r.subject,
        topic: r.topic,
        questionType: r.question_type,
        questionText: r.question_text,
        options: r.options,
        correctAnswer: r.correct_answer,
        points: r.points,
        explanation: r.explanation,
        status: r.status,
        updatedAt: r.updated_at,
        createdBy: r.created_by_name ?? (r.imported ? 'Imported from question bank' : 'Starter set'),
        timesAnswered: r.times_answered,
      })),
      truncated,
      facets: facets.rows.map((f) => ({ subject: f.subject, topic: f.topic, count: f.n })),
    })
  } catch (err) {
    console.error('Play questions list failed', err)
    return NextResponse.json({ error: 'Something went wrong loading questions.' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  const teacherId = await getPlayTeacherId()
  if (!teacherId) return NextResponse.json({ error: 'Not signed in.' }, { status: 401 })

  let body: any
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request.' }, { status: 400 })
  }
  const parsed = validateQuestionInput(body)
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 })
  const v = parsed.value

  try {
    const pool = getPlayPool()
    // Reuse the existing spelling of a subject/topic so "algebra" and
    // "Algebra" never split into two topics students would see.
    const canon = await pool.query(
      `select (select subject from play_questions where lower(subject) = lower($1) limit 1) as subject,
              (select topic from play_questions where lower(subject) = lower($1) and lower(topic) = lower($2) limit 1) as topic`,
      [v.subject, v.topic]
    )
    const subject = canon.rows[0].subject ?? v.subject
    const topic = canon.rows[0].topic ?? v.topic

    // Reject an exact duplicate in the same topic so the bank does not fill with copies.
    const dup = await pool.query(
      `select 1 from play_questions where subject = $1 and topic = $2 and lower(trim(question_text)) = lower($3) and status <> 'archived'`,
      [subject, topic, v.questionText]
    )
    if (dup.rows.length > 0) return NextResponse.json({ error: 'That question already exists in this topic.' }, { status: 409 })

    const inserted = await pool.query(
      `insert into play_questions (subject, topic, question_type, question_text, options, correct_answer, points, explanation, status, created_by, updated_by)
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $10) returning id`,
      [subject, topic, v.questionType, v.questionText, v.options ? JSON.stringify(v.options) : null, v.correctAnswer, v.points, v.explanation, v.status, teacherId]
    )
    return NextResponse.json({ id: inserted.rows[0].id })
  } catch (err) {
    console.error('Play question create failed', err)
    return NextResponse.json({ error: 'Something went wrong saving the question.' }, { status: 500 })
  }
}
