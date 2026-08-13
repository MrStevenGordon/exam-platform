import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

// The marketing domain goes live before the app is ready for public traffic —
// visitors there see a splash page while the existing *.vercel.app URLs
// (used by pilot schools right now) keep working normally. Remove this
// block once smartassessja.com is ready to serve the real app.
const COMING_SOON_HOSTS = ['smartassessja.com', 'www.smartassessja.com']

// Dedicated subdomain serving the schools/organizations pitch deck as a static
// file, standing in for a live site while the main domain stays gated above.
const PITCH_HOST = 'pitch.smartassessja.com'

// Site-wide kill switch for planned/emergency downtime. Set MAINTENANCE_MODE
// to a truthy value and redeploy (env var changes are snapshotted per
// deployment, so a plain env var edit alone doesn't take effect) to gate
// every route behind /maintenance. MAINTENANCE_BYPASS_TOKEN lets the team
// keep working on the real site while everyone else sees the maintenance
// page: visit any URL with ?bypass=<token> once and a cookie remembers it.
const MAINTENANCE_MODE = ['1', 'true'].includes((process.env.MAINTENANCE_MODE || '').toLowerCase())
const MAINTENANCE_BYPASS_TOKEN = process.env.MAINTENANCE_BYPASS_TOKEN
const MAINTENANCE_BYPASS_COOKIE = 'maintenance_bypass'

export async function proxy(request: NextRequest) {
  if (MAINTENANCE_MODE && request.nextUrl.pathname !== '/maintenance') {
    const queryBypass = request.nextUrl.searchParams.get('bypass')
    const cookieBypass = request.cookies.get(MAINTENANCE_BYPASS_COOKIE)?.value
    const bypassed = !!MAINTENANCE_BYPASS_TOKEN &&
      (queryBypass === MAINTENANCE_BYPASS_TOKEN || cookieBypass === MAINTENANCE_BYPASS_TOKEN)

    if (!bypassed) {
      const response = NextResponse.rewrite(new URL('/maintenance', request.url))
      response.headers.set('Retry-After', '3600')
      return response
    }

    if (queryBypass === MAINTENANCE_BYPASS_TOKEN && !cookieBypass) {
      const response = NextResponse.next()
      response.cookies.set(MAINTENANCE_BYPASS_COOKIE, queryBypass, {
        maxAge: 60 * 60 * 24,
        httpOnly: true,
        sameSite: 'lax',
      })
      return response
    }
  }

  const host = request.headers.get('host') || ''
  if (
    COMING_SOON_HOSTS.includes(host) &&
    request.nextUrl.pathname !== '/coming-soon' &&
    request.nextUrl.pathname !== '/demo-exam' &&
    !request.nextUrl.pathname.startsWith('/api/')
  ) {
    return NextResponse.rewrite(new URL('/coming-soon', request.url))
  }

  if (host === PITCH_HOST && request.nextUrl.pathname === '/') {
    return NextResponse.rewrite(new URL('/pitch/schools.html', request.url))
  }

  const protectedPaths = ['/dashboard']
  const isProtectedPath = protectedPaths.some((path) =>
    request.nextUrl.pathname.startsWith(path)
  )
  if (!isProtectedPath) return NextResponse.next()

  let response = NextResponse.next({
    request: { headers: request.headers },
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          response = NextResponse.next({
            request: { headers: request.headers },
          })
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  return response
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
}
