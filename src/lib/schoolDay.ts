import { supabase } from '@/lib/supabase'
import type { BlockRow, PeriodRow } from '@/lib/schoolDayPure'

// Loads for the timetable screens. The school day and double periods need migrations 088 and 089; until they are applied the
// screens carry on exactly as before (no lunch or events, every class one period long).

export const BLOCK_COLUMNS = 'id, kind, title, grades, days, date_from, date_to, start_time, end_time, note'

export async function loadPeriods(year: string): Promise<PeriodRow[]> {
  const { data } = await supabase.from('timetable_periods').select('id, name, start_time, end_time, order_index').eq('academic_year', year).order('order_index')
  return (data as PeriodRow[]) || []
}

export async function loadBlocks(year: string): Promise<{ blocks: BlockRow[]; available: boolean }> {
  const { data, error } = await supabase.from('school_day_blocks').select(BLOCK_COLUMNS).eq('academic_year', year).order('start_time', { nullsFirst: true })
  if (error) return { blocks: [], available: false }
  return { blocks: (data as BlockRow[]) || [], available: true }
}

// Sections with their length. Asks for "span" first; if that column is not there yet, asks again without it.
export async function loadSections<T>(columns: string, year: string): Promise<T[]> {
  const first = await supabase.from('timetable_sections').select(`${columns}, span`).eq('academic_year', year)
  if (!first.error) return (first.data as unknown as T[]) || []
  const again = await supabase.from('timetable_sections').select(columns).eq('academic_year', year)
  return (again.data as unknown as T[]) || []
}
