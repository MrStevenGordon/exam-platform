import { supabase } from '@/lib/supabase'

const HOME_BY_ROLE: Record<string, string> = {
  admin: '/school-admin',
  teacher: '/teacher',
  supervisor: '/supervisor',
  student: '/student',
  principal: '/principal',
}

// Confirms the logged-in user's actual profile matches the portal they're
// trying to view. The login page's role dropdown only enforces this at
// sign-in time — without a check here too, any authenticated session could
// navigate straight to a different portal's URL and see its shell and data.
// Returns null if access is fine, or a path to redirect to otherwise.
//
// alsoAllow lists other roles that may view this particular area too. It exists
// for pages HODs share with teachers (the exam builder, lesson plans): an HOD
// teaches classes too, so those pages must open for them, while the rest of
// the teacher portal stays off-limits.
export async function verifyPortalRole(
  expectedRole: 'admin' | 'teacher' | 'supervisor' | 'student' | 'principal',
  alsoAllow: ('admin' | 'teacher' | 'supervisor' | 'student' | 'principal')[] = [],
): Promise<string | null> {
  return (await verifyPortalRoleDetailed(expectedRole, alsoAllow)).redirect
}

// Same check, but also reports which role the signed-in user actually has, so
// a shared area can decide which portal shell to draw around itself.
export async function verifyPortalRoleDetailed(
  expectedRole: 'admin' | 'teacher' | 'supervisor' | 'student' | 'principal',
  alsoAllow: ('admin' | 'teacher' | 'supervisor' | 'student' | 'principal')[] = [],
): Promise<{ redirect: string | null; role: string | null }> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { redirect: '/login', role: null }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, is_system_admin, is_active, must_change_password')
    .eq('id', user.id)
    .single()

  if (!profile || profile.is_active === false) return { redirect: '/login', role: null }

  // Login only redirects here once, at the moment of sign-in — without a
  // check on every portal page load too, a user could just navigate
  // straight past that redirect and keep using a still-shared default
  // password indefinitely.
  if (profile.must_change_password) return { redirect: '/change-password?first=true', role: profile.role }

  // The platform owner's row carries role='admin' too (the DB check
  // constraint has no 'owner' value) but must never land in a school's own
  // admin portal — is_system_admin always wins.
  if (profile.is_system_admin) return { redirect: '/owner', role: profile.role }

  if (profile.role !== expectedRole && !(alsoAllow as string[]).includes(profile.role)) {
    return { redirect: HOME_BY_ROLE[profile.role] || '/login', role: profile.role }
  }

  return { redirect: null, role: profile.role }
}
