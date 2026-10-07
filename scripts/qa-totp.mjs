// Prints the current 6-digit authenticator code for a TEST account, e.g.:  node scripts/qa-totp.mjs testing.teacher
// Secrets come from .qa-totp.json (written by dev-test-school.mjs, git-ignored). Test project only.
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { totp } from './lib/totp.mjs'

const file = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '.qa-totp.json')
const key = (process.argv[2] || '').replace(/@.*$/, '')
if (!key || !fs.existsSync(file)) { console.error('Usage: node scripts/qa-totp.mjs testing.teacher   (after running dev-test-school.mjs)'); process.exit(1) }
const secrets = JSON.parse(fs.readFileSync(file, 'utf8'))
const email = Object.keys(secrets).find((e) => e.startsWith(key + '@'))
if (!email) { console.error(`No secret for "${key}". Known: ${Object.keys(secrets).join(', ')}`); process.exit(1) }
console.log(totp(secrets[email]))
