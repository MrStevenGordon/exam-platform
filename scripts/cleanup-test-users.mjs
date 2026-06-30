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

const testUserIds = [
  '7afa8954-1764-455b-91b5-e20a206eb8d9',
  '8bf21613-e34d-4d53-b4b8-9888bb2bd185',
  '30096c1a-a1fd-48e7-a416-ddc9688398c8',
  'cf570df1-893f-4267-a407-5b5de993bb3a',
]

async function cleanup() {
  for (const id of testUserIds) {
    const { error } = await supabase.auth.admin.deleteUser(id)
    if (error) {
      console.error(`Failed to delete ${id}: ${error.message}`)
    } else {
      console.log(`Deleted auth user: ${id}`)
    }
  }
}

cleanup()
