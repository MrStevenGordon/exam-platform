// Telling "there is no connection" apart from "the server said no". Only the first is a reason to use the copy on the device; a server
// refusal (not allowed, not found) must show as itself, never be hidden behind old data.
export function isNetworkFailure(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false
  const e = err as { message?: unknown; code?: unknown; status?: unknown; name?: unknown }
  if (typeof e.status === 'number' && e.status > 0) return false           // the server answered
  if (typeof e.code === 'string' && e.code !== '' && !/^(ECONN|ENOTFOUND|ETIMEDOUT)/.test(e.code)) return false   // a database error code
  const text = `${e.name ?? ''} ${typeof e.message === 'string' ? e.message : ''}`
  return /failed to fetch|fetch failed|networkerror|network request failed|load failed|network error|err_internet_disconnected|err_network|offline/i.test(text)
}

export const browserOffline = (): boolean => typeof navigator !== 'undefined' && navigator.onLine === false
