import { createBrowserClient } from '@supabase/ssr'

export const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!
)

// Many components on one page each ask "who is signed in?" (auth.getUser makes a network call every time: 15 to 19 per page, about a second each on a
// slow connection). In the browser, calls made together now share one request, and the answer is kept for a few seconds. It is dropped as soon as the
// person signs in, signs out, refreshes their session or updates their account. A call that passes its own token is never shared. This only affects what
// the screen shows; what a person may read or change is decided by the database rules, not by this lookup.
if (typeof window !== 'undefined') {
  type GetUser = typeof supabase.auth.getUser
  type UserResult = Awaited<ReturnType<GetUser>>
  const rawGetUser: GetUser = supabase.auth.getUser.bind(supabase.auth)
  const KEEP_MS = 5000
  let inflight: Promise<UserResult> | null = null
  let kept: { at: number; value: UserResult } | null = null
  let generation = 0

  supabase.auth.onAuthStateChange(() => { generation++; kept = null; inflight = null })

  supabase.auth.getUser = ((jwt?: string) => {
    if (jwt) return rawGetUser(jwt)
    if (kept && Date.now() - kept.at < KEEP_MS) return Promise.resolve(kept.value)
    if (!inflight) {
      const startedIn = generation
      const request: Promise<UserResult> = rawGetUser().then((value) => {
        if (startedIn === generation && !value.error && value.data.user) kept = { at: Date.now(), value }
        return value
      }).finally(() => { if (inflight === request) inflight = null })
      inflight = request
    }
    return inflight
  }) as GetUser
}
