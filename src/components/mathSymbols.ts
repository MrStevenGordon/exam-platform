// Shared between MathToolbar (question text) and MathSymbolPicker (multiple
// choice options) so both always offer the exact same symbols, grouped the
// same way. Update symbols here once, both pickers stay in sync.

const SUPERSCRIPT_MAP: Record<string, string> = {
  '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴',
  '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹',
  '-': '⁻', '+': '⁺', '(': '⁽', ')': '⁾',
}

const SUBSCRIPT_MAP: Record<string, string> = {
  '0': '₀', '1': '₁', '2': '₂', '3': '₃', '4': '₄',
  '5': '₅', '6': '₆', '7': '₇', '8': '₈', '9': '₉',
  '-': '₋', '+': '₊', '(': '₍', ')': '₎',
}

export function toSuperscript(input: string): string {
  return input
    .split('')
    .map((ch) => SUPERSCRIPT_MAP[ch] ?? ch)
    .join('')
}

export function toSubscript(input: string): string {
  return input
    .split('')
    .map((ch) => SUBSCRIPT_MAP[ch] ?? ch)
    .join('')
}

// Builds a real-looking inline fraction using the dedicated Unicode fraction
// slash (⁄) with a superscript numerator and subscript denominator — the
// standard technique for arbitrary fractions, since Unicode only has a
// handful of fixed fraction characters (½, ⅓, etc.), not general ones.
export function buildFraction(numerator: string, denominator: string): string {
  return toSuperscript(numerator) + '⁄' + toSubscript(denominator)
}

export type MathButton = { label: string; insert: string; title: string }

export const MATH_BUTTONS: MathButton[] = [
  // Powers
  { label: 'x²', insert: '²', title: 'Squared' },
  { label: 'x³', insert: '³', title: 'Cubed' },
  { label: 'x⁴', insert: '⁴', title: 'Power 4' },
  { label: 'xⁿ', insert: 'ⁿ', title: 'Power n' },
  { label: 'x⁻¹', insert: '⁻¹', title: 'Power -1' },
  { label: 'x⁻²', insert: '⁻²', title: 'Power -2' },
  // Roots & Ops
  { label: '√', insert: '√', title: 'Square root' },
  { label: '∛', insert: '∛', title: 'Cube root' },
  { label: '/', insert: '/', title: 'Fraction' },
  { label: '×', insert: '×', title: 'Multiply' },
  { label: '÷', insert: '÷', title: 'Divide' },
  { label: '±', insert: '±', title: 'Plus/minus' },
  // Compare
  { label: '≠', insert: '≠', title: 'Not equal' },
  { label: '≤', insert: '≤', title: 'Less than or equal' },
  { label: '≥', insert: '≥', title: 'Greater than or equal' },
  { label: '≈', insert: '≈', title: 'Approximately' },
  { label: '<', insert: '<', title: 'Less than' },
  { label: '>', insert: '>', title: 'Greater than' },
  // Greek
  { label: 'π', insert: 'π', title: 'Pi' },
  { label: 'θ', insert: 'θ', title: 'Theta' },
  { label: 'α', insert: 'α', title: 'Alpha' },
  { label: 'β', insert: 'β', title: 'Beta' },
  // Notation
  { label: '10⁻⁵', insert: '× 10⁻⁵', title: 'Standard form ×10⁻⁵' },
  { label: '10⁵', insert: '× 10⁵', title: 'Standard form ×10⁵' },
  // Subscripts
  { label: 'x₁', insert: '₁', title: 'Subscript 1' },
  { label: 'x₂', insert: '₂', title: 'Subscript 2' },
  // Geometry
  { label: '°', insert: '°', title: 'Degrees' },
  { label: '∠', insert: '∠', title: 'Angle' },
  { label: '△', insert: '△', title: 'Triangle' },
  { label: '∥', insert: '∥', title: 'Parallel' },
  { label: '⊥', insert: '⊥', title: 'Perpendicular' },
  // Sets
  { label: '∈', insert: '∈', title: 'Element of' },
  { label: '∉', insert: '∉', title: 'Not element of' },
  { label: '∪', insert: '∪', title: 'Union' },
  { label: '∩', insert: '∩', title: 'Intersection' },
  { label: '⊂', insert: '⊂', title: 'Subset' },
  { label: 'U', insert: 'U = {}', title: 'Universal set' },
  // Roman numerals
  { label: 'Ⅰ', insert: 'Ⅰ', title: 'Roman numeral 1' },
  { label: 'Ⅱ', insert: 'Ⅱ', title: 'Roman numeral 2' },
  { label: 'Ⅲ', insert: 'Ⅲ', title: 'Roman numeral 3' },
  { label: 'Ⅳ', insert: 'Ⅳ', title: 'Roman numeral 4' },
  { label: 'Ⅴ', insert: 'Ⅴ', title: 'Roman numeral 5' },
  { label: 'Ⅵ', insert: 'Ⅵ', title: 'Roman numeral 6' },
  { label: 'Ⅶ', insert: 'Ⅶ', title: 'Roman numeral 7' },
  { label: 'Ⅷ', insert: 'Ⅷ', title: 'Roman numeral 8' },
  { label: 'Ⅸ', insert: 'Ⅸ', title: 'Roman numeral 9' },
  { label: 'Ⅹ', insert: 'Ⅹ', title: 'Roman numeral 10' },
  // Other
  { label: '$', insert: '$', title: 'Dollar' },
  { label: '℃', insert: '℃', title: 'Celsius' },
  { label: '℉', insert: '℉', title: 'Fahrenheit' },
]

export const BUTTON_GROUPS = [
  { label: 'Powers', buttons: MATH_BUTTONS.slice(0, 6) },
  { label: 'Roots & Ops', buttons: MATH_BUTTONS.slice(6, 12) },
  { label: 'Compare', buttons: MATH_BUTTONS.slice(12, 18) },
  { label: 'Greek', buttons: MATH_BUTTONS.slice(18, 22) },
  { label: 'Notation', buttons: MATH_BUTTONS.slice(22, 24) },
  { label: 'Subscripts', buttons: MATH_BUTTONS.slice(24, 26) },
  { label: 'Geometry', buttons: MATH_BUTTONS.slice(26, 31) },
  { label: 'Sets', buttons: MATH_BUTTONS.slice(31, 37) },
  { label: 'Roman', buttons: MATH_BUTTONS.slice(37, 47) },
  { label: 'Other', buttons: MATH_BUTTONS.slice(47) },
]
