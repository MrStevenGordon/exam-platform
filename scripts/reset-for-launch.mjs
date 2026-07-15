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

const isConfirmed = process.argv.includes('--confirm')

const EXAM_CONTENT_TABLES = [
  'marking_point_responses',
  'responses',
  'exam_sessions',
  'self_mock_questions',
  'self_mocks',
  'draft_exam_class_groups',
  'final_exam_class_groups',
  'final_exam_questions',
  'exam_sections',
  'questions',
  'password_reset_requests',
  'ai_polish_usage',
]

const ASSIGNMENT_TABLES = [
  'team_lead_appointments',
  'senior_team_lead_appointments',
  'teacher_class_groups',
  'enrollments',
]

async function run() {
  const { data: allProfiles, error } = await supabase
    .from('profiles')
    .select('id, full_name, role, is_system_admin')

  if (error) {
    console.error('Failed to load profiles:', error.message)
    process.exit(1)
  }

  const adminsToKeep = allProfiles.filter((p) => p.is_system_admin)
  const usersToDelete = allProfiles.filter((p) => !p.is_system_admin)

  console.log(`Found ${allProfiles.length} total accounts.`)
  console.log(`  Keeping ${adminsToKeep.length} system admin account(s):`)
  adminsToKeep.forEach((a) => console.log(`    - ${a.full_name}`))
  console.log(`  Deleting ${usersToDelete.length} non-admin account(s) (students, teachers, supervisors, admins).`)
  console.log('')
  console.log('Also wiping ALL rows from these tables:')
  console.log('  ' + EXAM_CONTENT_TABLES.join(', '))
  console.log('  ' + ASSIGNMENT_TABLES.join(', '))
  console.log('')
  console.log('Keeping (as a starting template): departments, class_groups, department_subjects')
  console.log('')

  if (!isConfirmed) {
    console.log('--- DRY RUN (nothing deleted) ---')
    console.log('Run again with --confirm to actually apply this.')
    return
  }

  for (const table of EXAM_CONTENT_TABLES) {
    const { error: delError, count } = await supabase
      .from(table)
      .delete({ count: 'exact' })
      .not('id', 'is', null)
    if (delError) {
      console.error(`FAILED clearing ${table}:`, delError.message)
    } else {
      console.log(`Cleared ${table} (${count ?? '?'} rows)`)
    }
  }

  const { error: nullFkError } = await supabase
    .from('draft_exams')
    .update({ published_final_exam_id: null })
    .not('id', 'is', null)
  if (nullFkError) {
    console.error('FAILED clearing published_final_exam_id links:', nullFkError.message)
  } else {
    console.log('Cleared published_final_exam_id links')
  }

  const { error: draftDelError, count: draftCount } = await supabase
    .from('draft_exams')
    .delete({ count: 'exact' })
    .not('id', 'is', null)
  if (draftDelError) {
    console.error('FAILED clearing draft_exams:', draftDelError.message)
  } else {
    console.log(`Cleared draft_exams (${draftCount ?? '?'} rows)`)
  }

  const { error: finalDelError, count: finalCount } = await supabase
    .from('final_exams')
    .delete({ count: 'exact' })
    .not('id', 'is', null)
  if (finalDelError) {
    console.error('FAILED clearing final_exams:', finalDelError.message)
  } else {
    console.log(`Cleared final_exams (${finalCount ?? '?'} rows)`)
  }

  for (const table of ASSIGNMENT_TABLES) {
    const { error: delError, count } = await supabase
      .from(table)
      .delete({ count: 'exact' })
      .not('id', 'is', null)
    if (delError) {
      console.error(`FAILED clearing ${table}:`, delError.message)
    } else {
      console.log(`Cleared ${table} (${count ?? '?'} rows)`)
    }
  }

  const idsToDelete = usersToDelete.map((u) => u.id)
  if (idsToDelete.length > 0) {
    const { error: headClearError } = await supabase
      .from('departments')
      .update({ head_id: null })
      .in('head_id', idsToDelete)
    if (headClearError) {
      console.error('FAILED clearing department head_id references:', headClearError.message)
    } else {
      console.log('Cleared department head_id references for departments about to lose their head')
    }

    const { error: profileDelError } = await supabase
      .from('profiles')
      .delete()
      .in('id', idsToDelete)
    if (profileDelError) {
      console.error('FAILED clearing profiles:', profileDelError.message)
    } else {
      console.log(`Cleared ${idsToDelete.length} profile rows`)
    }
  }

  let authDeleted = 0
  let authFailed = 0
  for (const user of usersToDelete) {
    const { error: authError } = await supabase.auth.admin.deleteUser(user.id)
    if (authError) {
      console.error(`FAILED deleting auth user for ${user.full_name}:`, authError.message)
      authFailed++
    } else {
      authDeleted++
    }
  }
  console.log(`Deleted ${authDeleted} auth accounts, ${authFailed} failed.`)

  console.log('\nDone. Departments, class groups, subjects, and your system admin login(s) are untouched.')
}

run()
