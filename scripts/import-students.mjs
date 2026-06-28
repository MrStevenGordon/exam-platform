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

function generatePassword() {
  return Math.random().toString(36).slice(-8) + Math.floor(Math.random() * 100)
}

function parseCSV(text) {
  const lines = text.trim().split('\n')
  const headers = lines[0].split(',').map(h => h.trim())
  return lines.slice(1).map(line => {
    const values = line.split(',').map(v => v.trim())
    const row = {}
    headers.forEach((h, i) => { row[h] = values[i] })
    return row
  })
}

async function importStudents() {
  const csvPath = path.join(__dirname, 'students.csv')
  const csvText = fs.readFileSync(csvPath, 'utf-8')
  const students = parseCSV(csvText)

  const results = []

  for (const student of students) {
    const password = generatePassword()

    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email: student.email,
      password: password,
      email_confirm: true,
    })

    if (authError) {
      console.error(`Failed to create auth for ${student.email}: ${authError.message}`)
      results.push({ ...student, password: 'FAILED', error: authError.message })
      continue
    }

    const { error: profileError } = await supabase
      .from('profiles')
      .insert({
        id: authData.user.id,
        full_name: student.full_name,
        role: 'student',
      })

    if (profileError) {
      console.error(`Failed to create profile for ${student.email}: ${profileError.message}`)
      results.push({ ...student, password: 'FAILED', error: profileError.message })
      continue
    }

    console.log(`Created: ${student.full_name} (${student.email})`)
    results.push({ ...student, password })
  }

  const outputPath = path.join(__dirname, 'student-credentials.csv')
  const csvOutput = ['full_name,email,password']
    .concat(results.map(r => `${r.full_name},${r.email},${r.password}`))
    .join('\n')
  fs.writeFileSync(outputPath, csvOutput)

  console.log(`\nDone. Credentials saved to scripts/student-credentials.csv`)
}

importStudents()
