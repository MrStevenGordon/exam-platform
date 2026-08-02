// Verifies a Cloudflare Turnstile token server-side. Returns true (a safe
// no-op pass) whenever TURNSTILE_SECRET_KEY isn't configured yet, so this
// ships inert until a real key is added — same pattern as Sentry's DSN.
export async function verifyTurnstile(token: string | undefined): Promise<boolean> {
  const secret = process.env.TURNSTILE_SECRET_KEY
  if (!secret) return true

  if (!token) return false

  try {
    const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ secret, response: token }),
    })
    const data = await res.json()
    return data.success === true
  } catch {
    return false
  }
}
