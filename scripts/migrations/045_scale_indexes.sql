-- Pilot readiness (1700+ students, Manchester High Math dept): almost none
-- of the foreign keys on the core school/exam schema are indexed -- fine at
-- demo scale, but every one of these becomes a sequential scan once
-- enrollments/exam_sessions/responses hold thousands of rows, and several
-- of these columns sit in the hot path of every single page load
-- (exam-taking, grading, dashboards, report cards, messaging).
--
-- Deliberately scoped to the tables real student/teacher/supervisor traffic
-- touches at pilot scale -- skips the separate org_exam*/organizations
-- tool (already indexed) and low-traffic admin tables (school_requests,
-- organization_payments, department_subjects, senior/team_lead_appointments)
-- that never see meaningful row counts.
--
-- concurrently is intentionally not used here: this repo applies migrations
-- as a single psql run, not inside application code, and these tables are
-- still small pre-pilot, so a brief lock during creation is a non-issue.

create index if not exists idx_enrollments_student_id on public.enrollments (student_id);
create index if not exists idx_enrollments_class_group_id on public.enrollments (class_group_id);

create index if not exists idx_exam_sessions_student_id on public.exam_sessions (student_id);
create index if not exists idx_exam_sessions_draft_exam_id on public.exam_sessions (draft_exam_id);
create index if not exists idx_exam_sessions_final_exam_id on public.exam_sessions (final_exam_id);
create index if not exists idx_exam_sessions_assigned_teacher_id on public.exam_sessions (assigned_teacher_id);
create index if not exists idx_exam_sessions_group_id on public.exam_sessions (group_id);

create index if not exists idx_responses_session_id on public.responses (session_id);
create index if not exists idx_responses_question_id on public.responses (question_id);
create index if not exists idx_responses_graded_by on public.responses (graded_by);

create index if not exists idx_questions_draft_exam_id on public.questions (draft_exam_id);
create index if not exists idx_questions_created_by on public.questions (created_by);
create index if not exists idx_questions_section_id on public.questions (section_id);

create index if not exists idx_draft_exams_created_by on public.draft_exams (created_by);
create index if not exists idx_draft_exams_department_id on public.draft_exams (department_id);

create index if not exists idx_final_exams_department_id on public.final_exams (department_id);
create index if not exists idx_final_exams_class_group_id on public.final_exams (class_group_id);
create index if not exists idx_final_exams_created_by on public.final_exams (created_by);

create index if not exists idx_draft_exam_class_groups_draft_exam_id on public.draft_exam_class_groups (draft_exam_id);
create index if not exists idx_draft_exam_class_groups_class_group_id on public.draft_exam_class_groups (class_group_id);

create index if not exists idx_final_exam_class_groups_final_exam_id on public.final_exam_class_groups (final_exam_id);
create index if not exists idx_final_exam_class_groups_class_group_id on public.final_exam_class_groups (class_group_id);

create index if not exists idx_final_exam_questions_final_exam_id on public.final_exam_questions (final_exam_id);
create index if not exists idx_final_exam_questions_question_id on public.final_exam_questions (question_id);

create index if not exists idx_exam_sections_draft_exam_id on public.exam_sections (draft_exam_id);
create index if not exists idx_exam_sections_final_exam_id on public.exam_sections (final_exam_id);

create index if not exists idx_teacher_class_groups_teacher_id on public.teacher_class_groups (teacher_id);
create index if not exists idx_teacher_class_groups_class_group_id on public.teacher_class_groups (class_group_id);

create index if not exists idx_section_enrollments_section_id on public.section_enrollments (section_id);
create index if not exists idx_section_enrollments_student_id on public.section_enrollments (student_id);

create index if not exists idx_timetable_sections_teacher_id on public.timetable_sections (teacher_id);
create index if not exists idx_timetable_sections_class_group_id on public.timetable_sections (class_group_id);

create index if not exists idx_report_card_comments_student_id on public.report_card_comments (student_id);
create index if not exists idx_report_card_comments_term_id on public.report_card_comments (term_id);

create index if not exists idx_report_card_attendance_student_id on public.report_card_attendance (student_id);
create index if not exists idx_report_card_attendance_term_id on public.report_card_attendance (term_id);

create index if not exists idx_lesson_plans_teacher_id on public.lesson_plans (teacher_id);

create index if not exists idx_messages_conversation_id on public.messages (conversation_id);
create index if not exists idx_messages_sender_id on public.messages (sender_id);
create index if not exists idx_conversation_participants_conversation_id on public.conversation_participants (conversation_id);
create index if not exists idx_conversation_participants_user_id on public.conversation_participants (user_id);
create index if not exists idx_chat_conversations_user_id on public.chat_conversations (user_id);

create index if not exists idx_self_mocks_student_id on public.self_mocks (student_id);
create index if not exists idx_self_mock_questions_self_mock_id on public.self_mock_questions (self_mock_id);
create index if not exists idx_self_mock_questions_question_id on public.self_mock_questions (question_id);

create index if not exists idx_marking_point_responses_response_id on public.marking_point_responses (response_id);
create index if not exists idx_marking_point_responses_graded_by on public.marking_point_responses (graded_by);

create index if not exists idx_project_group_members_group_id on public.project_group_members (group_id);
create index if not exists idx_project_group_members_student_id on public.project_group_members (student_id);
create index if not exists idx_project_groups_draft_exam_id on public.project_groups (draft_exam_id);

create index if not exists idx_peer_ratings_group_id on public.peer_ratings (group_id);
create index if not exists idx_peer_ratings_ratee_student_id on public.peer_ratings (ratee_student_id);
create index if not exists idx_peer_ratings_rater_student_id on public.peer_ratings (rater_student_id);

create index if not exists idx_class_groups_department_id on public.class_groups (department_id);
create index if not exists idx_profiles_department_id on public.profiles (department_id);
create index if not exists idx_ai_polish_usage_teacher_id on public.ai_polish_usage (teacher_id);
