import { supabase } from '@/lib/supabase'

const HOME_BY_ROLE: Record<string, string> = {
  admin: '/school-admin',
  teacher: '/teacher',
  supervisor: '/supervisor',
  student: '/student',
}

// Confirms the logged-in user's actual profile matches the portal they're
// trying to view. The login page's role dropdown only enforces this at
// sign-in time — without a check here too, any authenticated session could
// navigate straight to a different portal's URL and see its shell and data.
// Returns null if access is fine, or a path to redirect to otherwise.
export async function verifyPortalRole(expectedRole: 'admin' | 'teacher' | 'supervisor' | 'student'): Promise<string | null> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return '/login'

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, is_system_admin, is_active')
    .eq('id', user.id)
    .single()

  if (!profile || profile.is_active === false) return '/login'

  // The platform owner's row carries role='admin' too (the DB check
  // constraint has no 'owner' value) but must never land in a school's own
  // admin portal — is_system_admin always wins.
  if (profile.is_system_admin) return '/owner'

  if (profile.role !== expectedRole) return HOME_BY_ROLE[profile.role] || '/login'

  return null
}
