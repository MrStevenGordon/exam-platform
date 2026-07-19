import { supabase } from '@/lib/supabase'

// Returns the path a staff member should be redirected to if MFA isn't
// satisfied yet, or null if they're clear to proceed. Students are exempt —
// MFA is mandatory for staff only (teacher, supervisor, school admin,
// system admin).
export async function getMfaRedirect(role: string): Promise<string | null> {
  if (role === 'student') return null

  const { data: factorsData } = await supabase.auth.mfa.listFactors()
  const verifiedFactor = factorsData?.totp?.find((f) => f.status === 'verified')

  if (!verifiedFactor) {
    return '/mfa/setup'
  }

  const { data: aalData } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel()
  if (aalData?.currentLevel !== 'aal2') {
    return '/mfa/challenge'
  }

  return null
}
