export type IntegritySignals = {
  v: 1
  keystrokes: number
  backspaces: number
  pasteAttempts: number
  maxJumpChars: number
  typedChars: number
  finalChars: number
  durationMs: number
  intervalMeanMs: number
  intervalStdMs: number
  flags: string[]
}

export const INTEGRITY_FLAG_LABELS: Record<string, string> = {
  uniform_typing_cadence: 'Typed with unusually uniform timing (may indicate automated/simulated typing)',
  no_corrections: 'Long answer with zero corrections or backspaces',
  untyped_content_jump: 'Text appeared in a jump too large for a single keystroke (possible paste-block bypass)',
  paste_attempted: 'Student attempted to paste into this field',
  excessive_typing_speed: 'Typed unusually fast for the amount of text (may indicate assistance)',
  low_keystroke_ratio: "Some of the final text didn't come from tracked keystrokes",
}

export type ResponseIntegritySignals = { answer?: IntegritySignals; working?: IntegritySignals } | null

export function mergeIntegrityFlags(signals: ResponseIntegritySignals): string[] {
  return Array.from(new Set([
    ...(signals?.answer?.flags || []),
    ...(signals?.working?.flags || []),
  ]))
}

export type AiReview = {
  verdict: 'likely_human' | 'possibly_ai_assisted' | 'inconclusive'
  explanation: string
  checked_at: string
  checked_by: string
}
