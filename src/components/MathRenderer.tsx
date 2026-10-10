'use client'

import MathText from './MathText'

interface MathRendererProps {
  text: string
  style?: React.CSSProperties
}

// Kept for the demo exam; new code should use MathText directly.
export default function MathRenderer({ text, style }: MathRendererProps) {
  return <MathText text={text} style={{ lineHeight: 1.6, ...style }} />
}
