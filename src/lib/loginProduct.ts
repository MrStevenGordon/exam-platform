import { ASSESS_HOME, getEnabledProducts, PRODUCTS, type ProductKey } from '@/lib/products'

// Products someone can choose to sign in to. Smart Play is entered through the exam sign-in
// (/play/sso), so it needs no second password.
export const LOGIN_PRODUCTS: ProductKey[] = ['assess', 'learning', 'play']

const KEY = 'login_product'

export function loginProductOptions(enabled: ProductKey[]): ProductKey[] {
  return LOGIN_PRODUCTS.filter((p) => enabled.includes(p))
}

export function rememberLoginProduct(p: ProductKey) {
  try { localStorage.setItem(KEY, p) } catch { /* storage blocked: they simply land in Smart Assess */ }
}

export function rememberedLoginProduct(): ProductKey {
  try {
    const v = localStorage.getItem(KEY)
    if (v && (LOGIN_PRODUCTS as string[]).includes(v)) return v as ProductKey
  } catch { /* see above */ }
  return 'assess'
}

// Where someone lands after signing in (and after two-factor or a first password change).
// The platform owner always goes to the owner portal. Everyone else goes to the product
// they picked, as long as their school still has it switched on; otherwise Smart Assess,
// exactly as before the picker existed.
export async function landingFor(role: string | null | undefined): Promise<string | null> {
  if (role === 'system_admin') return '/owner'
  const assess = (role && ASSESS_HOME[role]) || null
  const wanted = rememberedLoginProduct()
  if (wanted === 'assess' || !role) return assess
  const enabled = await getEnabledProducts()
  if (!loginProductOptions(enabled).includes(wanted)) return assess
  if (wanted === 'play') return role === 'student' || role === 'teacher' ? '/play' : assess  // games are for students and teachers
  return '/learning'
}

export { PRODUCTS }
