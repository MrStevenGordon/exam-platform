// Where to send someone after they sign in to Smart Play. Only pages inside Smart Play are
// allowed, so a crafted link can never bounce a student to another site.
export function safePlayPath(next: string | null | undefined, fallback = '/play/home'): string {
  if (!next || next.length > 400) return fallback
  if (!/^\/play(\/|\?|$)/.test(next)) return fallback
  if (next.includes('//') || next.includes('\\') || /[\u0000-\u001f]/.test(next)) return fallback
  return next
}
