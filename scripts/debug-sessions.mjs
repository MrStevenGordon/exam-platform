import { createClient } from '@supabase/supabase-js'
import path from 'path'
import { fileURLToPath } from 'url'
import dotenv from 'dotenv'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
dotenv.config({ path: path.join(__dirname, '..', '.env.local') })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function run() {
  console.log('--- Most recent exam_sessions (any exam, last 10) ---\n')

  const { data: sessions, error } = await supabase
    .from('exam_sessions')
    .select('id, draft_exam_id, final_exam_id, student_id, status, started_at, completed_at, profiles!exam_sessions_student_id_fkey(full_name)')
    .order('started_at', { ascending: false })
    .limit(10)

  if (error) {
    console.error('Query failed:', error.message)
    process.exit(1)
  }

  if (!sessions || sessions.length === 0) {
    console.log('No exam_sessions rows exist AT ALL. The insert during "Begin exam" is not happening or is failing silently.')
    return
  }

  for (const s of sessions) {
    console.log(`session ${s.id}`)
    console.log(`  student: ${s.profiles?.full_name || 'unknown'} (${s.student_id})`)
    console.log(`  draft_exam_id: ${s.draft_exam_id || '(null)'}  final_exam_id: ${s.final_exam_id || '(null)'}`)
    console.log(`  status: ${s.status}  started_at: ${s.started_at}  completed_at: ${s.completed_at || '(not completed)'}`)
    console.log('')
  }

  console.log('\n--- Published direct exams (last 10) ---\n')
  const { data: exams } = await supabase
    .from('draft_exams')
    .select('id, title, direct_published, direct_published_at, created_by')
    .eq('direct_published', true)
    .order('direct_published_at', { ascending: false })
    .limit(10)

  for (const e of exams || []) {
    console.log(`exam ${e.id} — "${e.title}"`)
  }

  console.log('\nCompare the draft_exam_id values above against the exam id list — if they don\'t match any published exam id, that confirms an ID mismatch bug.')
}

run()
