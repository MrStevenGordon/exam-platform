import { createClient } from '@supabase/supabase-js'
import path from 'path'
import { fileURLToPath } from 'url'
import dotenv from 'dotenv'
import crypto from 'crypto'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
dotenv.config({ path: path.join(__dirname, '..', '.env.local') })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY
)

const ADMINS = [
  { email: 'h.thompson@mhs.smartassess', first_name: 'H.', last_name: 'Thompson' },
  { email: 'a.robinson@mhs.smartassess', first_name: 'A.', last_name: 'Robinson' },
]

function generatePassword() {
  return crypto.randomBytes(9).toString('base64').replace(/[+/=]/g, 'x').slice(0, 12) + '!1'
}

async function getExistingUserId(email) {
  let page = 1
  while (true) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 200 })
    if (error) throw error
    const found = data.users.find((u) => u.email === email)
    if (found) return found.id
    if (data.users.length < 200) return null
    page++
  }
}

async function run() {
  console.log('Creating school admin accounts...\n')

  for (const admin of ADMINS) {
    const existingId = await getExistingUserId(admin.email)
    let userId = existingId
    let password = null

    if (!existingId) {
      password = generatePassword()
      const { data, error } = await supabase.auth.admin.createUser({
        email: admin.email,
        password,
        email_confirm: true,
      })
      if (error) {
        console.error(`✗ Failed to create ${admin.email}: ${error.message}`)
        continue
      }
      userId = data.user.id
    }

    const { data: existingProfile } = await supabase.from('profiles').select('id').eq('id', userId).maybeSingle()
    const profileData = {
      full_name: `${admin.first_name} ${admin.last_name}`,
      first_name: admin.first_name,
      last_name: admin.last_name,
      role: 'admin',
      is_system_admin: true,
      department_id: null,
    }
    if (existingProfile) {
      await supabase.from('profiles').update(profileData).eq('id', userId)
    } else {
      await supabase.from('profiles').insert({ id: userId, ...profileData })
    }

    if (password) {
      console.log(`✓ Created ${admin.email}`)
      console.log(`  Temporary password: ${password}`)
      console.log(`  (they should change this on first login via /change-password)\n`)
    } else {
      console.log(`✓ ${admin.email} already existed — profile updated to full admin\n`)
    }
  }

  console.log('Done. Both accounts have unrestricted access (role=admin, is_system_admin=true).')
}

run().catch((err) => {
  console.error('Failed:', err.message || err)
  process.exit(1)
})
