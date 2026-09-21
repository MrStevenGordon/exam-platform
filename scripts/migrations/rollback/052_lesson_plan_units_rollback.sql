-- Removes the unit columns. WARNING: drops any unit overview / lesson content
-- saved since 052 was applied (lesson 1's 5E text also lives in the original
-- columns, so a plan's first lesson survives).
alter table public.lesson_plans
  drop column if exists sub_topics,
  drop column if exists prerequisite_knowledge,
  drop column if exists four_cs,
  drop column if exists subject_practices,
  drop column if exists general_objectives,
  drop column if exists key_terms_formulae,
  drop column if exists lessons;
