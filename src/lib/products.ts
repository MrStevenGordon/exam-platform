import { getSchoolFeatures } from '@/lib/schoolFeatures'

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
        if (f.smartLearningEnabled) list.push('learning')
        if (f.smartPlayEnabled) list.push('play')
        return list
      } catch {
        return ['assess'] as ProductKey[]
      }
    })()
  }
  return enabled
}
