// Copies teacher-curated question-bank questions (is_bank_question = true,
// auto-gradable, with a topic) from the exam database into play_questions.
// The exam database is only READ (read-only transaction). Re-running is safe:
// questions already imported (matched on source_question_id) are skipped.
//
//   node scripts/play/import_bank_questions.mjs
import dotenv from 'dotenv'
import pg from 'pg'

dotenv.config({ path: '.env.local', quiet: true })

const playUrl = process.env.PLAY_DATABASE_URL || 'postgres://play@127.0.0.1:54329/play'
if (!/127\.0\.0\.1|localhost/.test(playUrl) && !process.argv.includes('--allow-remote')) {
  console.error('Refusing to write to a non-local Play database without --allow-remote.')
  process.exit(1)
}

const exam = new pg.Client({ connectionString: process.env.DATABASE_URL })
const play = new pg.Client({ connectionString: playUrl })
await exam.connect()
await play.connect()
try {
  await exam.query('begin read only')
  const { rows } = await exam.query(
    `select q.id, d.subject, q.topic, q.question_type, q.question_text, q.options, q.correct_answer, q.points
       from questions q
       join draft_exams d on d.id = q.draft_exam_id
      where q.is_bank_question = true
        and q.topic is not null and q.topic <> ''
        and q.correct_answer is not null and q.correct_answer <> ''
        and q.question_type in ('multiple_choice', 'true_false', 'fill_blank', 'short_answer')
        and (q.marking_points is null or jsonb_array_length(q.marking_points) = 0)
        and d.subject is not null`
  )
  await exam.query('rollback')

  let imported = 0
  for (const r of rows) {
    const res = await play.query(
      `insert into play_questions (subject, topic, question_type, question_text, options, correct_answer, points, source_question_id)
       values ($1, $2, $3, $4, $5, $6, $7, $8)
       on conflict (source_question_id) do nothing`,
      [r.subject, r.topic, r.question_type, r.question_text, r.options ? JSON.stringify(r.options) : null, r.correct_answer, r.points || 1, r.id]
    )
    imported += res.rowCount
  }
  console.log(`Eligible bank questions: ${rows.length}. Newly imported: ${imported}.`)
} catch (err) {
  console.error('Import failed:', err.message)
  process.exitCode = 1
} finally {
  await exam.end()
  await play.end()
}
