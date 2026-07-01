import { createClient } from '@supabase/supabase-js'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import dotenv from 'dotenv'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
dotenv.config({ path: path.join(__dirname, '..', '.env.local') })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SECRET_KEY
)

const SCHOOL_DOMAIN = 'mhs.smartassess'
const DEFAULT_PASSWORD = 'Student.Test'

// Grade level mapping from class_id prefix
const CLASS_TO_GRADE = {
  '1': 7, '2': 8, '3': 9, '4': 10, '5': 11
}

// Read CSV file path from command line argument
const csvFile = process.argv[2]
if (!csvFile) {
  console.error('Usage: node scripts/import-students.mjs scripts/data/1-1.csv')
  process.exit(1)
}

const csvPath = path.resolve(csvFile)
if (!fs.existsSync(csvPath)) {
  console.error(`File not found: ${csvPath}`)
  process.exit(1)
}

function parseCSV(content) {
  const lines = content.trim().split('\n')
  const headers = lines[0].split(',').map((h) => h.trim().toLowerCase().replace(/ /g, '_'))
  return lines.slice(1).map((line) => {
    const values = line.split(',').map((v) => v.trim())
    const row = {}
    headers.forEach((h, i) => { row[h] = values[i] || '' })
    return row
  }).filter((r) => r.student_id)
}

async function importStudents() {
  const content = fs.readFileSync(csvPath, 'utf-8')
  const students = parseCSV(content)

  console.log(`\nImporting ${students.length} students from ${path.basename(csvPath)}...\n`)

  // Look up class group by class_id (e.g. "1-1")
  const classIds = [...new Set(students.map((s) => s.class_id))]
  const { data: classGroups, error: cgError } = await supabase
    .from('class_groups')
    .select('id, name')
    .in('name', classIds)

  if (cgError) { console.error('Failed to load class groups:', cgError.message); process.exit(1) }

  const classGroupMap = {}
  ;(classGroups || []).forEach((cg) => { classGroupMap[cg.name] = cg.id })

  const results = []
  let successCount = 0
  let failCount = 0

  for (const student of students) {
    const email = `${student.student_id}@${SCHOOL_DOMAIN}`
    const fullName = [student.first_name, student.middle_name, student.last_name].filter(Boolean).join(' ')
    const classGroupId = classGroupMap[student.class_id]
    const gradePrefix = student.class_id.split('-')[0]
    const gradeLevel = CLASS_TO_GRADE[gradePrefix] || null

    if (!classGroupId) {
      console.error(`  ✗ ${fullName} — class group '${student.class_id}' not found in database`)
      results.push({ ...student, email, status: 'FAILED', reason: `Class group ${student.class_id} not found` })
      failCount++
      continue
    }

    // Create auth user
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email,
      password: DEFAULT_PASSWORD,
      email_confirm: true,
    })

    if (authError) {
      console.error(`  ✗ ${fullName} (${email}) — ${authError.message}`)
      results.push({ ...student, email, status: 'FAILED', reason: authError.message })
      failCount++
      continue
    }

    const userId = authData.user.id

    // Create profile
    const { error: profileError } = await supabase.from('profiles').insert({
      id: userId,
      full_name: fullName,
      first_name: student.first_name,
      middle_name: student.middle_name || null,
      last_name: student.last_name,
      student_id: student.student_id,
      role: 'student',
      birth_date: student.birth_date || null,
      gender: student.gender || null,
      birth_year: student.birth_year ? parseInt(student.birth_year) : null,
      grade_level: gradeLevel,
    })

    if (profileError) {
      console.error(`  ✗ ${fullName} — profile error: ${profileError.message}`)
      await supabase.auth.admin.deleteUser(userId)
      results.push({ ...student, email, status: 'FAILED', reason: profileError.message })
      failCount++
      continue
    }

    // Enroll in class group
    const { error: enrollError } = await supabase.from('enrollments').insert({
      student_id: userId,
      class_group_id: classGroupId,
    })

    if (enrollError) {
      console.error(`  ✗ ${fullName} — enrollment error: ${enrollError.message}`)
      results.push({ ...student, email, status: 'FAILED', reason: enrollError.message })
      failCount++
      continue
    }

    console.log(`  ✓ ${fullName} | ${email} | Class ${student.class_id}`)
    results.push({ ...student, email, status: 'SUCCESS', reason: '' })
    successCount++
  }

  // Write results CSV
  const outputPath = csvPath.replace('.csv', '-results.csv')
  const outputLines = [
    'first_name,middle_name,last_name,student_id,class_id,email,status,reason',
    ...results.map((r) => `${r.first_name},${r.middle_name || ''},${r.last_name},${r.student_id},${r.class_id},${r.email},${r.status},${r.reason}`)
  ]
  fs.writeFileSync(outputPath, outputLines.join('\n'))

  console.log(`\n--- Import complete ---`)
  console.log(`✓ ${successCount} imported successfully`)
  console.log(`✗ ${failCount} failed`)
  console.log(`Results saved to: ${outputPath}\n`)
}

importStudents()
