import { redirect } from 'next/navigation'
import { getPlaySession } from '@/lib/playSession'

export default async function PlayIndex() {
  const session = await getPlaySession()
  redirect(session ? '/play/home' : '/play/sso')
}
