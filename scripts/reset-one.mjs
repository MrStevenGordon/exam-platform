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

const EMAIL = 'demo.schooladmin@mhs.smartassess'
const NEW_PASSWORD = 'Staff.Default1'

async function run() {
  const { data, error: listError } = await supabase.auth.admin.listUsers()
  if (listError) {
    console.error('Failed to list users:', listError.message)
    process.exit(1)
  }

  const user = data.users.find((u) => u.email === EMAIL)
  if (!user) {
    console.error(`No account found with email ${EMAIL}`)
    process.exit(1)
  }

  const { error } = await supabase.auth.admin.updateUserById(user.id, { password: NEW_PASSWORD })
  if (error) {
    console.error('Failed to reset password:', error.message)
    process.exit(1)
  }

  console.log(`Password reset for ${EMAIL} -> ${NEW_PASSWORD}`)
}

run()
