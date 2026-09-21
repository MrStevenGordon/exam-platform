alter table public.shared_lesson_plans
  drop column if exists sub_topics,
  drop column if exists prerequisite_knowledge,
  drop column if exists four_cs,
  drop column if exists subject_practices,
  drop column if exists general_objectives,
  drop column if exists key_terms_formulae,
  drop column if exists lessons;
