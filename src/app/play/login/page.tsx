import { redirect } from 'next/navigation'
import GamePasswordLogin from './GamePasswordLogin'

// Smart Play signs in through the exam login (/play/sso). The old game-password form is kept only for local
// development and is off unless PLAY_GAME_PASSWORD_LOGIN=1 (it also needs the same setting on /api/play/login).
export default async function PlayLoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  if (process.env.PLAY_GAME_PASSWORD_LOGIN !== '1') {
    const { next } = await searchParams
    redirect(next ? `/play/sso?next=${encodeURIComponent(next)}` : '/play/sso')
  }
  return <GamePasswordLogin />
}
