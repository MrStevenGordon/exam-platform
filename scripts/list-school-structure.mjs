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
  const { data: departments, error: deptError } = await supabase
    .from('departments')
    .select('id, name')
    .order('name')
  if (deptError) { console.error('Failed to load departments:', deptError.message); process.exit(1) }

  const { data: subjects, error: subError } = await supabase
    .from('department_subjects')
    .select('department_id, subject')
  if (subError) { console.error('Failed to load department_subjects:', subError.message); process.exit(1) }

  const { data: classGroups, error: cgError } = await supabase
    .from('class_groups')
    .select('id, name, year_grade, department_id')
    .order('name')
  if (cgError) { console.error('Failed to load class_groups:', cgError.message); process.exit(1) }

  console.log('=== DEPARTMENTS & SUBJECTS ===\n')
  for (const d of departments) {
    const subs = subjects.filter((s) => s.department_id === d.id).map((s) => s.subject)
    console.log(`- ${d.name}${subs.length ? '  [subjects: ' + subs.join(', ') + ']' : '  [no subjects listed]'}`)
  }

  console.log('\n=== CLASS GROUPS ===\n')
  for (const cg of classGroups) {
    const dept = departments.find((d) => d.id === cg.department_id)
    console.log(`- ${cg.name}  (grade ${cg.year_grade || '?'}, dept: ${dept?.name || 'none'})`)
  }

  console.log(`\nTotals: ${departments.length} departments, ${classGroups.length} class groups`)
}

run()
