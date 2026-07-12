import { createClient } from '@supabase/supabase-js'
import path from 'path'
import { fileURLToPath } from 'url'
import dotenv from 'dotenv'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
dotenv.config({ path: path.join(__dirname, '..', '.env.local') })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY
)

function defaultPasswordFor(role) {
  return role === 'student' ? 'Student.Test' : 'Staff.Default1'
}

const isConfirmed = process.argv.includes('--confirm')

async function run() {
  const { data: profiles, error } = await supabase
    .from('profiles')
    .select('id, full_name, role, is_system_admin')
    .neq('is_system_admin', true)

  if (error) {
    console.error('Failed to load profiles:', error.message)
    process.exit(1)
  }

  console.log(`Found ${profiles.length} non-system-admin accounts to reset.\n`)

  if (!isConfirmed) {
    console.log('--- DRY RUN (no passwords changed) ---')
    console.log('Run again with --confirm to actually apply changes.\n')
    for (const p of profiles) {
      console.log(`[dry-run] ${p.full_name} (${p.role}) -> ${defaultPasswordFor(p.role)}`)
    }
    console.log(`\n${profiles.length} accounts would be reset. 0 changed.`)
    return
  }

  let success = 0
  let failed = 0

  for (const p of profiles) {
    const newPassword = defaultPasswordFor(p.role)
    const { error: updateError } = await supabase.auth.admin.updateUserById(p.id, {
      password: newPassword,
    })
    if (updateError) {
      console.error(`FAILED: ${p.full_name} (${p.role}): ${updateError.message}`)
      failed++
    } else {
      console.log(`Reset: ${p.full_name} (${p.role}) -> ${newPassword}`)
      success++
    }
  }

  console.log(`\nDone. ${success} reset, ${failed} failed, ${profiles.length} total.`)
  console.log('System admin accounts were skipped and left untouched.')
}

run()
