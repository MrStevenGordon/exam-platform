import { supabase } from '@/lib/supabase'

export const ALL_EXAM_CATEGORIES = ['pop_quiz', 'midterm', 'monthly', 'end_of_term', 'end_of_year'] as const
export type ExamCategory = (typeof ALL_EXAM_CATEGORIES)[number]

export type SchoolFeatures = {
  teamLeadsEnabled: boolean
  seniorTeamLeadsEnabled: boolean
  examCategories: ExamCategory[]
}

// The full set every school effectively had before this config existed —
// the default whenever enabled_features is null (unconfigured) or a field
// within it is missing, so schools that predate this column, or a
// partially-filled-in config, never silently lose functionality.
const DEFAULT_FEATURES: SchoolFeatures = {
  teamLeadsEnabled: true,
  seniorTeamLeadsEnabled: true,
  examCategories: [...ALL_EXAM_CATEGORIES],
}

export async function getSchoolFeatures(): Promise<SchoolFeatures> {
  const { data } = await supabase.from('school_settings').select('enabled_features').limit(1).maybeSingle()
  const raw = data?.enabled_features as Partial<{
    team_leads_enabled: boolean
    senior_team_leads_enabled: boolean
    exam_categories: string[]
  }> | null

  if (!raw) return DEFAULT_FEATURES

  return {
    teamLeadsEnabled: raw.team_leads_enabled ?? DEFAULT_FEATURES.teamLeadsEnabled,
    seniorTeamLeadsEnabled: raw.senior_team_leads_enabled ?? DEFAULT_FEATURES.seniorTeamLeadsEnabled,
    examCategories: (raw.exam_categories as ExamCategory[] | undefined) ?? DEFAULT_FEATURES.examCategories,
  }
}
