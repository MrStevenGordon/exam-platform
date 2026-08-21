--
-- PostgreSQL database dump
--

\restrict Zdz5KgmtbdZPUzvjdsW0YtBPH1pM63wVBuY1CpU5WkKFsXjTPwnhsLZAv5EDitY

-- Dumped from database version 17.6
-- Dumped by pg_dump version 17.10 (Homebrew)

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: public; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA public;


--
-- Name: SCHEMA public; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON SCHEMA public IS 'standard public schema';


--
-- Name: append_violation_log(uuid, jsonb); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.append_violation_log(session_id uuid, entry jsonb) RETURNS void
    LANGUAGE sql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  update exam_sessions 
  set violation_log = coalesce(violation_log, '[]'::jsonb) || entry::jsonb
  where id = session_id;
$$;


--
-- Name: is_admin(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.is_admin() RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select exists (
    select 1 from profiles
    where id = auth.uid() and role = 'admin'
  );
$$;


--
-- Name: is_class_subject_teacher(uuid, uuid, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.is_class_subject_teacher(p_teacher_id uuid, p_student_id uuid, p_subject text) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select exists (
    select 1
    from enrollments e
    join teacher_class_groups tcg on tcg.class_group_id = e.class_group_id
    join teacher_subjects ts on ts.teacher_id = tcg.teacher_id
    where e.student_id = p_student_id
    and tcg.teacher_id = p_teacher_id
    and ts.subject = p_subject
  );
$$;


--
-- Name: is_class_subject_teacher(uuid, uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.is_class_subject_teacher(p_teacher_id uuid, p_student_id uuid, p_department_id uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select exists (
    select 1
    from enrollments e
    join teacher_class_groups tcg on tcg.class_group_id = e.class_group_id
    join profiles teacher_profile on teacher_profile.id = tcg.teacher_id
    where e.student_id = p_student_id
    and tcg.teacher_id = p_teacher_id
    and teacher_profile.department_id = p_department_id
  );
$$;


--
-- Name: is_direct_published(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.is_direct_published(check_draft_exam_id uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select exists (
    select 1 from draft_exams
    where id = check_draft_exam_id
    and direct_published = true
  );
$$;


--
-- Name: is_enrolled_in(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.is_enrolled_in(check_class_group_id uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select exists (
    select 1 from enrollments
    where class_group_id = check_class_group_id
    and student_id = auth.uid()
  );
$$;


--
-- Name: is_supervisor(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.is_supervisor() RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select exists (
    select 1 from profiles
    where id = auth.uid() and role = 'supervisor'
  );
$$;


--
-- Name: is_supervisor_of_student(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.is_supervisor_of_student(target_student_id uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select exists (
    select 1
    from exam_sessions s
    join final_exams f on f.id = s.final_exam_id
    where s.student_id = target_student_id
    and f.department_id = my_supervised_department()
  );
$$;


--
-- Name: is_system_admin(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.is_system_admin() RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select exists (
    select 1 from profiles
    where id = auth.uid() and is_system_admin = true
  );
$$;


--
-- Name: is_teacher(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.is_teacher() RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select exists (
    select 1 from profiles
    where id = auth.uid() and role = 'teacher'
  );
$$;


--
-- Name: is_teacher_of_class_student(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.is_teacher_of_class_student(target_student_id uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select exists (
    select 1
    from enrollments e
    join teacher_class_groups tcg on tcg.class_group_id = e.class_group_id
    where e.student_id = target_student_id
    and tcg.teacher_id = auth.uid()
  );
$$;


--
-- Name: is_teacher_of_student(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.is_teacher_of_student(target_student_id uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select exists (
    select 1
    from exam_sessions
    join draft_exams on draft_exams.id = exam_sessions.draft_exam_id
    where exam_sessions.student_id = target_student_id
    and draft_exams.created_by = auth.uid()
  );
$$;


--
-- Name: my_class_group_ids(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.my_class_group_ids() RETURNS SETOF uuid
    LANGUAGE sql STABLE SECURITY DEFINER
    AS $$
  select class_group_id from enrollments where student_id = auth.uid();
$$;


--
-- Name: my_department_id(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.my_department_id() RETURNS uuid
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select department_id from profiles where id = auth.uid();
$$;


--
-- Name: my_profile_department_id(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.my_profile_department_id() RETURNS uuid
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select department_id from profiles where id = auth.uid()
$$;


--
-- Name: my_role(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.my_role() RETURNS text
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select role from profiles where id = auth.uid()
$$;


--
-- Name: my_supervised_department(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.my_supervised_department() RETURNS uuid
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select id from departments where head_id = auth.uid();
$$;


--
-- Name: my_teacher_ids(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.my_teacher_ids() RETURNS SETOF uuid
    LANGUAGE sql STABLE SECURITY DEFINER
    AS $$
  select tcg.teacher_id 
  from teacher_class_groups tcg
  where tcg.class_group_id in (
    select class_group_id from enrollments where student_id = auth.uid()
  );
$$;


--
-- Name: owns_draft_exam(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.owns_draft_exam(check_draft_exam_id uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select exists (
    select 1 from draft_exams
    where id = check_draft_exam_id
    and created_by = auth.uid()
  );
$$;


--
-- Name: rls_auto_enable(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.rls_auto_enable() RETURNS event_trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'pg_catalog'
    AS $$
DECLARE
  cmd record;
BEGIN
  FOR cmd IN
    SELECT *
    FROM pg_event_trigger_ddl_commands()
    WHERE command_tag IN ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO')
      AND object_type IN ('table','partitioned table')
  LOOP
     IF cmd.schema_name IS NOT NULL AND cmd.schema_name IN ('public') AND cmd.schema_name NOT IN ('pg_catalog','information_schema') AND cmd.schema_name NOT LIKE 'pg_toast%' AND cmd.schema_name NOT LIKE 'pg_temp%' THEN
      BEGIN
        EXECUTE format('alter table if exists %s enable row level security', cmd.object_identity);
        RAISE LOG 'rls_auto_enable: enabled RLS on %', cmd.object_identity;
      EXCEPTION
        WHEN OTHERS THEN
          RAISE LOG 'rls_auto_enable: failed to enable RLS on %', cmd.object_identity;
      END;
     ELSE
        RAISE LOG 'rls_auto_enable: skip % (either system schema or not in enforced list: %.)', cmd.object_identity, cmd.schema_name;
     END IF;
  END LOOP;
END;
$$;


--
-- Name: student_can_see_final_exam(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.student_can_see_final_exam(exam_id uuid) RETURNS boolean
    LANGUAGE sql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select exists (
    select 1 from final_exam_class_groups fecg
    join enrollments e on e.class_group_id = fecg.class_group_id
    where fecg.final_exam_id = exam_id
    and e.student_id = auth.uid()
  );
$$;


--
-- Name: student_completed_question_exam(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.student_completed_question_exam(q_id uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select exists (
    select 1
    from questions q
    join exam_sessions s on s.draft_exam_id = q.draft_exam_id
    where q.id = q_id
      and s.student_id = auth.uid()
      and s.status = 'completed'
  ) or exists (
    select 1
    from final_exam_questions feq
    join exam_sessions s on s.final_exam_id = feq.final_exam_id
    where feq.question_id = q_id
      and s.student_id = auth.uid()
      and s.status = 'completed'
  );
$$;


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: ai_polish_usage; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ai_polish_usage (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    teacher_id uuid NOT NULL,
    used_at timestamp with time zone DEFAULT now() NOT NULL,
    month_year text NOT NULL
);


--
-- Name: class_groups; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.class_groups (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    year_grade text NOT NULL,
    department_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    academic_year text DEFAULT '2025-2026'::text NOT NULL
);


--
-- Name: department_subjects; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.department_subjects (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    department_id uuid NOT NULL,
    subject text NOT NULL,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: departments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.departments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    head_id uuid,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: draft_exam_class_groups; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.draft_exam_class_groups (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    draft_exam_id uuid NOT NULL,
    class_group_id uuid NOT NULL
);


--
-- Name: draft_exams; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.draft_exams (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    title text NOT NULL,
    subject text NOT NULL,
    created_by uuid NOT NULL,
    instructions text,
    status text DEFAULT 'draft'::text NOT NULL,
    reviewed_by uuid,
    review_notes text,
    created_at timestamp with time zone DEFAULT now(),
    submitted_at timestamp with time zone,
    reviewed_at timestamp with time zone,
    department_id uuid,
    exam_kind text DEFAULT 'pop_quiz'::text NOT NULL,
    direct_published boolean DEFAULT false NOT NULL,
    direct_published_at timestamp with time zone,
    duration_minutes integer DEFAULT 60 NOT NULL,
    access_password text,
    pass_mark integer DEFAULT 50 NOT NULL,
    questions_per_page integer DEFAULT 10 NOT NULL,
    target_grade integer,
    term text,
    calculator_enabled boolean DEFAULT false,
    supervisor_notes text,
    published_final_exam_id uuid,
    available_from timestamp with time zone,
    available_until timestamp with time zone,
    CONSTRAINT draft_exams_exam_kind_check CHECK ((exam_kind = ANY (ARRAY['final_exam_submission'::text, 'pop_quiz'::text, 'midterm'::text, 'end_of_year'::text, 'monthly'::text, 'end_of_term'::text, 'class_test'::text, 'weekly_test'::text, 'assignment'::text, 'homework'::text, 'group_project'::text]))),
    CONSTRAINT draft_exams_status_check CHECK ((status = ANY (ARRAY['draft'::text, 'submitted'::text, 'approved'::text, 'rejected'::text, 'published'::text])))
);


--
-- Name: enrollments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.enrollments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    student_id uuid NOT NULL,
    class_group_id uuid NOT NULL
);


--
-- Name: exam_sections; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.exam_sections (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    instructions text,
    order_index integer DEFAULT 0 NOT NULL,
    draft_exam_id uuid,
    final_exam_id uuid,
    question_type text
);


--
-- Name: exam_sessions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.exam_sessions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    final_exam_id uuid,
    student_id uuid NOT NULL,
    status text DEFAULT 'in_progress'::text NOT NULL,
    started_at timestamp with time zone DEFAULT now(),
    completed_at timestamp with time zone,
    tab_switch_count integer DEFAULT 0 NOT NULL,
    flagged boolean DEFAULT false NOT NULL,
    time_limit_seconds integer,
    total_score numeric,
    max_possible_score numeric,
    fully_graded boolean DEFAULT false NOT NULL,
    results_released boolean DEFAULT false NOT NULL,
    draft_exam_id uuid,
    option_shuffle_seed integer,
    password_verified boolean DEFAULT false NOT NULL,
    violation_log jsonb DEFAULT '[]'::jsonb,
    assigned_teacher_id uuid,
    file_submission_url text,
    file_submission_name text,
    group_id uuid,
    contribution_statement text,
    contribution_integrity_signals jsonb,
    CONSTRAINT exam_sessions_one_exam_type CHECK ((((final_exam_id IS NOT NULL) AND (draft_exam_id IS NULL)) OR ((final_exam_id IS NULL) AND (draft_exam_id IS NOT NULL)))),
    CONSTRAINT exam_sessions_status_check CHECK ((status = ANY (ARRAY['in_progress'::text, 'completed'::text])))
);


--
-- Name: final_exam_class_groups; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.final_exam_class_groups (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    final_exam_id uuid NOT NULL,
    class_group_id uuid NOT NULL
);


--
-- Name: final_exam_questions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.final_exam_questions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    final_exam_id uuid NOT NULL,
    question_id uuid NOT NULL,
    order_index integer DEFAULT 0 NOT NULL,
    section_id uuid
);


--
-- Name: final_exams; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.final_exams (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    title text NOT NULL,
    subject text NOT NULL,
    instructions text,
    created_by uuid NOT NULL,
    status text DEFAULT 'draft'::text NOT NULL,
    duration_minutes integer NOT NULL,
    published_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now(),
    department_id uuid,
    class_group_id uuid,
    exam_category text DEFAULT 'end_of_year'::text NOT NULL,
    access_password text,
    pass_mark integer DEFAULT 50 NOT NULL,
    questions_per_page integer DEFAULT 10 NOT NULL,
    target_grade integer,
    calculator_enabled boolean DEFAULT false NOT NULL,
    available_from timestamp with time zone,
    available_until timestamp with time zone,
    CONSTRAINT final_exams_exam_category_check CHECK ((exam_category = ANY (ARRAY['pop_quiz'::text, 'midterm'::text, 'end_of_year'::text, 'monthly'::text, 'end_of_term'::text]))),
    CONSTRAINT final_exams_status_check CHECK ((status = ANY (ARRAY['draft'::text, 'published'::text, 'closed'::text])))
);


--
-- Name: marking_point_responses; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.marking_point_responses (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    response_id uuid NOT NULL,
    point_index integer NOT NULL,
    points_awarded numeric,
    graded_by uuid,
    graded_at timestamp with time zone
);


--
-- Name: org_exam_questions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.org_exam_questions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    org_exam_id uuid NOT NULL,
    question_type text NOT NULL,
    question_text text NOT NULL,
    options jsonb,
    correct_answer text,
    points integer DEFAULT 1 NOT NULL,
    marking_points jsonb,
    order_index integer DEFAULT 0 NOT NULL,
    CONSTRAINT org_exam_questions_question_type_check CHECK ((question_type = ANY (ARRAY['multiple_choice'::text, 'true_false'::text, 'short_answer'::text, 'fill_blank'::text])))
);


--
-- Name: org_exam_responses; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.org_exam_responses (
    session_id uuid NOT NULL,
    question_id uuid NOT NULL,
    answer text,
    points_awarded numeric
);


--
-- Name: org_exam_sessions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.org_exam_sessions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    org_exam_id uuid NOT NULL,
    auth_user_id uuid NOT NULL,
    started_at timestamp with time zone DEFAULT now() NOT NULL,
    submitted_at timestamp with time zone,
    total_score numeric,
    max_possible_score numeric
);


--
-- Name: org_exams; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.org_exams (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid NOT NULL,
    title text NOT NULL,
    instructions text,
    exam_code text NOT NULL,
    access_password text NOT NULL,
    status text DEFAULT 'draft'::text NOT NULL,
    retention_days integer DEFAULT 60 NOT NULL,
    show_score_to_respondent boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    published_at timestamp with time zone,
    CONSTRAINT org_exams_retention_days_check CHECK (((retention_days >= 30) AND (retention_days <= 90))),
    CONSTRAINT org_exams_status_check CHECK ((status = ANY (ARRAY['draft'::text, 'published'::text])))
);


--
-- Name: org_respondent_field_values; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.org_respondent_field_values (
    session_id uuid NOT NULL,
    field_id uuid NOT NULL,
    value text
);


--
-- Name: org_respondent_fields; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.org_respondent_fields (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    org_exam_id uuid NOT NULL,
    label text NOT NULL,
    field_type text DEFAULT 'text'::text NOT NULL,
    required boolean DEFAULT true NOT NULL,
    order_index integer DEFAULT 0 NOT NULL,
    CONSTRAINT org_respondent_fields_field_type_check CHECK ((field_type = ANY (ARRAY['text'::text, 'number'::text, 'email'::text])))
);


--
-- Name: organization_payments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.organization_payments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid NOT NULL,
    plan text NOT NULL,
    method text NOT NULL,
    amount_usd numeric NOT NULL,
    status text DEFAULT 'pending'::text NOT NULL,
    reference_note text,
    submitted_at timestamp with time zone DEFAULT now() NOT NULL,
    confirmed_at timestamp with time zone,
    confirmed_by uuid,
    CONSTRAINT organization_payments_method_check CHECK ((method = ANY (ARRAY['card'::text, 'bank_transfer'::text]))),
    CONSTRAINT organization_payments_plan_check CHECK ((plan = ANY (ARRAY['3_month'::text, '6_month'::text, 'yearly'::text]))),
    CONSTRAINT organization_payments_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'confirmed'::text, 'rejected'::text])))
);


--
-- Name: organization_subscriptions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.organization_subscriptions (
    organization_id uuid NOT NULL,
    subscription_status text DEFAULT 'inactive'::text NOT NULL,
    subscription_plan text,
    current_period_end timestamp with time zone,
    stripe_customer_id text,
    stripe_subscription_id text,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    license_key text,
    approved_by uuid,
    approved_at timestamp with time zone,
    CONSTRAINT organization_subscriptions_subscription_plan_check CHECK ((subscription_plan = ANY (ARRAY['3_month'::text, '6_month'::text, 'yearly'::text]))),
    CONSTRAINT organization_subscriptions_subscription_status_check CHECK ((subscription_status = ANY (ARRAY['inactive'::text, 'active'::text, 'past_due'::text, 'canceled'::text])))
);


--
-- Name: organizations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.organizations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    auth_user_id uuid NOT NULL,
    name text NOT NULL,
    contact_email text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: password_reset_requests; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.password_reset_requests (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    full_name text NOT NULL,
    identifier text NOT NULL,
    user_type text NOT NULL,
    status text DEFAULT 'pending'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    resolved_at timestamp with time zone,
    CONSTRAINT password_reset_requests_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'resolved'::text]))),
    CONSTRAINT password_reset_requests_user_type_check CHECK ((user_type = ANY (ARRAY['student'::text, 'teacher'::text, 'supervisor'::text])))
);


--
-- Name: peer_ratings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.peer_ratings (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    group_id uuid NOT NULL,
    rater_student_id uuid NOT NULL,
    ratee_student_id uuid NOT NULL,
    rating integer NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT peer_ratings_rating_check CHECK (((rating >= 1) AND (rating <= 5)))
);


--
-- Name: platform_billing_settings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.platform_billing_settings (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    bank_name text,
    account_name text,
    account_number text,
    routing_or_swift text,
    instructions text,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: profiles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.profiles (
    id uuid NOT NULL,
    full_name text NOT NULL,
    role text NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    department_id uuid,
    first_name text,
    middle_name text,
    last_name text,
    student_id text,
    birth_date date,
    gender text,
    birth_year integer,
    grade_level integer,
    is_system_admin boolean DEFAULT false NOT NULL,
    active_login_token text,
    active_login_started_at timestamp with time zone,
    is_active boolean DEFAULT true NOT NULL,
    CONSTRAINT profiles_role_check CHECK ((role = ANY (ARRAY['student'::text, 'teacher'::text, 'supervisor'::text, 'admin'::text])))
);


--
-- Name: project_group_members; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.project_group_members (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    group_id uuid NOT NULL,
    student_id uuid NOT NULL
);


--
-- Name: project_groups; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.project_groups (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    draft_exam_id uuid NOT NULL,
    name text NOT NULL,
    file_submission_url text,
    file_submission_name text,
    file_uploaded_by uuid,
    file_uploaded_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: questions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.questions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    draft_exam_id uuid NOT NULL,
    created_by uuid NOT NULL,
    question_type text NOT NULL,
    question_text text NOT NULL,
    options jsonb,
    correct_answer text,
    points integer DEFAULT 1 NOT NULL,
    order_index integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    supervisor_comment text,
    is_bank_question boolean DEFAULT false NOT NULL,
    marking_points jsonb,
    total_marks integer,
    section_id uuid,
    image_url text,
    show_working boolean DEFAULT false,
    audio_url text,
    video_url text,
    CONSTRAINT questions_question_type_check CHECK ((question_type = ANY (ARRAY['multiple_choice'::text, 'true_false'::text, 'short_answer'::text, 'fill_blank'::text, 'essay'::text])))
);


--
-- Name: responses; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.responses (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    session_id uuid NOT NULL,
    question_id uuid NOT NULL,
    answer text,
    points_awarded numeric,
    graded_by uuid,
    graded_at timestamp with time zone,
    working text,
    integrity_signals jsonb
);


--
-- Name: school_requests; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.school_requests (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    school_name text NOT NULL,
    contact_name text NOT NULL,
    contact_email text NOT NULL,
    workflow_template text NOT NULL,
    feature_flags jsonb DEFAULT '[]'::jsonb NOT NULL,
    notes text,
    status text DEFAULT 'pending'::text NOT NULL,
    submitted_at timestamp with time zone DEFAULT now() NOT NULL,
    reviewed_at timestamp with time zone,
    reviewed_by uuid,
    workflow_other_description text,
    provisioned_at timestamp with time zone,
    portal_url text,
    CONSTRAINT school_requests_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'approved'::text, 'rejected'::text, 'provisioned'::text]))),
    CONSTRAINT school_requests_workflow_template_check CHECK ((workflow_template = ANY (ARRAY['direct_publish'::text, 'department_review'::text, 'full_review'::text, 'other'::text])))
);


--
-- Name: school_settings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.school_settings (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    logo_url text,
    updated_at timestamp with time zone DEFAULT now(),
    setup_token text
);


--
-- Name: school_subscriptions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.school_subscriptions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    school_request_id uuid,
    school_name text NOT NULL,
    contact_email text NOT NULL,
    subscription_status text DEFAULT 'inactive'::text NOT NULL,
    subscription_plan text,
    current_period_end timestamp with time zone,
    license_key text,
    approved_by uuid,
    approved_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT school_subscriptions_subscription_plan_check CHECK ((subscription_plan = ANY (ARRAY['3_month'::text, '6_month'::text, 'yearly'::text]))),
    CONSTRAINT school_subscriptions_subscription_status_check CHECK ((subscription_status = ANY (ARRAY['inactive'::text, 'active'::text, 'past_due'::text, 'canceled'::text])))
);


--
-- Name: self_mock_questions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.self_mock_questions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    self_mock_id uuid NOT NULL,
    question_id uuid NOT NULL,
    order_index integer NOT NULL,
    answer text,
    points_awarded numeric
);


--
-- Name: self_mocks; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.self_mocks (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    student_id uuid NOT NULL,
    subject text NOT NULL,
    question_count integer NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    completed_at timestamp with time zone,
    total_score numeric,
    max_possible_score numeric
);


--
-- Name: senior_team_lead_appointments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.senior_team_lead_appointments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    teacher_id uuid NOT NULL,
    department_id uuid NOT NULL,
    appointed_by uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    subject text,
    year_grade integer
);


--
-- Name: teacher_class_groups; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.teacher_class_groups (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    teacher_id uuid NOT NULL,
    class_group_id uuid NOT NULL
);


--
-- Name: teacher_subjects; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.teacher_subjects (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    teacher_id uuid NOT NULL,
    department_id uuid NOT NULL,
    subject text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: team_lead_appointments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.team_lead_appointments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    teacher_id uuid NOT NULL,
    department_id uuid NOT NULL,
    year_grade integer NOT NULL,
    subject text NOT NULL,
    appointed_by uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: ai_polish_usage ai_polish_usage_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_polish_usage
    ADD CONSTRAINT ai_polish_usage_pkey PRIMARY KEY (id);


--
-- Name: class_groups class_groups_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.class_groups
    ADD CONSTRAINT class_groups_pkey PRIMARY KEY (id);


--
-- Name: department_subjects department_subjects_department_id_subject_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.department_subjects
    ADD CONSTRAINT department_subjects_department_id_subject_key UNIQUE (department_id, subject);


--
-- Name: department_subjects department_subjects_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.department_subjects
    ADD CONSTRAINT department_subjects_pkey PRIMARY KEY (id);


--
-- Name: departments departments_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.departments
    ADD CONSTRAINT departments_name_key UNIQUE (name);


--
-- Name: departments departments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.departments
    ADD CONSTRAINT departments_pkey PRIMARY KEY (id);


--
-- Name: draft_exam_class_groups draft_exam_class_groups_draft_exam_id_class_group_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.draft_exam_class_groups
    ADD CONSTRAINT draft_exam_class_groups_draft_exam_id_class_group_id_key UNIQUE (draft_exam_id, class_group_id);


--
-- Name: draft_exam_class_groups draft_exam_class_groups_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.draft_exam_class_groups
    ADD CONSTRAINT draft_exam_class_groups_pkey PRIMARY KEY (id);


--
-- Name: draft_exams draft_exams_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.draft_exams
    ADD CONSTRAINT draft_exams_pkey PRIMARY KEY (id);


--
-- Name: enrollments enrollments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.enrollments
    ADD CONSTRAINT enrollments_pkey PRIMARY KEY (id);


--
-- Name: enrollments enrollments_student_id_class_group_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.enrollments
    ADD CONSTRAINT enrollments_student_id_class_group_id_key UNIQUE (student_id, class_group_id);


--
-- Name: exam_sections exam_sections_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.exam_sections
    ADD CONSTRAINT exam_sections_pkey PRIMARY KEY (id);


--
-- Name: exam_sessions exam_sessions_final_exam_id_student_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.exam_sessions
    ADD CONSTRAINT exam_sessions_final_exam_id_student_id_key UNIQUE (final_exam_id, student_id);


--
-- Name: exam_sessions exam_sessions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.exam_sessions
    ADD CONSTRAINT exam_sessions_pkey PRIMARY KEY (id);


--
-- Name: final_exam_class_groups final_exam_class_groups_final_exam_id_class_group_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.final_exam_class_groups
    ADD CONSTRAINT final_exam_class_groups_final_exam_id_class_group_id_key UNIQUE (final_exam_id, class_group_id);


--
-- Name: final_exam_class_groups final_exam_class_groups_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.final_exam_class_groups
    ADD CONSTRAINT final_exam_class_groups_pkey PRIMARY KEY (id);


--
-- Name: final_exam_questions final_exam_questions_final_exam_id_question_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.final_exam_questions
    ADD CONSTRAINT final_exam_questions_final_exam_id_question_id_key UNIQUE (final_exam_id, question_id);


--
-- Name: final_exam_questions final_exam_questions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.final_exam_questions
    ADD CONSTRAINT final_exam_questions_pkey PRIMARY KEY (id);


--
-- Name: final_exams final_exams_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.final_exams
    ADD CONSTRAINT final_exams_pkey PRIMARY KEY (id);


--
-- Name: marking_point_responses marking_point_responses_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.marking_point_responses
    ADD CONSTRAINT marking_point_responses_pkey PRIMARY KEY (id);


--
-- Name: org_exam_questions org_exam_questions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.org_exam_questions
    ADD CONSTRAINT org_exam_questions_pkey PRIMARY KEY (id);


--
-- Name: org_exam_responses org_exam_responses_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.org_exam_responses
    ADD CONSTRAINT org_exam_responses_pkey PRIMARY KEY (session_id, question_id);


--
-- Name: org_exam_sessions org_exam_sessions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.org_exam_sessions
    ADD CONSTRAINT org_exam_sessions_pkey PRIMARY KEY (id);


--
-- Name: org_exams org_exams_exam_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.org_exams
    ADD CONSTRAINT org_exams_exam_code_key UNIQUE (exam_code);


--
-- Name: org_exams org_exams_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.org_exams
    ADD CONSTRAINT org_exams_pkey PRIMARY KEY (id);


--
-- Name: org_respondent_field_values org_respondent_field_values_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.org_respondent_field_values
    ADD CONSTRAINT org_respondent_field_values_pkey PRIMARY KEY (session_id, field_id);


--
-- Name: org_respondent_fields org_respondent_fields_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.org_respondent_fields
    ADD CONSTRAINT org_respondent_fields_pkey PRIMARY KEY (id);


--
-- Name: organization_payments organization_payments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.organization_payments
    ADD CONSTRAINT organization_payments_pkey PRIMARY KEY (id);


--
-- Name: organization_subscriptions organization_subscriptions_license_key_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.organization_subscriptions
    ADD CONSTRAINT organization_subscriptions_license_key_key UNIQUE (license_key);


--
-- Name: organization_subscriptions organization_subscriptions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.organization_subscriptions
    ADD CONSTRAINT organization_subscriptions_pkey PRIMARY KEY (organization_id);


--
-- Name: organizations organizations_auth_user_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.organizations
    ADD CONSTRAINT organizations_auth_user_id_key UNIQUE (auth_user_id);


--
-- Name: organizations organizations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.organizations
    ADD CONSTRAINT organizations_pkey PRIMARY KEY (id);


--
-- Name: password_reset_requests password_reset_requests_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.password_reset_requests
    ADD CONSTRAINT password_reset_requests_pkey PRIMARY KEY (id);


--
-- Name: peer_ratings peer_ratings_group_id_rater_student_id_ratee_student_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.peer_ratings
    ADD CONSTRAINT peer_ratings_group_id_rater_student_id_ratee_student_id_key UNIQUE (group_id, rater_student_id, ratee_student_id);


--
-- Name: peer_ratings peer_ratings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.peer_ratings
    ADD CONSTRAINT peer_ratings_pkey PRIMARY KEY (id);


--
-- Name: platform_billing_settings platform_billing_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.platform_billing_settings
    ADD CONSTRAINT platform_billing_settings_pkey PRIMARY KEY (id);


--
-- Name: profiles profiles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_pkey PRIMARY KEY (id);


--
-- Name: profiles profiles_student_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_student_id_key UNIQUE (student_id);


--
-- Name: project_group_members project_group_members_group_id_student_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.project_group_members
    ADD CONSTRAINT project_group_members_group_id_student_id_key UNIQUE (group_id, student_id);


--
-- Name: project_group_members project_group_members_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.project_group_members
    ADD CONSTRAINT project_group_members_pkey PRIMARY KEY (id);


--
-- Name: project_groups project_groups_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.project_groups
    ADD CONSTRAINT project_groups_pkey PRIMARY KEY (id);


--
-- Name: questions questions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.questions
    ADD CONSTRAINT questions_pkey PRIMARY KEY (id);


--
-- Name: responses responses_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.responses
    ADD CONSTRAINT responses_pkey PRIMARY KEY (id);


--
-- Name: responses responses_session_id_question_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.responses
    ADD CONSTRAINT responses_session_id_question_id_key UNIQUE (session_id, question_id);


--
-- Name: school_requests school_requests_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.school_requests
    ADD CONSTRAINT school_requests_pkey PRIMARY KEY (id);


--
-- Name: school_settings school_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.school_settings
    ADD CONSTRAINT school_settings_pkey PRIMARY KEY (id);


--
-- Name: school_subscriptions school_subscriptions_license_key_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.school_subscriptions
    ADD CONSTRAINT school_subscriptions_license_key_key UNIQUE (license_key);


--
-- Name: school_subscriptions school_subscriptions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.school_subscriptions
    ADD CONSTRAINT school_subscriptions_pkey PRIMARY KEY (id);


--
-- Name: self_mock_questions self_mock_questions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.self_mock_questions
    ADD CONSTRAINT self_mock_questions_pkey PRIMARY KEY (id);


--
-- Name: self_mocks self_mocks_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.self_mocks
    ADD CONSTRAINT self_mocks_pkey PRIMARY KEY (id);


--
-- Name: senior_team_lead_appointments senior_team_lead_appointments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.senior_team_lead_appointments
    ADD CONSTRAINT senior_team_lead_appointments_pkey PRIMARY KEY (id);


--
-- Name: senior_team_lead_appointments senior_team_lead_appointments_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.senior_team_lead_appointments
    ADD CONSTRAINT senior_team_lead_appointments_unique UNIQUE (teacher_id, department_id, subject);


--
-- Name: teacher_class_groups teacher_class_groups_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.teacher_class_groups
    ADD CONSTRAINT teacher_class_groups_pkey PRIMARY KEY (id);


--
-- Name: teacher_class_groups teacher_class_groups_teacher_id_class_group_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.teacher_class_groups
    ADD CONSTRAINT teacher_class_groups_teacher_id_class_group_id_key UNIQUE (teacher_id, class_group_id);


--
-- Name: teacher_subjects teacher_subjects_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.teacher_subjects
    ADD CONSTRAINT teacher_subjects_pkey PRIMARY KEY (id);


--
-- Name: teacher_subjects teacher_subjects_teacher_id_subject_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.teacher_subjects
    ADD CONSTRAINT teacher_subjects_teacher_id_subject_key UNIQUE (teacher_id, subject);


--
-- Name: team_lead_appointments team_lead_appointments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.team_lead_appointments
    ADD CONSTRAINT team_lead_appointments_pkey PRIMARY KEY (id);


--
-- Name: team_lead_appointments team_lead_appointments_teacher_id_year_grade_subject_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.team_lead_appointments
    ADD CONSTRAINT team_lead_appointments_teacher_id_year_grade_subject_key UNIQUE (teacher_id, year_grade, subject);


--
-- Name: org_exam_questions_org_exam_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX org_exam_questions_org_exam_id_idx ON public.org_exam_questions USING btree (org_exam_id);


--
-- Name: org_exam_sessions_auth_user_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX org_exam_sessions_auth_user_id_idx ON public.org_exam_sessions USING btree (auth_user_id);


--
-- Name: org_exam_sessions_org_exam_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX org_exam_sessions_org_exam_id_idx ON public.org_exam_sessions USING btree (org_exam_id);


--
-- Name: org_exam_sessions_submitted_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX org_exam_sessions_submitted_at_idx ON public.org_exam_sessions USING btree (submitted_at);


--
-- Name: org_exams_organization_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX org_exams_organization_id_idx ON public.org_exams USING btree (organization_id);


--
-- Name: org_respondent_fields_org_exam_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX org_respondent_fields_org_exam_id_idx ON public.org_respondent_fields USING btree (org_exam_id);


--
-- Name: organization_payments_organization_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX organization_payments_organization_id_idx ON public.organization_payments USING btree (organization_id);


--
-- Name: profiles_student_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX profiles_student_id_idx ON public.profiles USING btree (student_id);


--
-- Name: school_subscriptions_school_request_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX school_subscriptions_school_request_id_idx ON public.school_subscriptions USING btree (school_request_id);


--
-- Name: ai_polish_usage ai_polish_usage_teacher_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_polish_usage
    ADD CONSTRAINT ai_polish_usage_teacher_id_fkey FOREIGN KEY (teacher_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: class_groups class_groups_department_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.class_groups
    ADD CONSTRAINT class_groups_department_id_fkey FOREIGN KEY (department_id) REFERENCES public.departments(id);


--
-- Name: department_subjects department_subjects_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.department_subjects
    ADD CONSTRAINT department_subjects_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.profiles(id);


--
-- Name: department_subjects department_subjects_department_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.department_subjects
    ADD CONSTRAINT department_subjects_department_id_fkey FOREIGN KEY (department_id) REFERENCES public.departments(id) ON DELETE CASCADE;


--
-- Name: departments departments_head_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.departments
    ADD CONSTRAINT departments_head_id_fkey FOREIGN KEY (head_id) REFERENCES public.profiles(id);


--
-- Name: draft_exam_class_groups draft_exam_class_groups_class_group_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.draft_exam_class_groups
    ADD CONSTRAINT draft_exam_class_groups_class_group_id_fkey FOREIGN KEY (class_group_id) REFERENCES public.class_groups(id);


--
-- Name: draft_exam_class_groups draft_exam_class_groups_draft_exam_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.draft_exam_class_groups
    ADD CONSTRAINT draft_exam_class_groups_draft_exam_id_fkey FOREIGN KEY (draft_exam_id) REFERENCES public.draft_exams(id);


--
-- Name: draft_exams draft_exams_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.draft_exams
    ADD CONSTRAINT draft_exams_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.profiles(id);


--
-- Name: draft_exams draft_exams_department_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.draft_exams
    ADD CONSTRAINT draft_exams_department_id_fkey FOREIGN KEY (department_id) REFERENCES public.departments(id);


--
-- Name: draft_exams draft_exams_published_final_exam_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.draft_exams
    ADD CONSTRAINT draft_exams_published_final_exam_id_fkey FOREIGN KEY (published_final_exam_id) REFERENCES public.final_exams(id);


--
-- Name: draft_exams draft_exams_reviewed_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.draft_exams
    ADD CONSTRAINT draft_exams_reviewed_by_fkey FOREIGN KEY (reviewed_by) REFERENCES public.profiles(id);


--
-- Name: enrollments enrollments_class_group_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.enrollments
    ADD CONSTRAINT enrollments_class_group_id_fkey FOREIGN KEY (class_group_id) REFERENCES public.class_groups(id);


--
-- Name: enrollments enrollments_student_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.enrollments
    ADD CONSTRAINT enrollments_student_id_fkey FOREIGN KEY (student_id) REFERENCES public.profiles(id);


--
-- Name: exam_sections exam_sections_draft_exam_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.exam_sections
    ADD CONSTRAINT exam_sections_draft_exam_id_fkey FOREIGN KEY (draft_exam_id) REFERENCES public.draft_exams(id);


--
-- Name: exam_sections exam_sections_final_exam_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.exam_sections
    ADD CONSTRAINT exam_sections_final_exam_id_fkey FOREIGN KEY (final_exam_id) REFERENCES public.final_exams(id);


--
-- Name: exam_sessions exam_sessions_assigned_teacher_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.exam_sessions
    ADD CONSTRAINT exam_sessions_assigned_teacher_id_fkey FOREIGN KEY (assigned_teacher_id) REFERENCES public.profiles(id);


--
-- Name: exam_sessions exam_sessions_draft_exam_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.exam_sessions
    ADD CONSTRAINT exam_sessions_draft_exam_id_fkey FOREIGN KEY (draft_exam_id) REFERENCES public.draft_exams(id);


--
-- Name: exam_sessions exam_sessions_final_exam_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.exam_sessions
    ADD CONSTRAINT exam_sessions_final_exam_id_fkey FOREIGN KEY (final_exam_id) REFERENCES public.final_exams(id);


--
-- Name: exam_sessions exam_sessions_group_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.exam_sessions
    ADD CONSTRAINT exam_sessions_group_id_fkey FOREIGN KEY (group_id) REFERENCES public.project_groups(id);


--
-- Name: exam_sessions exam_sessions_student_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.exam_sessions
    ADD CONSTRAINT exam_sessions_student_id_fkey FOREIGN KEY (student_id) REFERENCES public.profiles(id);


--
-- Name: final_exam_class_groups final_exam_class_groups_class_group_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.final_exam_class_groups
    ADD CONSTRAINT final_exam_class_groups_class_group_id_fkey FOREIGN KEY (class_group_id) REFERENCES public.class_groups(id);


--
-- Name: final_exam_class_groups final_exam_class_groups_final_exam_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.final_exam_class_groups
    ADD CONSTRAINT final_exam_class_groups_final_exam_id_fkey FOREIGN KEY (final_exam_id) REFERENCES public.final_exams(id);


--
-- Name: final_exam_questions final_exam_questions_final_exam_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.final_exam_questions
    ADD CONSTRAINT final_exam_questions_final_exam_id_fkey FOREIGN KEY (final_exam_id) REFERENCES public.final_exams(id);


--
-- Name: final_exam_questions final_exam_questions_question_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.final_exam_questions
    ADD CONSTRAINT final_exam_questions_question_id_fkey FOREIGN KEY (question_id) REFERENCES public.questions(id);


--
-- Name: final_exam_questions final_exam_questions_section_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.final_exam_questions
    ADD CONSTRAINT final_exam_questions_section_id_fkey FOREIGN KEY (section_id) REFERENCES public.exam_sections(id);


--
-- Name: final_exams final_exams_class_group_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.final_exams
    ADD CONSTRAINT final_exams_class_group_id_fkey FOREIGN KEY (class_group_id) REFERENCES public.class_groups(id);


--
-- Name: final_exams final_exams_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.final_exams
    ADD CONSTRAINT final_exams_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.profiles(id);


--
-- Name: final_exams final_exams_department_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.final_exams
    ADD CONSTRAINT final_exams_department_id_fkey FOREIGN KEY (department_id) REFERENCES public.departments(id);


--
-- Name: marking_point_responses marking_point_responses_graded_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.marking_point_responses
    ADD CONSTRAINT marking_point_responses_graded_by_fkey FOREIGN KEY (graded_by) REFERENCES public.profiles(id);


--
-- Name: marking_point_responses marking_point_responses_response_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.marking_point_responses
    ADD CONSTRAINT marking_point_responses_response_id_fkey FOREIGN KEY (response_id) REFERENCES public.responses(id);


--
-- Name: org_exam_questions org_exam_questions_org_exam_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.org_exam_questions
    ADD CONSTRAINT org_exam_questions_org_exam_id_fkey FOREIGN KEY (org_exam_id) REFERENCES public.org_exams(id) ON DELETE CASCADE;


--
-- Name: org_exam_responses org_exam_responses_question_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.org_exam_responses
    ADD CONSTRAINT org_exam_responses_question_id_fkey FOREIGN KEY (question_id) REFERENCES public.org_exam_questions(id) ON DELETE CASCADE;


--
-- Name: org_exam_responses org_exam_responses_session_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.org_exam_responses
    ADD CONSTRAINT org_exam_responses_session_id_fkey FOREIGN KEY (session_id) REFERENCES public.org_exam_sessions(id) ON DELETE CASCADE;


--
-- Name: org_exam_sessions org_exam_sessions_auth_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.org_exam_sessions
    ADD CONSTRAINT org_exam_sessions_auth_user_id_fkey FOREIGN KEY (auth_user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: org_exam_sessions org_exam_sessions_org_exam_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.org_exam_sessions
    ADD CONSTRAINT org_exam_sessions_org_exam_id_fkey FOREIGN KEY (org_exam_id) REFERENCES public.org_exams(id) ON DELETE CASCADE;


--
-- Name: org_exams org_exams_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.org_exams
    ADD CONSTRAINT org_exams_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: org_respondent_field_values org_respondent_field_values_field_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.org_respondent_field_values
    ADD CONSTRAINT org_respondent_field_values_field_id_fkey FOREIGN KEY (field_id) REFERENCES public.org_respondent_fields(id) ON DELETE CASCADE;


--
-- Name: org_respondent_field_values org_respondent_field_values_session_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.org_respondent_field_values
    ADD CONSTRAINT org_respondent_field_values_session_id_fkey FOREIGN KEY (session_id) REFERENCES public.org_exam_sessions(id) ON DELETE CASCADE;


--
-- Name: org_respondent_fields org_respondent_fields_org_exam_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.org_respondent_fields
    ADD CONSTRAINT org_respondent_fields_org_exam_id_fkey FOREIGN KEY (org_exam_id) REFERENCES public.org_exams(id) ON DELETE CASCADE;


--
-- Name: organization_payments organization_payments_confirmed_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.organization_payments
    ADD CONSTRAINT organization_payments_confirmed_by_fkey FOREIGN KEY (confirmed_by) REFERENCES auth.users(id);


--
-- Name: organization_payments organization_payments_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.organization_payments
    ADD CONSTRAINT organization_payments_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: organization_subscriptions organization_subscriptions_approved_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.organization_subscriptions
    ADD CONSTRAINT organization_subscriptions_approved_by_fkey FOREIGN KEY (approved_by) REFERENCES auth.users(id);


--
-- Name: organization_subscriptions organization_subscriptions_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.organization_subscriptions
    ADD CONSTRAINT organization_subscriptions_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: organizations organizations_auth_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.organizations
    ADD CONSTRAINT organizations_auth_user_id_fkey FOREIGN KEY (auth_user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: peer_ratings peer_ratings_group_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.peer_ratings
    ADD CONSTRAINT peer_ratings_group_id_fkey FOREIGN KEY (group_id) REFERENCES public.project_groups(id) ON DELETE CASCADE;


--
-- Name: peer_ratings peer_ratings_ratee_student_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.peer_ratings
    ADD CONSTRAINT peer_ratings_ratee_student_id_fkey FOREIGN KEY (ratee_student_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: peer_ratings peer_ratings_rater_student_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.peer_ratings
    ADD CONSTRAINT peer_ratings_rater_student_id_fkey FOREIGN KEY (rater_student_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: profiles profiles_department_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_department_id_fkey FOREIGN KEY (department_id) REFERENCES public.departments(id);


--
-- Name: profiles profiles_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id);


--
-- Name: project_group_members project_group_members_group_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.project_group_members
    ADD CONSTRAINT project_group_members_group_id_fkey FOREIGN KEY (group_id) REFERENCES public.project_groups(id) ON DELETE CASCADE;


--
-- Name: project_group_members project_group_members_student_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.project_group_members
    ADD CONSTRAINT project_group_members_student_id_fkey FOREIGN KEY (student_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: project_groups project_groups_draft_exam_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.project_groups
    ADD CONSTRAINT project_groups_draft_exam_id_fkey FOREIGN KEY (draft_exam_id) REFERENCES public.draft_exams(id) ON DELETE CASCADE;


--
-- Name: project_groups project_groups_file_uploaded_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.project_groups
    ADD CONSTRAINT project_groups_file_uploaded_by_fkey FOREIGN KEY (file_uploaded_by) REFERENCES public.profiles(id);


--
-- Name: questions questions_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.questions
    ADD CONSTRAINT questions_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.profiles(id);


--
-- Name: questions questions_draft_exam_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.questions
    ADD CONSTRAINT questions_draft_exam_id_fkey FOREIGN KEY (draft_exam_id) REFERENCES public.draft_exams(id);


--
-- Name: questions questions_section_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.questions
    ADD CONSTRAINT questions_section_id_fkey FOREIGN KEY (section_id) REFERENCES public.exam_sections(id);


--
-- Name: responses responses_graded_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.responses
    ADD CONSTRAINT responses_graded_by_fkey FOREIGN KEY (graded_by) REFERENCES public.profiles(id);


--
-- Name: responses responses_question_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.responses
    ADD CONSTRAINT responses_question_id_fkey FOREIGN KEY (question_id) REFERENCES public.questions(id);


--
-- Name: responses responses_session_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.responses
    ADD CONSTRAINT responses_session_id_fkey FOREIGN KEY (session_id) REFERENCES public.exam_sessions(id);


--
-- Name: school_requests school_requests_reviewed_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.school_requests
    ADD CONSTRAINT school_requests_reviewed_by_fkey FOREIGN KEY (reviewed_by) REFERENCES auth.users(id);


--
-- Name: school_subscriptions school_subscriptions_approved_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.school_subscriptions
    ADD CONSTRAINT school_subscriptions_approved_by_fkey FOREIGN KEY (approved_by) REFERENCES auth.users(id);


--
-- Name: school_subscriptions school_subscriptions_school_request_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.school_subscriptions
    ADD CONSTRAINT school_subscriptions_school_request_id_fkey FOREIGN KEY (school_request_id) REFERENCES public.school_requests(id) ON DELETE SET NULL;


--
-- Name: self_mock_questions self_mock_questions_question_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.self_mock_questions
    ADD CONSTRAINT self_mock_questions_question_id_fkey FOREIGN KEY (question_id) REFERENCES public.questions(id);


--
-- Name: self_mock_questions self_mock_questions_self_mock_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.self_mock_questions
    ADD CONSTRAINT self_mock_questions_self_mock_id_fkey FOREIGN KEY (self_mock_id) REFERENCES public.self_mocks(id);


--
-- Name: self_mocks self_mocks_student_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.self_mocks
    ADD CONSTRAINT self_mocks_student_id_fkey FOREIGN KEY (student_id) REFERENCES public.profiles(id);


--
-- Name: senior_team_lead_appointments senior_team_lead_appointments_appointed_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.senior_team_lead_appointments
    ADD CONSTRAINT senior_team_lead_appointments_appointed_by_fkey FOREIGN KEY (appointed_by) REFERENCES public.profiles(id);


--
-- Name: senior_team_lead_appointments senior_team_lead_appointments_department_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.senior_team_lead_appointments
    ADD CONSTRAINT senior_team_lead_appointments_department_id_fkey FOREIGN KEY (department_id) REFERENCES public.departments(id);


--
-- Name: senior_team_lead_appointments senior_team_lead_appointments_teacher_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.senior_team_lead_appointments
    ADD CONSTRAINT senior_team_lead_appointments_teacher_id_fkey FOREIGN KEY (teacher_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: teacher_class_groups teacher_class_groups_class_group_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.teacher_class_groups
    ADD CONSTRAINT teacher_class_groups_class_group_id_fkey FOREIGN KEY (class_group_id) REFERENCES public.class_groups(id) ON DELETE CASCADE;


--
-- Name: teacher_class_groups teacher_class_groups_teacher_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.teacher_class_groups
    ADD CONSTRAINT teacher_class_groups_teacher_id_fkey FOREIGN KEY (teacher_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: teacher_subjects teacher_subjects_department_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.teacher_subjects
    ADD CONSTRAINT teacher_subjects_department_id_fkey FOREIGN KEY (department_id) REFERENCES public.departments(id) ON DELETE CASCADE;


--
-- Name: teacher_subjects teacher_subjects_teacher_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.teacher_subjects
    ADD CONSTRAINT teacher_subjects_teacher_id_fkey FOREIGN KEY (teacher_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: team_lead_appointments team_lead_appointments_appointed_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.team_lead_appointments
    ADD CONSTRAINT team_lead_appointments_appointed_by_fkey FOREIGN KEY (appointed_by) REFERENCES public.profiles(id);


--
-- Name: team_lead_appointments team_lead_appointments_department_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.team_lead_appointments
    ADD CONSTRAINT team_lead_appointments_department_id_fkey FOREIGN KEY (department_id) REFERENCES public.departments(id);


--
-- Name: team_lead_appointments team_lead_appointments_teacher_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.team_lead_appointments
    ADD CONSTRAINT team_lead_appointments_teacher_id_fkey FOREIGN KEY (teacher_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: profiles Admins and system admins can update profiles; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins and system admins can update profiles" ON public.profiles FOR UPDATE USING ((public.is_admin() OR ((((auth.jwt() -> 'app_metadata'::text) ->> 'is_system_admin'::text))::boolean = true))) WITH CHECK ((public.is_admin() OR ((((auth.jwt() -> 'app_metadata'::text) ->> 'is_system_admin'::text))::boolean = true)));


--
-- Name: departments Admins and system admins manage departments; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins and system admins manage departments" ON public.departments USING ((public.is_admin() OR ((((auth.jwt() -> 'app_metadata'::text) ->> 'is_system_admin'::text))::boolean = true))) WITH CHECK ((public.is_admin() OR ((((auth.jwt() -> 'app_metadata'::text) ->> 'is_system_admin'::text))::boolean = true)));


--
-- Name: profiles Admins can insert profiles; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can insert profiles" ON public.profiles FOR INSERT WITH CHECK (true);


--
-- Name: school_settings Admins can update school settings; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can update school settings" ON public.school_settings FOR UPDATE USING ((public.is_admin() OR ((((auth.jwt() -> 'app_metadata'::text) ->> 'is_system_admin'::text))::boolean = true)));


--
-- Name: department_subjects Admins manage all department subjects; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins manage all department subjects" ON public.department_subjects USING ((public.is_admin() OR ((((auth.jwt() -> 'app_metadata'::text) ->> 'is_system_admin'::text))::boolean = true))) WITH CHECK ((public.is_admin() OR ((((auth.jwt() -> 'app_metadata'::text) ->> 'is_system_admin'::text))::boolean = true)));


--
-- Name: teacher_subjects Admins manage all teacher subjects; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins manage all teacher subjects" ON public.teacher_subjects USING ((public.is_admin() OR ((((auth.jwt() -> 'app_metadata'::text) ->> 'is_system_admin'::text))::boolean = true))) WITH CHECK ((public.is_admin() OR ((((auth.jwt() -> 'app_metadata'::text) ->> 'is_system_admin'::text))::boolean = true)));


--
-- Name: password_reset_requests Admins update password reset requests; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins update password reset requests" ON public.password_reset_requests FOR UPDATE USING ((public.is_admin() OR ((((auth.jwt() -> 'app_metadata'::text) ->> 'is_system_admin'::text))::boolean = true)));


--
-- Name: password_reset_requests Admins view password reset requests; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins view password reset requests" ON public.password_reset_requests FOR SELECT USING ((public.is_admin() OR ((((auth.jwt() -> 'app_metadata'::text) ->> 'is_system_admin'::text))::boolean = true)));


--
-- Name: departments All authenticated users can view departments; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "All authenticated users can view departments" ON public.departments FOR SELECT USING ((auth.role() = 'authenticated'::text));


--
-- Name: password_reset_requests Anyone can submit a password reset request; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Anyone can submit a password reset request" ON public.password_reset_requests FOR INSERT TO authenticated, anon WITH CHECK (true);


--
-- Name: school_settings Everyone can view school settings; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Everyone can view school settings" ON public.school_settings FOR SELECT USING (true);


--
-- Name: department_subjects HOD manages their department subjects; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "HOD manages their department subjects" ON public.department_subjects USING (((department_id = public.my_supervised_department()) OR public.is_admin())) WITH CHECK (((department_id = public.my_supervised_department()) OR public.is_admin()));


--
-- Name: questions Senior team leads can view questions for exams under review; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Senior team leads can view questions for exams under review" ON public.questions FOR SELECT USING ((EXISTS ( SELECT 1
   FROM (public.draft_exams d
     JOIN public.senior_team_lead_appointments stla ON (((stla.subject = d.subject) AND ((stla.year_grade IS NULL) OR (stla.year_grade = d.target_grade)))))
  WHERE ((d.id = questions.draft_exam_id) AND (stla.teacher_id = auth.uid()) AND (d.status = 'submitted'::text)))));


--
-- Name: draft_exams Senior team leads can view submitted exams for review; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Senior team leads can view submitted exams for review" ON public.draft_exams FOR SELECT USING (((status = 'submitted'::text) AND (EXISTS ( SELECT 1
   FROM public.senior_team_lead_appointments stla
  WHERE ((stla.teacher_id = auth.uid()) AND (stla.subject = draft_exams.subject) AND ((stla.year_grade IS NULL) OR (stla.year_grade = draft_exams.target_grade)))))));


--
-- Name: exam_sections Senior team leads view sections for exams under review; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Senior team leads view sections for exams under review" ON public.exam_sections FOR SELECT USING ((EXISTS ( SELECT 1
   FROM (public.draft_exams d
     JOIN public.senior_team_lead_appointments stla ON (((stla.subject = d.subject) AND ((stla.year_grade IS NULL) OR (stla.year_grade = d.target_grade)))))
  WHERE ((d.id = exam_sections.draft_exam_id) AND (stla.teacher_id = auth.uid()) AND (d.status = 'submitted'::text)))));


--
-- Name: exam_sessions Students manage own exam sessions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Students manage own exam sessions" ON public.exam_sessions USING ((student_id = auth.uid())) WITH CHECK ((student_id = auth.uid()));


--
-- Name: responses Students manage own responses; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Students manage own responses" ON public.responses USING ((EXISTS ( SELECT 1
   FROM public.exam_sessions
  WHERE ((exam_sessions.id = responses.session_id) AND (exam_sessions.student_id = auth.uid()))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM public.exam_sessions
  WHERE ((exam_sessions.id = responses.session_id) AND (exam_sessions.student_id = auth.uid())))));


--
-- Name: self_mock_questions Students manage own self mock questions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Students manage own self mock questions" ON public.self_mock_questions USING ((EXISTS ( SELECT 1
   FROM public.self_mocks
  WHERE ((self_mocks.id = self_mock_questions.self_mock_id) AND (self_mocks.student_id = auth.uid())))));


--
-- Name: self_mocks Students manage own self mocks; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Students manage own self mocks" ON public.self_mocks USING ((student_id = auth.uid())) WITH CHECK ((student_id = auth.uid()));


--
-- Name: peer_ratings Students manage their own peer ratings; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Students manage their own peer ratings" ON public.peer_ratings USING ((rater_student_id = auth.uid())) WITH CHECK ((rater_student_id = auth.uid()));


--
-- Name: questions Students sample only from exams they've completed; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Students sample only from exams they've completed" ON public.questions FOR SELECT USING (((question_type <> 'essay'::text) AND (EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'student'::text)))) AND public.student_completed_question_exam(id)));


--
-- Name: project_groups Students upload shared file to their own group; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Students upload shared file to their own group" ON public.project_groups FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM public.project_group_members m
  WHERE ((m.group_id = project_groups.id) AND (m.student_id = auth.uid()))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM public.project_group_members m
  WHERE ((m.group_id = project_groups.id) AND (m.student_id = auth.uid())))));


--
-- Name: draft_exam_class_groups Students view class group links for published direct exams; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Students view class group links for published direct exams" ON public.draft_exam_class_groups FOR SELECT USING (public.is_direct_published(draft_exam_id));


--
-- Name: final_exam_class_groups Students view final exam class group links for their exams; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Students view final exam class group links for their exams" ON public.final_exam_class_groups FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.enrollments
  WHERE ((enrollments.class_group_id = final_exam_class_groups.class_group_id) AND (enrollments.student_id = auth.uid())))));


--
-- Name: project_group_members Students view members of their own group; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Students view members of their own group" ON public.project_group_members FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.project_group_members m2
  WHERE ((m2.group_id = project_group_members.group_id) AND (m2.student_id = auth.uid())))));


--
-- Name: class_groups Students view own class groups; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Students view own class groups" ON public.class_groups FOR SELECT USING (public.is_enrolled_in(id));


--
-- Name: enrollments Students view own enrollments; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Students view own enrollments" ON public.enrollments FOR SELECT USING ((student_id = auth.uid()));


--
-- Name: marking_point_responses Students view own marking point responses; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Students view own marking point responses" ON public.marking_point_responses FOR SELECT USING ((EXISTS ( SELECT 1
   FROM (public.responses r
     JOIN public.exam_sessions s ON ((s.id = r.session_id)))
  WHERE ((r.id = marking_point_responses.response_id) AND (s.student_id = auth.uid())))));


--
-- Name: draft_exams Students view published direct exams for their classes; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Students view published direct exams for their classes" ON public.draft_exams FOR SELECT USING (((direct_published = true) AND (EXISTS ( SELECT 1
   FROM (public.draft_exam_class_groups dcg
     JOIN public.enrollments e ON ((e.class_group_id = dcg.class_group_id)))
  WHERE ((dcg.draft_exam_id = draft_exams.id) AND (e.student_id = auth.uid()))))));


--
-- Name: final_exams Students view published exams for their enrolled classes; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Students view published exams for their enrolled classes" ON public.final_exams FOR SELECT USING (((status = 'published'::text) AND public.student_can_see_final_exam(id)));


--
-- Name: final_exam_questions Students view questions for their enrolled exams; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Students view questions for their enrolled exams" ON public.final_exam_questions FOR SELECT USING ((EXISTS ( SELECT 1
   FROM ((public.final_exams fe
     JOIN public.final_exam_class_groups fecg ON ((fecg.final_exam_id = fe.id)))
     JOIN public.enrollments e ON ((e.class_group_id = fecg.class_group_id)))
  WHERE ((fe.id = final_exam_questions.final_exam_id) AND (fe.status = 'published'::text) AND (e.student_id = auth.uid())))));


--
-- Name: questions Students view questions for their enrolled exams; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Students view questions for their enrolled exams" ON public.questions FOR SELECT USING (((EXISTS ( SELECT 1
   FROM ((public.final_exam_questions feq
     JOIN public.final_exam_class_groups fecg ON ((fecg.final_exam_id = feq.final_exam_id)))
     JOIN public.enrollments e ON ((e.class_group_id = fecg.class_group_id)))
  WHERE ((feq.question_id = questions.id) AND (e.student_id = auth.uid())))) OR (EXISTS ( SELECT 1
   FROM ((public.draft_exams d
     JOIN public.draft_exam_class_groups dcg ON ((dcg.draft_exam_id = d.id)))
     JOIN public.enrollments e ON ((e.class_group_id = dcg.class_group_id)))
  WHERE ((d.id = questions.draft_exam_id) AND (d.direct_published = true) AND (e.student_id = auth.uid()))))));


--
-- Name: exam_sections Students view sections for their exams; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Students view sections for their exams" ON public.exam_sections FOR SELECT USING (((draft_exam_id IN ( SELECT draft_exams.id
   FROM public.draft_exams
  WHERE (draft_exams.direct_published = true))) OR (final_exam_id IN ( SELECT final_exams.id
   FROM public.final_exams
  WHERE (final_exams.status = 'published'::text)))));


--
-- Name: profiles Students view teacher names; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Students view teacher names" ON public.profiles FOR SELECT USING (((role = 'teacher'::text) AND (public.my_role() = 'student'::text)));


--
-- Name: teacher_subjects Students view teacher subjects to pick their grader; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Students view teacher subjects to pick their grader" ON public.teacher_subjects FOR SELECT USING ((public.my_role() = 'student'::text));


--
-- Name: teacher_class_groups Students view teachers in their class; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Students view teachers in their class" ON public.teacher_class_groups FOR SELECT USING ((class_group_id IN ( SELECT public.my_class_group_ids() AS my_class_group_ids)));


--
-- Name: project_groups Students view their own group; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Students view their own group" ON public.project_groups FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.project_group_members m
  WHERE ((m.group_id = project_groups.id) AND (m.student_id = auth.uid())))));


--
-- Name: profiles Students view their teachers profiles; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Students view their teachers profiles" ON public.profiles FOR SELECT USING ((id IN ( SELECT public.my_teacher_ids() AS my_teacher_ids)));


--
-- Name: draft_exams Supervisors and system admins view drafts; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Supervisors and system admins view drafts" ON public.draft_exams FOR SELECT USING (((department_id = public.my_supervised_department()) OR public.is_admin() OR ((((auth.jwt() -> 'app_metadata'::text) ->> 'is_system_admin'::text))::boolean = true)));


--
-- Name: teacher_class_groups Supervisors assign own department teachers to classes; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Supervisors assign own department teachers to classes" ON public.teacher_class_groups FOR INSERT WITH CHECK (((EXISTS ( SELECT 1
   FROM public.teacher_subjects ts
  WHERE ((ts.teacher_id = teacher_class_groups.teacher_id) AND (ts.department_id = public.my_supervised_department())))) OR (EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = teacher_class_groups.teacher_id) AND (profiles.department_id = public.my_supervised_department()))))));


--
-- Name: teacher_class_groups Supervisors delete own class assignments; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Supervisors delete own class assignments" ON public.teacher_class_groups FOR DELETE USING (((teacher_id = auth.uid()) OR public.is_admin()));


--
-- Name: enrollments Supervisors manage enrollments in own department; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Supervisors manage enrollments in own department" ON public.enrollments USING ((EXISTS ( SELECT 1
   FROM public.class_groups
  WHERE ((class_groups.id = enrollments.class_group_id) AND ((class_groups.department_id = public.my_supervised_department()) OR public.is_admin())))));


--
-- Name: final_exam_class_groups Supervisors manage final exam class group links; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Supervisors manage final exam class group links" ON public.final_exam_class_groups USING ((EXISTS ( SELECT 1
   FROM public.final_exams
  WHERE ((final_exams.id = final_exam_class_groups.final_exam_id) AND ((final_exams.department_id = public.my_supervised_department()) OR public.is_admin())))));


--
-- Name: teacher_class_groups Supervisors manage own class assignments; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Supervisors manage own class assignments" ON public.teacher_class_groups FOR INSERT WITH CHECK (((teacher_id = auth.uid()) OR public.is_admin()));


--
-- Name: class_groups Supervisors manage own department class groups; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Supervisors manage own department class groups" ON public.class_groups USING (((department_id = public.my_supervised_department()) OR public.is_admin())) WITH CHECK (((department_id = public.my_supervised_department()) OR public.is_admin()));


--
-- Name: final_exam_questions Supervisors manage own department final exam questions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Supervisors manage own department final exam questions" ON public.final_exam_questions USING ((EXISTS ( SELECT 1
   FROM public.final_exams
  WHERE ((final_exams.id = final_exam_questions.final_exam_id) AND ((final_exams.department_id = public.my_supervised_department()) OR public.is_admin())))));


--
-- Name: final_exams Supervisors manage own department final exams; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Supervisors manage own department final exams" ON public.final_exams USING (((department_id = public.my_supervised_department()) OR public.is_admin())) WITH CHECK (((department_id = public.my_supervised_department()) OR public.is_admin()));


--
-- Name: senior_team_lead_appointments Supervisors manage senior team lead appointments; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Supervisors manage senior team lead appointments" ON public.senior_team_lead_appointments USING (((department_id = public.my_supervised_department()) OR public.is_admin()));


--
-- Name: team_lead_appointments Supervisors manage team lead appointments; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Supervisors manage team lead appointments" ON public.team_lead_appointments USING (((department_id = public.my_supervised_department()) OR public.is_admin()));


--
-- Name: teacher_subjects Supervisors manage their department's teacher subjects; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Supervisors manage their department's teacher subjects" ON public.teacher_subjects USING ((department_id = public.my_supervised_department())) WITH CHECK ((department_id = public.my_supervised_department()));


--
-- Name: teacher_class_groups Supervisors remove own department teacher assignments; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Supervisors remove own department teacher assignments" ON public.teacher_class_groups FOR DELETE USING (((EXISTS ( SELECT 1
   FROM public.teacher_subjects ts
  WHERE ((ts.teacher_id = teacher_class_groups.teacher_id) AND (ts.department_id = public.my_supervised_department())))) OR (EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = teacher_class_groups.teacher_id) AND (profiles.department_id = public.my_supervised_department()))))));


--
-- Name: draft_exams Supervisors update own department drafts; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Supervisors update own department drafts" ON public.draft_exams FOR UPDATE USING (((department_id = public.my_supervised_department()) OR public.is_admin()));


--
-- Name: exam_sessions Supervisors update sessions for own department exams; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Supervisors update sessions for own department exams" ON public.exam_sessions FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM public.final_exams
  WHERE ((final_exams.id = exam_sessions.final_exam_id) AND ((final_exams.department_id = public.my_supervised_department()) OR public.is_admin())))));


--
-- Name: class_groups Supervisors view all class groups; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Supervisors view all class groups" ON public.class_groups FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'supervisor'::text)))));


--
-- Name: enrollments Supervisors view all enrollments; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Supervisors view all enrollments" ON public.enrollments FOR SELECT USING ((public.my_role() = 'supervisor'::text));


--
-- Name: profiles Supervisors view all student profiles; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Supervisors view all student profiles" ON public.profiles FOR SELECT USING (((role = 'student'::text) AND (public.my_role() = 'supervisor'::text)));


--
-- Name: questions Supervisors view own department questions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Supervisors view own department questions" ON public.questions FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.draft_exams
  WHERE ((draft_exams.id = questions.draft_exam_id) AND ((draft_exams.department_id = public.my_supervised_department()) OR public.is_admin())))));


--
-- Name: profiles Supervisors view profiles of students in their final exams; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Supervisors view profiles of students in their final exams" ON public.profiles FOR SELECT USING (public.is_supervisor_of_student(id));


--
-- Name: responses Supervisors view responses for own department exams; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Supervisors view responses for own department exams" ON public.responses FOR SELECT USING ((EXISTS ( SELECT 1
   FROM (public.exam_sessions
     JOIN public.final_exams ON ((final_exams.id = exam_sessions.final_exam_id)))
  WHERE ((exam_sessions.id = responses.session_id) AND ((final_exams.department_id = public.my_supervised_department()) OR public.is_admin())))));


--
-- Name: exam_sessions Supervisors view sessions for own department exams; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Supervisors view sessions for own department exams" ON public.exam_sessions FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.final_exams
  WHERE ((final_exams.id = exam_sessions.final_exam_id) AND ((final_exams.department_id = public.my_supervised_department()) OR public.is_admin())))));


--
-- Name: teacher_class_groups Supervisors view teacher class assignments; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Supervisors view teacher class assignments" ON public.teacher_class_groups FOR SELECT USING (((teacher_id = auth.uid()) OR public.is_admin() OR ((((auth.jwt() -> 'app_metadata'::text) ->> 'is_system_admin'::text))::boolean = true) OR (EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = teacher_class_groups.teacher_id) AND (profiles.department_id = public.my_supervised_department())))) OR (EXISTS ( SELECT 1
   FROM public.teacher_subjects ts
  WHERE ((ts.teacher_id = teacher_class_groups.teacher_id) AND (ts.department_id = public.my_supervised_department()))))));


--
-- Name: class_groups System admins view all class groups; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "System admins view all class groups" ON public.class_groups FOR SELECT USING ((public.is_admin() OR ((((auth.jwt() -> 'app_metadata'::text) ->> 'is_system_admin'::text))::boolean = true)));


--
-- Name: enrollments System admins view all enrollments; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "System admins view all enrollments" ON public.enrollments FOR SELECT USING ((public.is_admin() OR ((((auth.jwt() -> 'app_metadata'::text) ->> 'is_system_admin'::text))::boolean = true)));


--
-- Name: exam_sessions System admins view all exam sessions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "System admins view all exam sessions" ON public.exam_sessions FOR SELECT USING ((public.is_admin() OR ((((auth.jwt() -> 'app_metadata'::text) ->> 'is_system_admin'::text))::boolean = true)));


--
-- Name: marking_point_responses Teachers and supervisors grade marking points for own exams; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Teachers and supervisors grade marking points for own exams" ON public.marking_point_responses USING ((EXISTS ( SELECT 1
   FROM (((public.responses r
     JOIN public.exam_sessions s ON ((s.id = r.session_id)))
     LEFT JOIN public.final_exams fe ON ((fe.id = s.final_exam_id)))
     LEFT JOIN public.draft_exams de ON ((de.id = s.draft_exam_id)))
  WHERE ((r.id = marking_point_responses.response_id) AND ((de.created_by = auth.uid()) OR (fe.department_id = public.my_supervised_department()) OR (s.assigned_teacher_id = auth.uid()) OR ((fe.id IS NOT NULL) AND public.is_class_subject_teacher(auth.uid(), s.student_id, fe.subject)) OR public.is_admin()))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM (((public.responses r
     JOIN public.exam_sessions s ON ((s.id = r.session_id)))
     LEFT JOIN public.final_exams fe ON ((fe.id = s.final_exam_id)))
     LEFT JOIN public.draft_exams de ON ((de.id = s.draft_exam_id)))
  WHERE ((r.id = marking_point_responses.response_id) AND ((de.created_by = auth.uid()) OR (fe.department_id = public.my_supervised_department()) OR (s.assigned_teacher_id = auth.uid()) OR ((fe.id IS NOT NULL) AND public.is_class_subject_teacher(auth.uid(), s.student_id, fe.subject)) OR public.is_admin())))));


--
-- Name: exam_sections Teachers and supervisors manage sections; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Teachers and supervisors manage sections" ON public.exam_sections USING (((draft_exam_id IN ( SELECT draft_exams.id
   FROM public.draft_exams
  WHERE ((draft_exams.created_by = auth.uid()) OR (draft_exams.department_id = public.my_supervised_department())))) OR (final_exam_id IN ( SELECT final_exams.id
   FROM public.final_exams
  WHERE (final_exams.department_id = public.my_supervised_department()))) OR (draft_exam_id IN ( SELECT d.id
   FROM (public.draft_exams d
     JOIN public.team_lead_appointments tla ON (((tla.year_grade = d.target_grade) AND (tla.subject = d.subject))))
  WHERE (tla.teacher_id = auth.uid()))) OR public.is_admin())) WITH CHECK (((draft_exam_id IN ( SELECT draft_exams.id
   FROM public.draft_exams
  WHERE ((draft_exams.created_by = auth.uid()) OR (draft_exams.department_id = public.my_supervised_department())))) OR (final_exam_id IN ( SELECT final_exams.id
   FROM public.final_exams
  WHERE (final_exams.department_id = public.my_supervised_department()))) OR (draft_exam_id IN ( SELECT d.id
   FROM (public.draft_exams d
     JOIN public.team_lead_appointments tla ON (((tla.year_grade = d.target_grade) AND (tla.subject = d.subject))))
  WHERE (tla.teacher_id = auth.uid()))) OR public.is_admin()));


--
-- Name: responses Teachers grade responses for own direct exams; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Teachers grade responses for own direct exams" ON public.responses FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM (public.exam_sessions
     JOIN public.draft_exams ON ((draft_exams.id = exam_sessions.draft_exam_id)))
  WHERE ((exam_sessions.id = responses.session_id) AND (draft_exams.created_by = auth.uid())))));


--
-- Name: responses Teachers grade responses for their assigned classes; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Teachers grade responses for their assigned classes" ON public.responses FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM (public.exam_sessions s
     JOIN public.final_exams f ON ((f.id = s.final_exam_id)))
  WHERE ((s.id = responses.session_id) AND ((s.assigned_teacher_id = auth.uid()) OR public.is_class_subject_teacher(auth.uid(), s.student_id, f.subject))))));


--
-- Name: draft_exam_class_groups Teachers manage class group links for own drafts; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Teachers manage class group links for own drafts" ON public.draft_exam_class_groups USING (public.owns_draft_exam(draft_exam_id));


--
-- Name: project_group_members Teachers manage group members for their own exams; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Teachers manage group members for their own exams" ON public.project_group_members USING (((EXISTS ( SELECT 1
   FROM (public.project_groups g
     JOIN public.draft_exams d ON ((d.id = g.draft_exam_id)))
  WHERE ((g.id = project_group_members.group_id) AND (d.created_by = auth.uid())))) OR public.is_admin())) WITH CHECK (((EXISTS ( SELECT 1
   FROM (public.project_groups g
     JOIN public.draft_exams d ON ((d.id = g.draft_exam_id)))
  WHERE ((g.id = project_group_members.group_id) AND (d.created_by = auth.uid())))) OR public.is_admin()));


--
-- Name: project_groups Teachers manage groups for their own exams; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Teachers manage groups for their own exams" ON public.project_groups USING (((EXISTS ( SELECT 1
   FROM public.draft_exams d
  WHERE ((d.id = project_groups.draft_exam_id) AND (d.created_by = auth.uid())))) OR public.is_admin())) WITH CHECK (((EXISTS ( SELECT 1
   FROM public.draft_exams d
  WHERE ((d.id = project_groups.draft_exam_id) AND (d.created_by = auth.uid())))) OR public.is_admin()));


--
-- Name: ai_polish_usage Teachers manage own AI usage; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Teachers manage own AI usage" ON public.ai_polish_usage USING (((teacher_id = auth.uid()) OR public.is_admin()));


--
-- Name: teacher_class_groups Teachers manage own class assignments; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Teachers manage own class assignments" ON public.teacher_class_groups USING (((teacher_id = auth.uid()) OR public.is_admin()));


--
-- Name: draft_exams Teachers manage own drafts; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Teachers manage own drafts" ON public.draft_exams USING ((created_by = auth.uid())) WITH CHECK ((created_by = auth.uid()));


--
-- Name: questions Teachers manage own questions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Teachers manage own questions" ON public.questions USING ((created_by = auth.uid())) WITH CHECK ((created_by = auth.uid()));


--
-- Name: exam_sessions Teachers update sessions for own direct exams; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Teachers update sessions for own direct exams" ON public.exam_sessions FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM public.draft_exams
  WHERE ((draft_exams.id = exam_sessions.draft_exam_id) AND (draft_exams.created_by = auth.uid())))));


--
-- Name: exam_sessions Teachers update sessions for their assigned classes; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Teachers update sessions for their assigned classes" ON public.exam_sessions FOR UPDATE USING (((assigned_teacher_id = auth.uid()) OR (EXISTS ( SELECT 1
   FROM public.final_exams f
  WHERE ((f.id = exam_sessions.final_exam_id) AND public.is_class_subject_teacher(auth.uid(), exam_sessions.student_id, f.subject))))));


--
-- Name: class_groups Teachers view all class groups; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Teachers view all class groups" ON public.class_groups FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = ANY (ARRAY['teacher'::text, 'admin'::text]))))));


--
-- Name: enrollments Teachers view enrollments for their classes; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Teachers view enrollments for their classes" ON public.enrollments FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.teacher_class_groups tcg
  WHERE ((tcg.teacher_id = auth.uid()) AND (tcg.class_group_id = enrollments.class_group_id)))));


--
-- Name: senior_team_lead_appointments Teachers view own senior team lead appointments; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Teachers view own senior team lead appointments" ON public.senior_team_lead_appointments FOR SELECT USING ((teacher_id = auth.uid()));


--
-- Name: teacher_subjects Teachers view own subjects; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Teachers view own subjects" ON public.teacher_subjects FOR SELECT USING ((teacher_id = auth.uid()));


--
-- Name: team_lead_appointments Teachers view own team lead appointments; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Teachers view own team lead appointments" ON public.team_lead_appointments FOR SELECT USING ((teacher_id = auth.uid()));


--
-- Name: peer_ratings Teachers view peer ratings for their own exams; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Teachers view peer ratings for their own exams" ON public.peer_ratings FOR SELECT USING (((EXISTS ( SELECT 1
   FROM (public.project_groups g
     JOIN public.draft_exams d ON ((d.id = g.draft_exam_id)))
  WHERE ((g.id = peer_ratings.group_id) AND (d.created_by = auth.uid())))) OR public.is_admin()));


--
-- Name: profiles Teachers view profiles of students in their classes; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Teachers view profiles of students in their classes" ON public.profiles FOR SELECT USING (public.is_teacher_of_class_student(id));


--
-- Name: profiles Teachers view profiles of students on their direct exams; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Teachers view profiles of students on their direct exams" ON public.profiles FOR SELECT USING (public.is_teacher_of_student(id));


--
-- Name: responses Teachers view responses for own direct exams; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Teachers view responses for own direct exams" ON public.responses FOR SELECT USING ((EXISTS ( SELECT 1
   FROM (public.exam_sessions
     JOIN public.draft_exams ON ((draft_exams.id = exam_sessions.draft_exam_id)))
  WHERE ((exam_sessions.id = responses.session_id) AND (draft_exams.created_by = auth.uid())))));


--
-- Name: responses Teachers view responses for their assigned classes; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Teachers view responses for their assigned classes" ON public.responses FOR SELECT USING ((EXISTS ( SELECT 1
   FROM (public.exam_sessions s
     JOIN public.final_exams f ON ((f.id = s.final_exam_id)))
  WHERE ((s.id = responses.session_id) AND ((s.assigned_teacher_id = auth.uid()) OR public.is_class_subject_teacher(auth.uid(), s.student_id, f.subject))))));


--
-- Name: exam_sessions Teachers view sessions for own direct exams; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Teachers view sessions for own direct exams" ON public.exam_sessions FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.draft_exams
  WHERE ((draft_exams.id = exam_sessions.draft_exam_id) AND (draft_exams.created_by = auth.uid())))));


--
-- Name: exam_sessions Teachers view sessions for their assigned classes; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Teachers view sessions for their assigned classes" ON public.exam_sessions FOR SELECT USING (((assigned_teacher_id = auth.uid()) OR (EXISTS ( SELECT 1
   FROM public.final_exams f
  WHERE ((f.id = exam_sessions.final_exam_id) AND public.is_class_subject_teacher(auth.uid(), exam_sessions.student_id, f.subject))))));


--
-- Name: department_subjects Teachers view their department subjects; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Teachers view their department subjects" ON public.department_subjects FOR SELECT USING ((department_id = public.my_profile_department_id()));


--
-- Name: questions Team leads can edit shared exam questions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Team leads can edit shared exam questions" ON public.questions USING ((EXISTS ( SELECT 1
   FROM (public.draft_exams d
     JOIN public.team_lead_appointments tla ON (((tla.year_grade = d.target_grade) AND (tla.subject = d.subject))))
  WHERE ((d.id = questions.draft_exam_id) AND (tla.teacher_id = auth.uid())))));


--
-- Name: draft_exams Team leads can edit shared exams; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Team leads can edit shared exams" ON public.draft_exams FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM public.team_lead_appointments tla
  WHERE ((tla.teacher_id = auth.uid()) AND (tla.year_grade = draft_exams.target_grade) AND (tla.subject = draft_exams.subject)))));


--
-- Name: questions Team leads can view shared exam questions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Team leads can view shared exam questions" ON public.questions FOR SELECT USING ((EXISTS ( SELECT 1
   FROM (public.draft_exams d
     JOIN public.team_lead_appointments tla ON (((tla.year_grade = d.target_grade) AND (tla.subject = d.subject))))
  WHERE ((d.id = questions.draft_exam_id) AND (tla.teacher_id = auth.uid())))));


--
-- Name: draft_exams Team leads can view shared exams; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Team leads can view shared exams" ON public.draft_exams FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.team_lead_appointments tla
  WHERE ((tla.teacher_id = auth.uid()) AND (tla.year_grade = draft_exams.target_grade) AND (tla.subject = draft_exams.subject)))));


--
-- Name: profiles Users can read relevant profiles; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can read relevant profiles" ON public.profiles FOR SELECT USING (((auth.uid() = id) OR public.is_admin() OR ((((auth.jwt() -> 'app_metadata'::text) ->> 'is_system_admin'::text))::boolean = true) OR (department_id = public.my_profile_department_id()) OR ((public.my_role() = 'supervisor'::text) AND (department_id = public.my_supervised_department()))));


--
-- Name: profiles Users can update own profile; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING ((auth.uid() = id)) WITH CHECK ((auth.uid() = id));


--
-- Name: ai_polish_usage; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.ai_polish_usage ENABLE ROW LEVEL SECURITY;

--
-- Name: platform_billing_settings any authenticated org can view billing settings; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "any authenticated org can view billing settings" ON public.platform_billing_settings FOR SELECT TO authenticated USING (true);


--
-- Name: school_requests anyone can submit a school request; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "anyone can submit a school request" ON public.school_requests FOR INSERT TO authenticated, anon WITH CHECK (true);


--
-- Name: class_groups; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.class_groups ENABLE ROW LEVEL SECURITY;

--
-- Name: department_subjects; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.department_subjects ENABLE ROW LEVEL SECURITY;

--
-- Name: departments; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.departments ENABLE ROW LEVEL SECURITY;

--
-- Name: draft_exam_class_groups; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.draft_exam_class_groups ENABLE ROW LEVEL SECURITY;

--
-- Name: draft_exams; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.draft_exams ENABLE ROW LEVEL SECURITY;

--
-- Name: enrollments; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.enrollments ENABLE ROW LEVEL SECURITY;

--
-- Name: exam_sections; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.exam_sections ENABLE ROW LEVEL SECURITY;

--
-- Name: exam_sessions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.exam_sessions ENABLE ROW LEVEL SECURITY;

--
-- Name: final_exam_class_groups; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.final_exam_class_groups ENABLE ROW LEVEL SECURITY;

--
-- Name: final_exam_questions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.final_exam_questions ENABLE ROW LEVEL SECURITY;

--
-- Name: final_exams; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.final_exams ENABLE ROW LEVEL SECURITY;

--
-- Name: marking_point_responses; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.marking_point_responses ENABLE ROW LEVEL SECURITY;

--
-- Name: org_exam_questions org manages its own exam questions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "org manages its own exam questions" ON public.org_exam_questions USING ((org_exam_id IN ( SELECT oe.id
   FROM (public.org_exams oe
     JOIN public.organizations o ON ((o.id = oe.organization_id)))
  WHERE (o.auth_user_id = auth.uid())))) WITH CHECK ((org_exam_id IN ( SELECT oe.id
   FROM (public.org_exams oe
     JOIN public.organizations o ON ((o.id = oe.organization_id)))
  WHERE (o.auth_user_id = auth.uid()))));


--
-- Name: org_exams org manages its own exams; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "org manages its own exams" ON public.org_exams USING ((organization_id IN ( SELECT organizations.id
   FROM public.organizations
  WHERE (organizations.auth_user_id = auth.uid())))) WITH CHECK (((organization_id IN ( SELECT organizations.id
   FROM public.organizations
  WHERE (organizations.auth_user_id = auth.uid()))) AND ((status <> 'published'::text) OR (EXISTS ( SELECT 1
   FROM public.organization_subscriptions os
  WHERE ((os.organization_id = org_exams.organization_id) AND (os.subscription_status = 'active'::text)))))));


--
-- Name: organization_payments org manages its own payment submissions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "org manages its own payment submissions" ON public.organization_payments FOR SELECT USING ((organization_id IN ( SELECT organizations.id
   FROM public.organizations
  WHERE (organizations.auth_user_id = auth.uid()))));


--
-- Name: org_respondent_fields org manages its own respondent fields; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "org manages its own respondent fields" ON public.org_respondent_fields USING ((org_exam_id IN ( SELECT oe.id
   FROM (public.org_exams oe
     JOIN public.organizations o ON ((o.id = oe.organization_id)))
  WHERE (o.auth_user_id = auth.uid())))) WITH CHECK ((org_exam_id IN ( SELECT oe.id
   FROM (public.org_exams oe
     JOIN public.organizations o ON ((o.id = oe.organization_id)))
  WHERE (o.auth_user_id = auth.uid()))));


--
-- Name: organizations org owns its own row; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "org owns its own row" ON public.organizations USING ((auth_user_id = auth.uid())) WITH CHECK ((auth_user_id = auth.uid()));


--
-- Name: organization_subscriptions org reads its own subscription; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "org reads its own subscription" ON public.organization_subscriptions FOR SELECT USING ((organization_id IN ( SELECT organizations.id
   FROM public.organizations
  WHERE (organizations.auth_user_id = auth.uid()))));


--
-- Name: organization_payments org submits its own payment; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "org submits its own payment" ON public.organization_payments FOR INSERT WITH CHECK (((organization_id IN ( SELECT organizations.id
   FROM public.organizations
  WHERE (organizations.auth_user_id = auth.uid()))) AND (status = 'pending'::text) AND (method = 'bank_transfer'::text)));


--
-- Name: org_respondent_field_values org views field values for its own exams; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "org views field values for its own exams" ON public.org_respondent_field_values FOR SELECT USING ((session_id IN ( SELECT s.id
   FROM ((public.org_exam_sessions s
     JOIN public.org_exams oe ON ((oe.id = s.org_exam_id)))
     JOIN public.organizations o ON ((o.id = oe.organization_id)))
  WHERE (o.auth_user_id = auth.uid()))));


--
-- Name: org_exam_responses org views responses for its own exams; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "org views responses for its own exams" ON public.org_exam_responses FOR SELECT USING ((session_id IN ( SELECT s.id
   FROM ((public.org_exam_sessions s
     JOIN public.org_exams oe ON ((oe.id = s.org_exam_id)))
     JOIN public.organizations o ON ((o.id = oe.organization_id)))
  WHERE (o.auth_user_id = auth.uid()))));


--
-- Name: org_exam_sessions org views sessions for its own exams; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "org views sessions for its own exams" ON public.org_exam_sessions FOR SELECT USING ((org_exam_id IN ( SELECT oe.id
   FROM (public.org_exams oe
     JOIN public.organizations o ON ((o.id = oe.organization_id)))
  WHERE (o.auth_user_id = auth.uid()))));


--
-- Name: org_exam_questions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.org_exam_questions ENABLE ROW LEVEL SECURITY;

--
-- Name: org_exam_responses; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.org_exam_responses ENABLE ROW LEVEL SECURITY;

--
-- Name: org_exam_sessions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.org_exam_sessions ENABLE ROW LEVEL SECURITY;

--
-- Name: org_exams; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.org_exams ENABLE ROW LEVEL SECURITY;

--
-- Name: org_respondent_field_values; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.org_respondent_field_values ENABLE ROW LEVEL SECURITY;

--
-- Name: org_respondent_fields; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.org_respondent_fields ENABLE ROW LEVEL SECURITY;

--
-- Name: organization_payments; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.organization_payments ENABLE ROW LEVEL SECURITY;

--
-- Name: organization_subscriptions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.organization_subscriptions ENABLE ROW LEVEL SECURITY;

--
-- Name: organizations; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;

--
-- Name: password_reset_requests; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.password_reset_requests ENABLE ROW LEVEL SECURITY;

--
-- Name: peer_ratings; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.peer_ratings ENABLE ROW LEVEL SECURITY;

--
-- Name: platform_billing_settings; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.platform_billing_settings ENABLE ROW LEVEL SECURITY;

--
-- Name: profiles; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

--
-- Name: project_group_members; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.project_group_members ENABLE ROW LEVEL SECURITY;

--
-- Name: project_groups; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.project_groups ENABLE ROW LEVEL SECURITY;

--
-- Name: questions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.questions ENABLE ROW LEVEL SECURITY;

--
-- Name: org_respondent_field_values respondent manages its own field values; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "respondent manages its own field values" ON public.org_respondent_field_values USING ((session_id IN ( SELECT org_exam_sessions.id
   FROM public.org_exam_sessions
  WHERE (org_exam_sessions.auth_user_id = auth.uid())))) WITH CHECK ((session_id IN ( SELECT org_exam_sessions.id
   FROM public.org_exam_sessions
  WHERE (org_exam_sessions.auth_user_id = auth.uid()))));


--
-- Name: org_exam_responses respondent manages its own responses; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "respondent manages its own responses" ON public.org_exam_responses USING ((session_id IN ( SELECT org_exam_sessions.id
   FROM public.org_exam_sessions
  WHERE (org_exam_sessions.auth_user_id = auth.uid())))) WITH CHECK ((session_id IN ( SELECT org_exam_sessions.id
   FROM public.org_exam_sessions
  WHERE (org_exam_sessions.auth_user_id = auth.uid()))));


--
-- Name: org_exam_sessions respondent manages its own session; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "respondent manages its own session" ON public.org_exam_sessions USING ((auth_user_id = auth.uid())) WITH CHECK ((auth_user_id = auth.uid()));


--
-- Name: org_respondent_fields respondent reads fields for their session's exam; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "respondent reads fields for their session's exam" ON public.org_respondent_fields FOR SELECT USING ((org_exam_id IN ( SELECT org_exam_sessions.org_exam_id
   FROM public.org_exam_sessions
  WHERE (org_exam_sessions.auth_user_id = auth.uid()))));


--
-- Name: org_exam_questions respondent reads questions for their session's exam; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "respondent reads questions for their session's exam" ON public.org_exam_questions FOR SELECT USING ((org_exam_id IN ( SELECT org_exam_sessions.org_exam_id
   FROM public.org_exam_sessions
  WHERE (org_exam_sessions.auth_user_id = auth.uid()))));


--
-- Name: responses; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.responses ENABLE ROW LEVEL SECURITY;

--
-- Name: school_requests; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.school_requests ENABLE ROW LEVEL SECURITY;

--
-- Name: school_settings; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.school_settings ENABLE ROW LEVEL SECURITY;

--
-- Name: school_subscriptions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.school_subscriptions ENABLE ROW LEVEL SECURITY;

--
-- Name: self_mock_questions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.self_mock_questions ENABLE ROW LEVEL SECURITY;

--
-- Name: self_mocks; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.self_mocks ENABLE ROW LEVEL SECURITY;

--
-- Name: senior_team_lead_appointments; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.senior_team_lead_appointments ENABLE ROW LEVEL SECURITY;

--
-- Name: platform_billing_settings system admins manage billing settings; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "system admins manage billing settings" ON public.platform_billing_settings USING (public.is_system_admin()) WITH CHECK (public.is_system_admin());


--
-- Name: organization_payments system admins manage payments; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "system admins manage payments" ON public.organization_payments USING (public.is_system_admin()) WITH CHECK (public.is_system_admin());


--
-- Name: school_requests system admins manage school requests; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "system admins manage school requests" ON public.school_requests USING (public.is_system_admin()) WITH CHECK (public.is_system_admin());


--
-- Name: school_subscriptions system admins manage school subscriptions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "system admins manage school subscriptions" ON public.school_subscriptions USING (public.is_system_admin()) WITH CHECK (public.is_system_admin());


--
-- Name: organization_subscriptions system admins manage subscriptions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "system admins manage subscriptions" ON public.organization_subscriptions USING (public.is_system_admin()) WITH CHECK (public.is_system_admin());


--
-- Name: teacher_class_groups; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.teacher_class_groups ENABLE ROW LEVEL SECURITY;

--
-- Name: teacher_subjects; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.teacher_subjects ENABLE ROW LEVEL SECURITY;

--
-- Name: team_lead_appointments; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.team_lead_appointments ENABLE ROW LEVEL SECURITY;

--
-- PostgreSQL database dump complete
--

\unrestrict Zdz5KgmtbdZPUzvjdsW0YtBPH1pM63wVBuY1CpU5WkKFsXjTPwnhsLZAv5EDitY

