// Regression test: creates two temporary organizations plus reuses the two
// isolated QA departments (from create-qa-test-accounts.mjs) to confirm RLS
// actually blocks cross-tenant reads — not just that the app UI doesn't
// happen to show them. Every check signs in as a real account using the
// public (RLS-enforced) client, never the service-role key, since the
// service-role key bypasses RLS entirely and would prove nothing.
//
// Usage:
//   node scripts/test-cross-tenant-isolation.mjs
//
// Safe to re-run: creates its own throwaway org accounts and deletes them
// (and everything that cascades from them) at the end, pass or fail.

import { createClient } from '@supabase/supabase-js'
import path from 'path'
import { fileURLToPath } from 'url'
import dotenv from 'dotenv'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
dotenv.config({ path: path.join(__dirname, '..', '.env.local') })

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const PUBLISHABLE_KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
const SERVICE_KEY = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY

const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_KEY)
const PASSWORD = 'CrossTenantTest.Pass1'

let passCount = 0
let failCount = 0

function check(label, condition, detail) {
  if (condition) {
    console.log(`  ✓ ${label}`)
    passCount++
  } else {
    console.log(`  ✗ ${label}${detail ? ' — ' + detail : ''}`)
    failCount++
  }
}

async function signInAs(email, password) {
  const client = createClient(SUPABASE_URL, PUBLISHABLE_KEY)
  const { error } = await client.auth.signInWithPassword({ email, password })
  if (error) throw new Error(`Could not sign in as ${email}: ${error.message}`)
  return client
}

async function signInAnon() {
  const client = createClient(SUPABASE_URL, PUBLISHABLE_KEY)
  const { error } = await client.auth.signInAnonymously()
  if (error) throw new Error(`Could not sign in anonymously: ${error.message}`)
  return client
}

async function createTestOrg(label) {
  const email = `crosstenant-${label}-${Date.now()}@example.com`
  const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
    email, password: PASSWORD, email_confirm: true,
  })
  if (authError) throw authError

  const { data: org, error: orgError } = await supabaseAdmin.from('organizations').insert({
    auth_user_id: authData.user.id,
    name: `Cross-Tenant Test Org ${label}`,
    contact_email: email,
  }).select().single()
  if (orgError) throw orgError

  const { data: exam, error: examError } = await supabaseAdmin.from('org_exams').insert({
    organization_id: org.id,
    title: `${label} secret exam`,
    exam_code: `XT${label}${Date.now() % 100000}`,
    access_password: 'secret',
    status: 'published',
  }).select().single()
  if (examError) throw examError

  return { email, userId: authData.user.id, org, exam }
}

async function cleanupTestOrg(t) {
  await supabaseAdmin.from('organizations').delete().eq('id', t.org.id) // cascades exams/sessions/etc
  await supabaseAdmin.auth.admin.deleteUser(t.userId)
}

async function run() {
  console.log('Setting up throwaway test orgs...\n')
  const orgA = await createTestOrg('A')
  const orgB = await createTestOrg('B')

  try {
    console.log('=== Org-to-org isolation ===')
    const clientA = await signInAs(orgA.email, PASSWORD)

    const { data: examsSeen } = await clientA.from('org_exams').select('id, organization_id')
    check(
      "Org A's org_exams query returns only Org A's exams",
      (examsSeen || []).every((e) => e.organization_id === orgA.org.id) && (examsSeen || []).some((e) => e.id === orgA.exam.id),
      `saw ${examsSeen?.length ?? 0} rows`
    )
    check(
      "Org A cannot see Org B's exam specifically",
      !(examsSeen || []).some((e) => e.id === orgB.exam.id)
    )

    const { data: directFetch } = await clientA.from('org_exams').select('id').eq('id', orgB.exam.id).maybeSingle()
    check("Org A directly fetching Org B's exam by id returns nothing", !directFetch)

    const { data: subsSeen } = await clientA.from('organization_subscriptions').select('organization_id')
    check(
      "Org A's subscription query never returns Org B's organization_id",
      !(subsSeen || []).some((s) => s.organization_id === orgB.org.id)
    )

    const { error: updateAttempt } = await clientA.from('org_exams').update({ title: 'hacked' }).eq('id', orgB.exam.id)
    const { data: stillIntact } = await supabaseAdmin.from('org_exams').select('title').eq('id', orgB.exam.id).single()
    check("Org A cannot modify Org B's exam", stillIntact.title === `B secret exam`, updateAttempt ? '' : 'update call did not error, but had no effect — checking data directly')

    console.log('\n=== Anonymous respondent isolation ===')
    const anon = await signInAnon()

    const { data: profilesSeen } = await anon.from('profiles').select('id').limit(5)
    check('Anonymous session cannot read any profiles', !profilesSeen || profilesSeen.length === 0)

    const { data: billingSeen } = await anon.from('platform_billing_settings').select('id').limit(5)
    check('Anonymous session cannot read platform_billing_settings', !billingSeen || billingSeen.length === 0)

    const { data: otherOrgExamsSeen } = await anon.from('org_exams').select('id, status').eq('status', 'draft').limit(5)
    check('Anonymous session cannot list unpublished (draft) exams', !otherOrgExamsSeen || otherOrgExamsSeen.length === 0)

    console.log('\n=== Cross-department isolation (school side, QA test accounts) ===')
    let qa1 = null
    try {
      qa1 = await signInAs('qa1.teacher@mhs.smartassess', 'QaTest.Pass1')
    } catch {
      console.log('  (skipped — QA test accounts not found; run scripts/create-qa-test-accounts.mjs first)')
    }
    if (qa1) {
      const { data: deptsSeen } = await qa1.from('departments').select('id, name')
      const qa2DeptVisible = (deptsSeen || []).some((d) => d.name === 'QA Test Department 2')
      // departments is intentionally readable by all authenticated staff
      // (needed for dropdowns) — this just documents that, not a failure.
      console.log(`  (info) departments table is readable across departments by design — QA Test Department 2 visible: ${qa2DeptVisible}`)

      const { data: classGroupsSeen } = await qa1.from('class_groups').select('id, name')
      const qa2ClassVisible = (classGroupsSeen || []).some((c) => c.name === 'QA-102')
      // "Teachers view all class groups" is an explicit, deliberately-named
      // RLS policy — class_groups is just id/name/grade, treated the same
      // as the globally-readable departments table. The sensitive data
      // (who's actually enrolled) is checked separately below.
      console.log(`  (info) class_groups is readable across departments by design (same pattern as departments) — QA Test Department 2's class visible: ${qa2ClassVisible}`)

      const { data: enrollmentsSeen } = await qa1.from('enrollments').select('id, class_group_id, student:profiles(full_name)')
      const qa2StudentVisible = (enrollmentsSeen || []).some((e) => e.student?.full_name?.startsWith('QA2'))
      check("QA1 teacher cannot see QA2's students via enrollments", !qa2StudentVisible)
    }

    console.log(`\n${passCount} passed, ${failCount} failed`)
    if (failCount > 0) process.exitCode = 1
  } finally {
    console.log('\nCleaning up throwaway test orgs...')
    await cleanupTestOrg(orgA)
    await cleanupTestOrg(orgB)
    console.log('Done.')
  }
}

run().catch((err) => {
  console.error('\nTest script failed:', err.message || err)
  process.exit(1)
})
