import { getSchoolFeatures } from '@/lib/schoolFeatures'
import { supabase } from '@/lib/supabase'

export type ProductKey = 'assess' | 'learning' | 'play'

export const PRODUCTS: Record<ProductKey, { label: string; tagline: string; icon: string }> = {
  assess: { label: 'Smart Assess', tagline: 'Exams, tests and homework', icon: 'ti-clipboard-check' },
  learning: { label: 'Smart Learning', tagline: 'Lessons and lesson plans', icon: 'ti-school' },
  play: { label: 'Smart Play', tagline: 'Games and practice', icon: 'ti-device-gamepad-2' },
}

// Where each person lands when they open Smart Assess (their usual portal home).
export const ASSESS_HOME: Record<string, string> = {
  student: '/student', teacher: '/teacher', supervisor: '/supervisor', admin: '/school-admin', principal: '/principal',
}

export function productHref(product: ProductKey, role: string | undefined): string {
  if (product === 'learning') return '/learning'
  if (product === 'play') return '/play'
  return (role && ASSESS_HOME[role]) || '/'
}

export function currentProduct(pathname: string | null): ProductKey {
  if (pathname?.startsWith('/learning')) return 'learning'
  if (pathname?.startsWith('/play')) return 'play'
  return 'assess'
}

// Installed means the query worked, or was refused for lack of permission (which only happens
// when the table exists). A missing table, an expired session or any other problem counts as
// not installed, so the picker is hidden rather than offering something that might not work.
async function learningInstalled(): Promise<boolean> {
  try {
    const { error } = await supabase.from('learning_lessons').select('id').limit(1)
    return !error || error.code === '42501'
  } catch {
    return false
  }
}

let enabled: Promise<ProductKey[]> | null = null

// The products this school has switched on. Smart Assess is always on; the others
// only when the school's settings say so. Checked once per page load, and any
// problem reading the settings simply leaves Smart Assess alone.
export function getEnabledProducts(): Promise<ProductKey[]> {
  if (!enabled) {
    enabled = (async () => {
      try {
        const f = await getSchoolFeatures()
        const list: ProductKey[] = ['assess']
        // Switched on AND its database tables exist (migration 059), so a school can never be
        // offered a Smart Learning that cannot work yet.
        if (f.smartLearningEnabled && (await learningInstalled())) list.push('learning')
        if (f.smartPlayEnabled) list.push('play')
        return list
      } catch {
        return ['assess'] as ProductKey[]
      }
    })()
  }
  return enabled
}
