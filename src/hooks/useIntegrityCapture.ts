import { useRef, useCallback } from 'react'

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

const MAX_INTERVAL_SAMPLES = 500
const UNIFORM_CADENCE_MIN_SAMPLES = 30
const UNIFORM_CADENCE_MAX_CV = 0.15
const NO_CORRECTIONS_MIN_CHARS = 300
const UNTYPED_JUMP_MIN_CHARS = 25

type CaptureState = {
  lastKeyAt: number | null
  intervals: number[]
  backspaces: number
  keystrokes: number
  pasteAttempts: number
  maxJumpChars: number
  typedChars: number
  lastLength: number
  firstInputAt: number | null
  lastInputAt: number | null
}

function freshState(): CaptureState {
  return {
    lastKeyAt: null,
    intervals: [],
    backspaces: 0,
    keystrokes: 0,
    pasteAttempts: 0,
    maxJumpChars: 0,
    typedChars: 0,
    lastLength: 0,
    firstInputAt: null,
    lastInputAt: null,
  }
}

// Tracks the timing/shape of how a text field was filled in (not its content) so a
// teacher can be shown a soft "this may not have been typed by hand" signal at
// review time. Never records keys, only intervals and length deltas. Keyed by an
// arbitrary field id so one manager can cover several textareas (e.g. one per essay
// question) at once.
export function useIntegrityCapture() {
  const fields = useRef<Map<string, CaptureState>>(new Map())

  const stateFor = useCallback((fieldId: string): CaptureState => {
    let s = fields.current.get(fieldId)
    if (!s) { s = freshState(); fields.current.set(fieldId, s) }
    return s
  }, [])

  const onKeyDown = useCallback((fieldId: string, key: string) => {
    const s = stateFor(fieldId)
    const now = Date.now()
    if (s.lastKeyAt !== null) {
      const interval = now - s.lastKeyAt
      if (interval >= 0 && interval < 30000) {
        s.intervals.push(interval)
        if (s.intervals.length > MAX_INTERVAL_SAMPLES) s.intervals.shift()
      }
    }
    s.lastKeyAt = now
    s.keystrokes += 1
    if (key === 'Backspace' || key === 'Delete') s.backspaces += 1
  }, [stateFor])

  const onPasteAttempt = useCallback((fieldId: string) => {
    stateFor(fieldId).pasteAttempts += 1
  }, [stateFor])

  const onValueChange = useCallback((fieldId: string, newValue: string) => {
    const s = stateFor(fieldId)
    const now = Date.now()
    if (s.firstInputAt === null) s.firstInputAt = now
    s.lastInputAt = now
    const delta = newValue.length - s.lastLength
    if (delta > 0) {
      s.typedChars += delta
      if (delta > s.maxJumpChars) s.maxJumpChars = delta
    }
    s.lastLength = newValue.length
  }, [stateFor])

  const summarize = useCallback((fieldId: string, finalValue: string): IntegritySignals => {
    const s = stateFor(fieldId)
    const finalChars = finalValue.length
    const durationMs = s.firstInputAt !== null && s.lastInputAt !== null ? s.lastInputAt - s.firstInputAt : 0

    const n = s.intervals.length
    const intervalMeanMs = n > 0 ? s.intervals.reduce((a, b) => a + b, 0) / n : 0
    const variance = n > 0 ? s.intervals.reduce((a, b) => a + (b - intervalMeanMs) ** 2, 0) / n : 0
    const intervalStdMs = Math.sqrt(variance)

    const flags: string[] = []
    if (n >= UNIFORM_CADENCE_MIN_SAMPLES && intervalMeanMs > 0 && intervalStdMs / intervalMeanMs < UNIFORM_CADENCE_MAX_CV) {
      flags.push('uniform_typing_cadence')
    }
    if (s.backspaces === 0 && finalChars > NO_CORRECTIONS_MIN_CHARS) {
      flags.push('no_corrections')
    }
    if (s.maxJumpChars > UNTYPED_JUMP_MIN_CHARS) {
      flags.push('untyped_content_jump')
    }
    if (s.pasteAttempts > 0) {
      flags.push('paste_attempted')
    }

    return {
      v: 1,
      keystrokes: s.keystrokes,
      backspaces: s.backspaces,
      pasteAttempts: s.pasteAttempts,
      maxJumpChars: s.maxJumpChars,
      typedChars: s.typedChars,
      finalChars,
      durationMs,
      intervalMeanMs: Math.round(intervalMeanMs),
      intervalStdMs: Math.round(intervalStdMs),
      flags,
    }
  }, [stateFor])

  return { onKeyDown, onPasteAttempt, onValueChange, summarize }
}

export const INTEGRITY_FLAG_LABELS: Record<string, string> = {
  uniform_typing_cadence: 'Typed with unusually uniform timing (may indicate automated/simulated typing)',
  no_corrections: 'Long answer with zero corrections or backspaces',
  untyped_content_jump: 'Text appeared in a jump too large for a single keystroke (possible paste-block bypass)',
  paste_attempted: 'Student attempted to paste into this field',
}
