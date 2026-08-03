import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

// The marketing domain goes live before the app is ready for public traffic —
// visitors there see a splash page while the existing *.vercel.app URLs
// (used by pilot schools right now) keep working normally. Remove this
// block once smartassessja.com is ready to serve the real app.
const COMING_SOON_HOSTS = ['smartassessja.com', 'www.smartassessja.com']

export async function proxy(request: NextRequest) {
  const host = request.headers.get('host') || ''
  if (COMING_SOON_HOSTS.includes(host) && request.nextUrl.pathname !== '/coming-soon') {
    return NextResponse.rewrite(new URL('/coming-soon', request.url))
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
