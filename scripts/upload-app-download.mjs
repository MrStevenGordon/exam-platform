import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SECRET_KEY)

const BUCKET = 'app-downloads'
const filePath = process.argv[2]
const destName = process.argv[3]

if (!filePath || !destName) {
  console.error('Usage: node scripts/upload-app-download.mjs <local-file> <dest-name-in-bucket>')
  process.exit(1)
}

async function main() {
  const { data: buckets } = await supabase.storage.listBuckets()
  if (!buckets?.some((b) => b.name === BUCKET)) {
    const { error } = await supabase.storage.createBucket(BUCKET, { public: true })
    if (error) throw error
    console.log(`Created bucket "${BUCKET}"`)
  }

  const fileBuffer = readFileSync(filePath)
  console.log(`Uploading ${filePath} (${(fileBuffer.length / 1024 / 1024).toFixed(1)} MB) as ${destName}...`)

  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(destName, fileBuffer, { upsert: true, contentType: 'application/octet-stream' })

  if (uploadError) throw uploadError

  const { data: publicUrlData } = supabase.storage.from(BUCKET).getPublicUrl(destName)
  console.log('Public URL:', publicUrlData.publicUrl)
}

main().catch((err) => {
  console.error('Upload failed:', err.message || err)
  process.exit(1)
})
