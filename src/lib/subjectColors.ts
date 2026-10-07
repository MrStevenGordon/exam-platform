// A steady colour for each subject, so Mathematics is always the same colour on every timetable.
// Common subjects have their own; anything else gets one from the palette, chosen by its name.
type Swatch = { fg: string; bg: string }
const KNOWN: [RegExp, Swatch][] = [
  [/math/i, { fg: '#D4762A', bg: '#FBE9D6' }],
  [/english|language arts|literature/i, { fg: '#1F8A84', bg: '#DDF0EE' }],
  [/science|biology|chemistry|physics/i, { fg: '#4C8F4A', bg: '#E3F1E1' }],
  [/social|history|geography|civics/i, { fg: '#7A5BA6', bg: '#ECE5F5' }],
  [/spanish|french|language/i, { fg: '#C2493D', bg: '#F9E2DF' }],
  [/information|computer|\bit\b|technology|ict/i, { fg: '#3A6EA5', bg: '#E0EBF6' }],
  [/physical|\bpe\b|sport/i, { fg: '#8A7A2B', bg: '#F3EFD3' }],
  [/art|music|drama|dance/i, { fg: '#B0407A', bg: '#F6E1EC' }],
  [/form|register|home ?room/i, { fg: '#6B4F35', bg: '#EFE7DD' }],
]
const PALETTE: Swatch[] = [
  { fg: '#2F7F9E', bg: '#DDEEF5' }, { fg: '#9A6A1F', bg: '#F6EAD3' }, { fg: '#6E7F2B', bg: '#EDF1D8' },
  { fg: '#A0507F', bg: '#F4E3EC' }, { fg: '#47789A', bg: '#E1ECF3' }, { fg: '#8B5A3C', bg: '#F1E6DD' },
]
export function subjectColor(subject: string | null | undefined): Swatch {
  const name = String(subject || '')
  for (const [re, sw] of KNOWN) if (re.test(name)) return sw
  let h = 0
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0
  return PALETTE[h % PALETTE.length]
}
