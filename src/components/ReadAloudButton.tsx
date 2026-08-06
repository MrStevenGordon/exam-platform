'use client'

import { useEffect, useState } from 'react'

// Uses the browser's built-in Web Speech API rather than a cloud TTS
// service — no API key, no cost, and exam question text never leaves the
// student's own device. Known v1 limitation: math segments (the $...$
// KaTeX delimiters MathRenderer uses) are stripped down to plain text
// rather than converted to spoken math notation, so equations get read as
// raw symbols rather than e.g. "x squared".
function stripForSpeech(text: string): string {
  return text.replace(/\$([^$]+)\$/g, ' $1 ').replace(/\s+/g, ' ').trim()
}

const OPTION_LETTERS = ['A', 'B', 'C', 'D', 'E', 'F']

export default function ReadAloudButton({ questionText, options }: { questionText: string; options?: string[] | null }) {
  const [speaking, setSpeaking] = useState(false)
  const [supported, setSupported] = useState(true)

  useEffect(() => {
    setSupported(typeof window !== 'undefined' && 'speechSynthesis' in window)
    return () => {
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) window.speechSynthesis.cancel()
    }
  }, [])

  function handleClick() {
    if (!supported) return

    if (speaking) {
      window.speechSynthesis.cancel()
      setSpeaking(false)
      return
    }

    const parts = [stripForSpeech(questionText)]
    if (options && options.length > 0) {
      options.forEach((opt, i) => {
        parts.push(`Option ${OPTION_LETTERS[i] || i + 1}: ${stripForSpeech(opt)}`)
      })
    }

    const utterance = new SpeechSynthesisUtterance(parts.join('. '))
    utterance.onend = () => setSpeaking(false)
    utterance.onerror = () => setSpeaking(false)

    window.speechSynthesis.cancel()
    window.speechSynthesis.speak(utterance)
    setSpeaking(true)
  }

  if (!supported) return null

  return (
    <button
      onClick={handleClick}
      type="button"
      className="btn btn-ghost"
      style={{ fontSize: 12, padding: '4px 10px' }}
      aria-label={speaking ? 'Stop reading question aloud' : 'Read question aloud'}
    >
      {speaking ? '⏹ Stop' : '🔊 Read aloud'}
    </button>
  )
}
