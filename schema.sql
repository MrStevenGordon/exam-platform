--
-- PostgreSQL database dump
--

\restrict TYwCT9LA9YzPVcJ0izpYGKhTkbPiYJWYG7Gjt5rkbIVhK0W3I7Jjc3OY2ypWgvO

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
-- Name: auth; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA auth;


--
-- Name: public; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA public;


--
-- Name: SCHEMA public; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON SCHEMA public IS 'standard public schema';


--
-- Name: storage; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA storage;


--
-- Name: aal_level; Type: TYPE; Schema: auth; Owner: -
--

CREATE TYPE auth.aal_level AS ENUM (
    'aal1',
    'aal2',
    'aal3'
);


--
-- Name: code_challenge_method; Type: TYPE; Schema: auth; Owner: -
--

CREATE TYPE auth.code_challenge_method AS ENUM (
    's256',
    'plain'
);


--
-- Name: factor_status; Type: TYPE; Schema: auth; Owner: -
--

CREATE TYPE auth.factor_status AS ENUM (
    'unverified',
    'verified'
);


--
-- Name: factor_type; Type: TYPE; Schema: auth; Owner: -
--

CREATE TYPE auth.factor_type AS ENUM (
    'totp',
    'webauthn',
    'phone'
);


--
-- Name: oauth_authorization_status; Type: TYPE; Schema: auth; Owner: -
--

CREATE TYPE auth.oauth_authorization_status AS ENUM (
    'pending',
    'approved',
    'denied',
    'expired'
);


--
-- Name: oauth_client_type; Type: TYPE; Schema: auth; Owner: -
--

CREATE TYPE auth.oauth_client_type AS ENUM (
    'public',
    'confidential'
);


--
-- Name: oauth_registration_type; Type: TYPE; Schema: auth; Owner: -
--

CREATE TYPE auth.oauth_registration_type AS ENUM (
    'dynamic',
    'manual'
);


--
-- Name: oauth_response_type; Type: TYPE; Schema: auth; Owner: -
--

CREATE TYPE auth.oauth_response_type AS ENUM (
    'code'
);


--
-- Name: one_time_token_type; Type: TYPE; Schema: auth; Owner: -
--

CREATE TYPE auth.one_time_token_type AS ENUM (
    'confirmation_token',
    'reauthentication_token',
    'recovery_token',
    'email_change_token_new',
    'email_change_token_current',
    'phone_change_token'
);


--
-- Name: buckettype; Type: TYPE; Schema: storage; Owner: -
--

CREATE TYPE storage.buckettype AS ENUM (
    'STANDARD',
    'ANALYTICS',
    'VECTOR'
);


--
-- Name: email(); Type: FUNCTION; Schema: auth; Owner: -
--

CREATE FUNCTION auth.email() RETURNS text
    LANGUAGE sql STABLE
    AS $$
  select 
  coalesce(
    nullif(current_setting('request.jwt.claim.email', true), ''),
    (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'email')
  )::text
$$;


--
-- Name: FUNCTION email(); Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON FUNCTION auth.email() IS 'Deprecated. Use auth.jwt() -> ''email'' instead.';


--
-- Name: jwt(); Type: FUNCTION; Schema: auth; Owner: -
--

CREATE FUNCTION auth.jwt() RETURNS jsonb
    LANGUAGE sql STABLE
    AS $$
  select 
    coalesce(
        nullif(current_setting('request.jwt.claim', true), ''),
        nullif(current_setting('request.jwt.claims', true), '')
    )::jsonb
$$;


--
-- Name: role(); Type: FUNCTION; Schema: auth; Owner: -
--

CREATE FUNCTION auth.role() RETURNS text
    LANGUAGE sql STABLE
    AS $$
  select 
  coalesce(
    nullif(current_setting('request.jwt.claim.role', true), ''),
    (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role')
  )::text
$$;


--
-- Name: FUNCTION role(); Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON FUNCTION auth.role() IS 'Deprecated. Use auth.jwt() -> ''role'' instead.';


--
-- Name: uid(); Type: FUNCTION; Schema: auth; Owner: -
--

CREATE FUNCTION auth.uid() RETURNS uuid
    LANGUAGE sql STABLE
    AS $$
  select 
  coalesce(
    nullif(current_setting('request.jwt.claim.sub', true), ''),
    (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub')
  )::uuid
$$;


--
-- Name: FUNCTION uid(); Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON FUNCTION auth.uid() IS 'Deprecated. Use auth.jwt() -> ''sub'' instead.';


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
    LANGUAGE sql SECURITY DEFINER
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
    LANGUAGE sql SECURITY DEFINER
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
    LANGUAGE sql SECURITY DEFINER
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
    LANGUAGE sql SECURITY DEFINER
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
    LANGUAGE sql SECURITY DEFINER
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
    LANGUAGE sql SECURITY DEFINER
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
    LANGUAGE sql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select department_id from profiles where id = auth.uid();
$$;


--
-- Name: my_profile_department_id(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.my_profile_department_id() RETURNS uuid
    LANGUAGE sql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select department_id from profiles where id = auth.uid()
$$;


--
-- Name: my_role(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.my_role() RETURNS text
    LANGUAGE sql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select role from profiles where id = auth.uid()
$$;


--
-- Name: my_supervised_department(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.my_supervised_department() RETURNS uuid
    LANGUAGE sql SECURITY DEFINER
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
    LANGUAGE sql SECURITY DEFINER
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


--
-- Name: allow_any_operation(text[]); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.allow_any_operation(expected_operations text[]) RETURNS boolean
    LANGUAGE sql STABLE
    AS $$
  WITH current_operation AS (
    SELECT storage.operation() AS raw_operation
  ),
  normalized AS (
    SELECT CASE
      WHEN raw_operation LIKE 'storage.%' THEN substr(raw_operation, 9)
      ELSE raw_operation
    END AS current_operation
    FROM current_operation
  )
  SELECT EXISTS (
    SELECT 1
    FROM normalized n
    CROSS JOIN LATERAL unnest(expected_operations) AS expected_operation
    WHERE expected_operation IS NOT NULL
      AND expected_operation <> ''
      AND n.current_operation = CASE
        WHEN expected_operation LIKE 'storage.%' THEN substr(expected_operation, 9)
        ELSE expected_operation
      END
  );
$$;


--
-- Name: allow_only_operation(text); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.allow_only_operation(expected_operation text) RETURNS boolean
    LANGUAGE sql STABLE
    AS $$
  WITH current_operation AS (
    SELECT storage.operation() AS raw_operation
  ),
  normalized AS (
    SELECT
      CASE
        WHEN raw_operation LIKE 'storage.%' THEN substr(raw_operation, 9)
        ELSE raw_operation
      END AS current_operation,
      CASE
        WHEN expected_operation LIKE 'storage.%' THEN substr(expected_operation, 9)
        ELSE expected_operation
      END AS requested_operation
    FROM current_operation
  )
  SELECT CASE
    WHEN requested_operation IS NULL OR requested_operation = '' THEN FALSE
    ELSE COALESCE(current_operation = requested_operation, FALSE)
  END
  FROM normalized;
$$;


--
-- Name: can_insert_object(text, text, uuid, jsonb); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.can_insert_object(bucketid text, name text, owner uuid, metadata jsonb) RETURNS void
    LANGUAGE plpgsql
    AS $$
BEGIN
  INSERT INTO "storage"."objects" ("bucket_id", "name", "owner", "metadata") VALUES (bucketid, name, owner, metadata);
  -- hack to rollback the successful insert
  RAISE sqlstate 'PT200' using
  message = 'ROLLBACK',
  detail = 'rollback successful insert';
END
$$;


--
-- Name: enforce_bucket_name_length(); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.enforce_bucket_name_length() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
begin
    if length(new.name) > 100 then
        raise exception 'bucket name "%" is too long (% characters). Max is 100.', new.name, length(new.name);
    end if;
    return new;
end;
$$;


--
-- Name: extension(text); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.extension(name text) RETURNS text
    LANGUAGE plpgsql IMMUTABLE
    AS $$
DECLARE
    _parts text[];
    _filename text;
BEGIN
    -- Split on "/" to get path segments
    SELECT string_to_array(name, '/') INTO _parts;
    -- Get the last path segment (the actual filename)
    SELECT _parts[array_length(_parts, 1)] INTO _filename;
    -- Extract extension: reverse, split on '.', then reverse again
    RETURN reverse(split_part(reverse(_filename), '.', 1));
END
$$;


--
-- Name: filename(text); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.filename(name text) RETURNS text
    LANGUAGE plpgsql
    AS $$
DECLARE
_parts text[];
BEGIN
	select string_to_array(name, '/') into _parts;
	return _parts[array_length(_parts,1)];
END
$$;


--
-- Name: foldername(text); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.foldername(name text) RETURNS text[]
    LANGUAGE plpgsql IMMUTABLE
    AS $$
DECLARE
    _parts text[];
BEGIN
    -- Split on "/" to get path segments
    SELECT string_to_array(name, '/') INTO _parts;
    -- Return everything except the last segment
    RETURN _parts[1 : array_length(_parts,1) - 1];
END
$$;


--
-- Name: get_common_prefix(text, text, text); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.get_common_prefix(p_key text, p_prefix text, p_delimiter text) RETURNS text
    LANGUAGE sql IMMUTABLE
    AS $$
SELECT CASE
    WHEN position(p_delimiter IN substring(p_key FROM length(p_prefix) + 1)) > 0
    THEN left(p_key, length(p_prefix) + position(p_delimiter IN substring(p_key FROM length(p_prefix) + 1)))
    ELSE NULL
END;
$$;


--
-- Name: get_size_by_bucket(); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.get_size_by_bucket() RETURNS TABLE(size bigint, bucket_id text)
    LANGUAGE plpgsql STABLE
    AS $$
BEGIN
    return query
        select sum((metadata->>'size')::bigint)::bigint as size, obj.bucket_id
        from "storage".objects as obj
        group by obj.bucket_id;
END
$$;


--
-- Name: list_multipart_uploads_with_delimiter(text, text, text, integer, text, text); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.list_multipart_uploads_with_delimiter(bucket_id text, prefix_param text, delimiter_param text, max_keys integer DEFAULT 100, next_key_token text DEFAULT ''::text, next_upload_token text DEFAULT ''::text) RETURNS TABLE(key text, id text, created_at timestamp with time zone)
    LANGUAGE plpgsql
    AS $_$
BEGIN
    RETURN QUERY EXECUTE
        'SELECT DISTINCT ON(key COLLATE "C") * from (
            SELECT
                CASE
                    WHEN position($2 IN substring(key from length($1) + 1)) > 0 THEN
                        substring(key from 1 for length($1) + position($2 IN substring(key from length($1) + 1)))
                    ELSE
                        key
                END AS key, id, created_at
            FROM
                storage.s3_multipart_uploads
            WHERE
                bucket_id = $5 AND
                key ILIKE $1 || ''%'' AND
                CASE
                    WHEN $4 != '''' AND $6 = '''' THEN
                        CASE
                            WHEN position($2 IN substring(key from length($1) + 1)) > 0 THEN
                                substring(key from 1 for length($1) + position($2 IN substring(key from length($1) + 1))) COLLATE "C" > $4
                            ELSE
                                key COLLATE "C" > $4
                            END
                    ELSE
                        true
                END AND
                CASE
                    WHEN $6 != '''' THEN
                        id COLLATE "C" > $6
                    ELSE
                        true
                    END
            ORDER BY
                key COLLATE "C" ASC, created_at ASC) as e order by key COLLATE "C" LIMIT $3'
        USING prefix_param, delimiter_param, max_keys, next_key_token, bucket_id, next_upload_token;
END;
$_$;


--
-- Name: list_objects_with_delimiter(text, text, text, integer, text, text, text); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.list_objects_with_delimiter(_bucket_id text, prefix_param text, delimiter_param text, max_keys integer DEFAULT 100, start_after text DEFAULT ''::text, next_token text DEFAULT ''::text, sort_order text DEFAULT 'asc'::text) RETURNS TABLE(name text, id uuid, metadata jsonb, updated_at timestamp with time zone, created_at timestamp with time zone, last_accessed_at timestamp with time zone)
    LANGUAGE plpgsql STABLE
    AS $_$
DECLARE
    v_peek_name TEXT;
    v_current RECORD;
    v_common_prefix TEXT;

    -- Configuration
    v_is_asc BOOLEAN;
    v_prefix TEXT;
    v_start TEXT;
    v_upper_bound TEXT;
    v_file_batch_size INT;

    -- Seek state
    v_next_seek TEXT;
    v_count INT := 0;

    -- Dynamic SQL for batch query only
    v_batch_query TEXT;

BEGIN
    -- ========================================================================
    -- INITIALIZATION
    -- ========================================================================
    v_is_asc := lower(coalesce(sort_order, 'asc')) = 'asc';
    v_prefix := coalesce(prefix_param, '');
    v_start := CASE WHEN coalesce(next_token, '') <> '' THEN next_token ELSE coalesce(start_after, '') END;
    v_file_batch_size := LEAST(GREATEST(max_keys * 2, 100), 1000);

    -- Calculate upper bound for prefix filtering (bytewise, using COLLATE "C")
    IF v_prefix = '' THEN
        v_upper_bound := NULL;
    ELSIF right(v_prefix, 1) = delimiter_param THEN
        v_upper_bound := left(v_prefix, -1) || chr(ascii(delimiter_param) + 1);
    ELSE
        v_upper_bound := left(v_prefix, -1) || chr(ascii(right(v_prefix, 1)) + 1);
    END IF;

    -- Build batch query (dynamic SQL - called infrequently, amortized over many rows)
    IF v_is_asc THEN
        IF v_upper_bound IS NOT NULL THEN
            v_batch_query := 'SELECT o.name, o.id, o.updated_at, o.created_at, o.last_accessed_at, o.metadata ' ||
                'FROM storage.objects o WHERE o.bucket_id = $1 AND o.name COLLATE "C" >= $2 ' ||
                'AND o.name COLLATE "C" < $3 ORDER BY o.name COLLATE "C" ASC LIMIT $4';
        ELSE
            v_batch_query := 'SELECT o.name, o.id, o.updated_at, o.created_at, o.last_accessed_at, o.metadata ' ||
                'FROM storage.objects o WHERE o.bucket_id = $1 AND o.name COLLATE "C" >= $2 ' ||
                'ORDER BY o.name COLLATE "C" ASC LIMIT $4';
        END IF;
    ELSE
        IF v_upper_bound IS NOT NULL THEN
            v_batch_query := 'SELECT o.name, o.id, o.updated_at, o.created_at, o.last_accessed_at, o.metadata ' ||
                'FROM storage.objects o WHERE o.bucket_id = $1 AND o.name COLLATE "C" < $2 ' ||
                'AND o.name COLLATE "C" >= $3 ORDER BY o.name COLLATE "C" DESC LIMIT $4';
        ELSE
            v_batch_query := 'SELECT o.name, o.id, o.updated_at, o.created_at, o.last_accessed_at, o.metadata ' ||
                'FROM storage.objects o WHERE o.bucket_id = $1 AND o.name COLLATE "C" < $2 ' ||
                'ORDER BY o.name COLLATE "C" DESC LIMIT $4';
        END IF;
    END IF;

    -- ========================================================================
    -- SEEK INITIALIZATION: Determine starting position
    -- ========================================================================
    IF v_start = '' THEN
        IF v_is_asc THEN
            v_next_seek := v_prefix;
        ELSE
            -- DESC without cursor: find the last item in range
            IF v_upper_bound IS NOT NULL THEN
                SELECT o.name INTO v_next_seek FROM storage.objects o
                WHERE o.bucket_id = _bucket_id AND o.name COLLATE "C" >= v_prefix AND o.name COLLATE "C" < v_upper_bound
                ORDER BY o.name COLLATE "C" DESC LIMIT 1;
            ELSIF v_prefix <> '' THEN
                SELECT o.name INTO v_next_seek FROM storage.objects o
                WHERE o.bucket_id = _bucket_id AND o.name COLLATE "C" >= v_prefix
                ORDER BY o.name COLLATE "C" DESC LIMIT 1;
            ELSE
                SELECT o.name INTO v_next_seek FROM storage.objects o
                WHERE o.bucket_id = _bucket_id
                ORDER BY o.name COLLATE "C" DESC LIMIT 1;
            END IF;

            IF v_next_seek IS NOT NULL THEN
                v_next_seek := v_next_seek || delimiter_param;
            ELSE
                RETURN;
            END IF;
        END IF;
    ELSE
        -- Cursor provided: determine if it refers to a folder or leaf
        IF EXISTS (
            SELECT 1 FROM storage.objects o
            WHERE o.bucket_id = _bucket_id
              AND o.name COLLATE "C" LIKE v_start || delimiter_param || '%'
            LIMIT 1
        ) THEN
            -- Cursor refers to a folder
            IF v_is_asc THEN
                v_next_seek := v_start || chr(ascii(delimiter_param) + 1);
            ELSE
                v_next_seek := v_start || delimiter_param;
            END IF;
        ELSE
            -- Cursor refers to a leaf object
            IF v_is_asc THEN
                v_next_seek := v_start || delimiter_param;
            ELSE
                v_next_seek := v_start;
            END IF;
        END IF;
    END IF;

    -- ========================================================================
    -- MAIN LOOP: Hybrid peek-then-batch algorithm
    -- Uses STATIC SQL for peek (hot path) and DYNAMIC SQL for batch
    -- ========================================================================
    LOOP
        EXIT WHEN v_count >= max_keys;

        -- STEP 1: PEEK using STATIC SQL (plan cached, very fast)
        IF v_is_asc THEN
            IF v_upper_bound IS NOT NULL THEN
                SELECT o.name INTO v_peek_name FROM storage.objects o
                WHERE o.bucket_id = _bucket_id AND o.name COLLATE "C" >= v_next_seek AND o.name COLLATE "C" < v_upper_bound
                ORDER BY o.name COLLATE "C" ASC LIMIT 1;
            ELSE
                SELECT o.name INTO v_peek_name FROM storage.objects o
                WHERE o.bucket_id = _bucket_id AND o.name COLLATE "C" >= v_next_seek
                ORDER BY o.name COLLATE "C" ASC LIMIT 1;
            END IF;
        ELSE
            IF v_upper_bound IS NOT NULL THEN
                SELECT o.name INTO v_peek_name FROM storage.objects o
                WHERE o.bucket_id = _bucket_id AND o.name COLLATE "C" < v_next_seek AND o.name COLLATE "C" >= v_prefix
                ORDER BY o.name COLLATE "C" DESC LIMIT 1;
            ELSIF v_prefix <> '' THEN
                SELECT o.name INTO v_peek_name FROM storage.objects o
                WHERE o.bucket_id = _bucket_id AND o.name COLLATE "C" < v_next_seek AND o.name COLLATE "C" >= v_prefix
                ORDER BY o.name COLLATE "C" DESC LIMIT 1;
            ELSE
                SELECT o.name INTO v_peek_name FROM storage.objects o
                WHERE o.bucket_id = _bucket_id AND o.name COLLATE "C" < v_next_seek
                ORDER BY o.name COLLATE "C" DESC LIMIT 1;
            END IF;
        END IF;

        EXIT WHEN v_peek_name IS NULL;

        -- STEP 2: Check if this is a FOLDER or FILE
        v_common_prefix := storage.get_common_prefix(v_peek_name, v_prefix, delimiter_param);

        IF v_common_prefix IS NOT NULL THEN
            -- FOLDER: Emit and skip to next folder (no heap access needed)
            name := rtrim(v_common_prefix, delimiter_param);
            id := NULL;
            updated_at := NULL;
            created_at := NULL;
            last_accessed_at := NULL;
            metadata := NULL;
            RETURN NEXT;
            v_count := v_count + 1;

            -- Advance seek past the folder range
            IF v_is_asc THEN
                v_next_seek := left(v_common_prefix, -1) || chr(ascii(delimiter_param) + 1);
            ELSE
                v_next_seek := v_common_prefix;
            END IF;
        ELSE
            -- FILE: Batch fetch using DYNAMIC SQL (overhead amortized over many rows)
            -- For ASC: upper_bound is the exclusive upper limit (< condition)
            -- For DESC: prefix is the inclusive lower limit (>= condition)
            FOR v_current IN EXECUTE v_batch_query USING _bucket_id, v_next_seek,
                CASE WHEN v_is_asc THEN COALESCE(v_upper_bound, v_prefix) ELSE v_prefix END, v_file_batch_size
            LOOP
                v_common_prefix := storage.get_common_prefix(v_current.name, v_prefix, delimiter_param);

                IF v_common_prefix IS NOT NULL THEN
                    -- Hit a folder: exit batch, let peek handle it
                    v_next_seek := v_current.name;
                    EXIT;
                END IF;

                -- Emit file
                name := v_current.name;
                id := v_current.id;
                updated_at := v_current.updated_at;
                created_at := v_current.created_at;
                last_accessed_at := v_current.last_accessed_at;
                metadata := v_current.metadata;
                RETURN NEXT;
                v_count := v_count + 1;

                -- Advance seek past this file
                IF v_is_asc THEN
                    v_next_seek := v_current.name || delimiter_param;
                ELSE
                    v_next_seek := v_current.name;
                END IF;

                EXIT WHEN v_count >= max_keys;
            END LOOP;
        END IF;
    END LOOP;
END;
$_$;


--
-- Name: operation(); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.operation() RETURNS text
    LANGUAGE plpgsql STABLE
    AS $$
BEGIN
    RETURN current_setting('storage.operation', true);
END;
$$;


--
-- Name: protect_delete(); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.protect_delete() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    -- Check if storage.allow_delete_query is set to 'true'
    IF COALESCE(current_setting('storage.allow_delete_query', true), 'false') != 'true' THEN
        RAISE EXCEPTION 'Direct deletion from storage tables is not allowed. Use the Storage API instead.'
            USING HINT = 'This prevents accidental data loss from orphaned objects.',
                  ERRCODE = '42501';
    END IF;
    RETURN NULL;
END;
$$;


--
-- Name: search(text, text, integer, integer, integer, text, text, text); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.search(prefix text, bucketname text, limits integer DEFAULT 100, levels integer DEFAULT 1, offsets integer DEFAULT 0, search text DEFAULT ''::text, sortcolumn text DEFAULT 'name'::text, sortorder text DEFAULT 'asc'::text) RETURNS TABLE(name text, id uuid, updated_at timestamp with time zone, created_at timestamp with time zone, last_accessed_at timestamp with time zone, metadata jsonb)
    LANGUAGE plpgsql STABLE
    AS $_$
DECLARE
    v_peek_name TEXT;
    v_current RECORD;
    v_common_prefix TEXT;
    v_delimiter CONSTANT TEXT := '/';

    -- Configuration
    v_limit INT;
    v_prefix TEXT;
    v_prefix_lower TEXT;
    v_is_asc BOOLEAN;
    v_order_by TEXT;
    v_sort_order TEXT;
    v_upper_bound TEXT;
    v_file_batch_size INT;

    -- Dynamic SQL for batch query only
    v_batch_query TEXT;

    -- Seek state
    v_next_seek TEXT;
    v_count INT := 0;
    v_skipped INT := 0;
BEGIN
    -- ========================================================================
    -- INITIALIZATION
    -- ========================================================================
    v_limit := LEAST(coalesce(limits, 100), 1500);
    v_prefix := coalesce(prefix, '') || coalesce(search, '');
    v_prefix_lower := lower(v_prefix);
    v_is_asc := lower(coalesce(sortorder, 'asc')) = 'asc';
    v_file_batch_size := LEAST(GREATEST(v_limit * 2, 100), 1000);

    -- Validate sort column
    CASE lower(coalesce(sortcolumn, 'name'))
        WHEN 'name' THEN v_order_by := 'name';
        WHEN 'updated_at' THEN v_order_by := 'updated_at';
        WHEN 'created_at' THEN v_order_by := 'created_at';
        WHEN 'last_accessed_at' THEN v_order_by := 'last_accessed_at';
        ELSE v_order_by := 'name';
    END CASE;

    v_sort_order := CASE WHEN v_is_asc THEN 'asc' ELSE 'desc' END;

    -- ========================================================================
    -- NON-NAME SORTING: Use path_tokens approach (unchanged)
    -- ========================================================================
    IF v_order_by != 'name' THEN
        RETURN QUERY EXECUTE format(
            $sql$
            WITH folders AS (
                SELECT path_tokens[$1] AS folder
                FROM storage.objects
                WHERE objects.name ILIKE $2 || '%%'
                  AND bucket_id = $3
                  AND array_length(objects.path_tokens, 1) <> $1
                GROUP BY folder
                ORDER BY folder %s
            )
            (SELECT folder AS "name",
                   NULL::uuid AS id,
                   NULL::timestamptz AS updated_at,
                   NULL::timestamptz AS created_at,
                   NULL::timestamptz AS last_accessed_at,
                   NULL::jsonb AS metadata FROM folders)
            UNION ALL
            (SELECT path_tokens[$1] AS "name",
                   id, updated_at, created_at, last_accessed_at, metadata
             FROM storage.objects
             WHERE objects.name ILIKE $2 || '%%'
               AND bucket_id = $3
               AND array_length(objects.path_tokens, 1) = $1
             ORDER BY %I %s)
            LIMIT $4 OFFSET $5
            $sql$, v_sort_order, v_order_by, v_sort_order
        ) USING levels, v_prefix, bucketname, v_limit, offsets;
        RETURN;
    END IF;

    -- ========================================================================
    -- NAME SORTING: Hybrid skip-scan with batch optimization
    -- ========================================================================

    -- Calculate upper bound for prefix filtering
    IF v_prefix_lower = '' THEN
        v_upper_bound := NULL;
    ELSIF right(v_prefix_lower, 1) = v_delimiter THEN
        v_upper_bound := left(v_prefix_lower, -1) || chr(ascii(v_delimiter) + 1);
    ELSE
        v_upper_bound := left(v_prefix_lower, -1) || chr(ascii(right(v_prefix_lower, 1)) + 1);
    END IF;

    -- Build batch query (dynamic SQL - called infrequently, amortized over many rows)
    IF v_is_asc THEN
        IF v_upper_bound IS NOT NULL THEN
            v_batch_query := 'SELECT o.name, o.id, o.updated_at, o.created_at, o.last_accessed_at, o.metadata ' ||
                'FROM storage.objects o WHERE o.bucket_id = $1 AND lower(o.name) COLLATE "C" >= $2 ' ||
                'AND lower(o.name) COLLATE "C" < $3 ORDER BY lower(o.name) COLLATE "C" ASC LIMIT $4';
        ELSE
            v_batch_query := 'SELECT o.name, o.id, o.updated_at, o.created_at, o.last_accessed_at, o.metadata ' ||
                'FROM storage.objects o WHERE o.bucket_id = $1 AND lower(o.name) COLLATE "C" >= $2 ' ||
                'ORDER BY lower(o.name) COLLATE "C" ASC LIMIT $4';
        END IF;
    ELSE
        IF v_upper_bound IS NOT NULL THEN
            v_batch_query := 'SELECT o.name, o.id, o.updated_at, o.created_at, o.last_accessed_at, o.metadata ' ||
                'FROM storage.objects o WHERE o.bucket_id = $1 AND lower(o.name) COLLATE "C" < $2 ' ||
                'AND lower(o.name) COLLATE "C" >= $3 ORDER BY lower(o.name) COLLATE "C" DESC LIMIT $4';
        ELSE
            v_batch_query := 'SELECT o.name, o.id, o.updated_at, o.created_at, o.last_accessed_at, o.metadata ' ||
                'FROM storage.objects o WHERE o.bucket_id = $1 AND lower(o.name) COLLATE "C" < $2 ' ||
                'ORDER BY lower(o.name) COLLATE "C" DESC LIMIT $4';
        END IF;
    END IF;

    -- Initialize seek position
    IF v_is_asc THEN
        v_next_seek := v_prefix_lower;
    ELSE
        -- DESC: find the last item in range first (static SQL)
        IF v_upper_bound IS NOT NULL THEN
            SELECT o.name INTO v_peek_name FROM storage.objects o
            WHERE o.bucket_id = bucketname AND lower(o.name) COLLATE "C" >= v_prefix_lower AND lower(o.name) COLLATE "C" < v_upper_bound
            ORDER BY lower(o.name) COLLATE "C" DESC LIMIT 1;
        ELSIF v_prefix_lower <> '' THEN
            SELECT o.name INTO v_peek_name FROM storage.objects o
            WHERE o.bucket_id = bucketname AND lower(o.name) COLLATE "C" >= v_prefix_lower
            ORDER BY lower(o.name) COLLATE "C" DESC LIMIT 1;
        ELSE
            SELECT o.name INTO v_peek_name FROM storage.objects o
            WHERE o.bucket_id = bucketname
            ORDER BY lower(o.name) COLLATE "C" DESC LIMIT 1;
        END IF;

        IF v_peek_name IS NOT NULL THEN
            v_next_seek := lower(v_peek_name) || v_delimiter;
        ELSE
            RETURN;
        END IF;
    END IF;

    -- ========================================================================
    -- MAIN LOOP: Hybrid peek-then-batch algorithm
    -- Uses STATIC SQL for peek (hot path) and DYNAMIC SQL for batch
    -- ========================================================================
    LOOP
        EXIT WHEN v_count >= v_limit;

        -- STEP 1: PEEK using STATIC SQL (plan cached, very fast)
        IF v_is_asc THEN
            IF v_upper_bound IS NOT NULL THEN
                SELECT o.name INTO v_peek_name FROM storage.objects o
                WHERE o.bucket_id = bucketname AND lower(o.name) COLLATE "C" >= v_next_seek AND lower(o.name) COLLATE "C" < v_upper_bound
                ORDER BY lower(o.name) COLLATE "C" ASC LIMIT 1;
            ELSE
                SELECT o.name INTO v_peek_name FROM storage.objects o
                WHERE o.bucket_id = bucketname AND lower(o.name) COLLATE "C" >= v_next_seek
                ORDER BY lower(o.name) COLLATE "C" ASC LIMIT 1;
            END IF;
        ELSE
            IF v_upper_bound IS NOT NULL THEN
                SELECT o.name INTO v_peek_name FROM storage.objects o
                WHERE o.bucket_id = bucketname AND lower(o.name) COLLATE "C" < v_next_seek AND lower(o.name) COLLATE "C" >= v_prefix_lower
                ORDER BY lower(o.name) COLLATE "C" DESC LIMIT 1;
            ELSIF v_prefix_lower <> '' THEN
                SELECT o.name INTO v_peek_name FROM storage.objects o
                WHERE o.bucket_id = bucketname AND lower(o.name) COLLATE "C" < v_next_seek AND lower(o.name) COLLATE "C" >= v_prefix_lower
                ORDER BY lower(o.name) COLLATE "C" DESC LIMIT 1;
            ELSE
                SELECT o.name INTO v_peek_name FROM storage.objects o
                WHERE o.bucket_id = bucketname AND lower(o.name) COLLATE "C" < v_next_seek
                ORDER BY lower(o.name) COLLATE "C" DESC LIMIT 1;
            END IF;
        END IF;

        EXIT WHEN v_peek_name IS NULL;

        -- STEP 2: Check if this is a FOLDER or FILE
        v_common_prefix := storage.get_common_prefix(lower(v_peek_name), v_prefix_lower, v_delimiter);

        IF v_common_prefix IS NOT NULL THEN
            -- FOLDER: Handle offset, emit if needed, skip to next folder
            IF v_skipped < offsets THEN
                v_skipped := v_skipped + 1;
            ELSE
                name := split_part(rtrim(storage.get_common_prefix(v_peek_name, v_prefix, v_delimiter), v_delimiter), v_delimiter, levels);
                id := NULL;
                updated_at := NULL;
                created_at := NULL;
                last_accessed_at := NULL;
                metadata := NULL;
                RETURN NEXT;
                v_count := v_count + 1;
            END IF;

            -- Advance seek past the folder range
            IF v_is_asc THEN
                v_next_seek := lower(left(v_common_prefix, -1)) || chr(ascii(v_delimiter) + 1);
            ELSE
                v_next_seek := lower(v_common_prefix);
            END IF;
        ELSE
            -- FILE: Batch fetch using DYNAMIC SQL (overhead amortized over many rows)
            -- For ASC: upper_bound is the exclusive upper limit (< condition)
            -- For DESC: prefix_lower is the inclusive lower limit (>= condition)
            FOR v_current IN EXECUTE v_batch_query
                USING bucketname, v_next_seek,
                    CASE WHEN v_is_asc THEN COALESCE(v_upper_bound, v_prefix_lower) ELSE v_prefix_lower END, v_file_batch_size
            LOOP
                v_common_prefix := storage.get_common_prefix(lower(v_current.name), v_prefix_lower, v_delimiter);

                IF v_common_prefix IS NOT NULL THEN
                    -- Hit a folder: exit batch, let peek handle it
                    v_next_seek := lower(v_current.name);
                    EXIT;
                END IF;

                -- Handle offset skipping
                IF v_skipped < offsets THEN
                    v_skipped := v_skipped + 1;
                ELSE
                    -- Emit file
                    name := split_part(v_current.name, v_delimiter, levels);
                    id := v_current.id;
                    updated_at := v_current.updated_at;
                    created_at := v_current.created_at;
                    last_accessed_at := v_current.last_accessed_at;
                    metadata := v_current.metadata;
                    RETURN NEXT;
                    v_count := v_count + 1;
                END IF;

                -- Advance seek past this file
                IF v_is_asc THEN
                    v_next_seek := lower(v_current.name) || v_delimiter;
                ELSE
                    v_next_seek := lower(v_current.name);
                END IF;

                EXIT WHEN v_count >= v_limit;
            END LOOP;
        END IF;
    END LOOP;
END;
$_$;


--
-- Name: search_by_timestamp(text, text, integer, integer, text, text, text, text); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.search_by_timestamp(p_prefix text, p_bucket_id text, p_limit integer, p_level integer, p_start_after text, p_sort_order text, p_sort_column text, p_sort_column_after text) RETURNS TABLE(key text, name text, id uuid, updated_at timestamp with time zone, created_at timestamp with time zone, last_accessed_at timestamp with time zone, metadata jsonb)
    LANGUAGE plpgsql STABLE
    AS $_$
DECLARE
    v_cursor_op text;
    v_query text;
    v_prefix text;
BEGIN
    v_prefix := coalesce(p_prefix, '');

    IF p_sort_order = 'asc' THEN
        v_cursor_op := '>';
    ELSE
        v_cursor_op := '<';
    END IF;

    v_query := format($sql$
        WITH raw_objects AS (
            SELECT
                o.name AS obj_name,
                o.id AS obj_id,
                o.updated_at AS obj_updated_at,
                o.created_at AS obj_created_at,
                o.last_accessed_at AS obj_last_accessed_at,
                o.metadata AS obj_metadata,
                storage.get_common_prefix(o.name, $1, '/') AS common_prefix
            FROM storage.objects o
            WHERE o.bucket_id = $2
              AND o.name COLLATE "C" LIKE $1 || '%%'
        ),
        -- Aggregate common prefixes (folders)
        -- Both created_at and updated_at use MIN(obj_created_at) to match the old prefixes table behavior
        aggregated_prefixes AS (
            SELECT
                rtrim(common_prefix, '/') AS name,
                NULL::uuid AS id,
                MIN(obj_created_at) AS updated_at,
                MIN(obj_created_at) AS created_at,
                NULL::timestamptz AS last_accessed_at,
                NULL::jsonb AS metadata,
                TRUE AS is_prefix
            FROM raw_objects
            WHERE common_prefix IS NOT NULL
            GROUP BY common_prefix
        ),
        leaf_objects AS (
            SELECT
                obj_name AS name,
                obj_id AS id,
                obj_updated_at AS updated_at,
                obj_created_at AS created_at,
                obj_last_accessed_at AS last_accessed_at,
                obj_metadata AS metadata,
                FALSE AS is_prefix
            FROM raw_objects
            WHERE common_prefix IS NULL
        ),
        combined AS (
            SELECT * FROM aggregated_prefixes
            UNION ALL
            SELECT * FROM leaf_objects
        ),
        filtered AS (
            SELECT *
            FROM combined
            WHERE (
                $5 = ''
                OR ROW(
                    date_trunc('milliseconds', %I),
                    name COLLATE "C"
                ) %s ROW(
                    COALESCE(NULLIF($6, '')::timestamptz, 'epoch'::timestamptz),
                    $5
                )
            )
        )
        SELECT
            split_part(name, '/', $3) AS key,
            name,
            id,
            updated_at,
            created_at,
            last_accessed_at,
            metadata
        FROM filtered
        ORDER BY
            COALESCE(date_trunc('milliseconds', %I), 'epoch'::timestamptz) %s,
            name COLLATE "C" %s
        LIMIT $4
    $sql$,
        p_sort_column,
        v_cursor_op,
        p_sort_column,
        p_sort_order,
        p_sort_order
    );

    RETURN QUERY EXECUTE v_query
    USING v_prefix, p_bucket_id, p_level, p_limit, p_start_after, p_sort_column_after;
END;
$_$;


--
-- Name: search_v2(text, text, integer, integer, text, text, text, text); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.search_v2(prefix text, bucket_name text, limits integer DEFAULT 100, levels integer DEFAULT 1, start_after text DEFAULT ''::text, sort_order text DEFAULT 'asc'::text, sort_column text DEFAULT 'name'::text, sort_column_after text DEFAULT ''::text) RETURNS TABLE(key text, name text, id uuid, updated_at timestamp with time zone, created_at timestamp with time zone, last_accessed_at timestamp with time zone, metadata jsonb)
    LANGUAGE plpgsql STABLE
    AS $$
DECLARE
    v_sort_col text;
    v_sort_ord text;
    v_limit int;
BEGIN
    -- Cap limit to maximum of 1500 records
    v_limit := LEAST(coalesce(limits, 100), 1500);

    -- Validate and normalize sort_order
    v_sort_ord := lower(coalesce(sort_order, 'asc'));
    IF v_sort_ord NOT IN ('asc', 'desc') THEN
        v_sort_ord := 'asc';
    END IF;

    -- Validate and normalize sort_column
    v_sort_col := lower(coalesce(sort_column, 'name'));
    IF v_sort_col NOT IN ('name', 'updated_at', 'created_at') THEN
        v_sort_col := 'name';
    END IF;

    -- Route to appropriate implementation
    IF v_sort_col = 'name' THEN
        -- Use list_objects_with_delimiter for name sorting (most efficient: O(k * log n))
        RETURN QUERY
        SELECT
            split_part(l.name, '/', levels) AS key,
            l.name AS name,
            l.id,
            l.updated_at,
            l.created_at,
            l.last_accessed_at,
            l.metadata
        FROM storage.list_objects_with_delimiter(
            bucket_name,
            coalesce(prefix, ''),
            '/',
            v_limit,
            start_after,
            '',
            v_sort_ord
        ) l;
    ELSE
        -- Use aggregation approach for timestamp sorting
        -- Not efficient for large datasets but supports correct pagination
        RETURN QUERY SELECT * FROM storage.search_by_timestamp(
            prefix, bucket_name, v_limit, levels, start_after,
            v_sort_ord, v_sort_col, sort_column_after
        );
    END IF;
END;
$$;


--
-- Name: update_updated_at_column(); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.update_updated_at_column() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW; 
END;
$$;


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: audit_log_entries; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.audit_log_entries (
    instance_id uuid,
    id uuid NOT NULL,
    payload json,
    created_at timestamp with time zone,
    ip_address character varying(64) DEFAULT ''::character varying NOT NULL
);


--
-- Name: TABLE audit_log_entries; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON TABLE auth.audit_log_entries IS 'Auth: Audit trail for user actions.';


--
-- Name: custom_oauth_providers; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.custom_oauth_providers (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    provider_type text NOT NULL,
    identifier text NOT NULL,
    name text NOT NULL,
    client_id text NOT NULL,
    client_secret text NOT NULL,
    acceptable_client_ids text[] DEFAULT '{}'::text[] NOT NULL,
    scopes text[] DEFAULT '{}'::text[] NOT NULL,
    pkce_enabled boolean DEFAULT true NOT NULL,
    attribute_mapping jsonb DEFAULT '{}'::jsonb NOT NULL,
    authorization_params jsonb DEFAULT '{}'::jsonb NOT NULL,
    enabled boolean DEFAULT true NOT NULL,
    email_optional boolean DEFAULT false NOT NULL,
    issuer text,
    discovery_url text,
    skip_nonce_check boolean DEFAULT false NOT NULL,
    cached_discovery jsonb,
    discovery_cached_at timestamp with time zone,
    authorization_url text,
    token_url text,
    userinfo_url text,
    jwks_uri text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    custom_claims_allowlist text[] DEFAULT '{}'::text[] NOT NULL,
    CONSTRAINT custom_oauth_providers_authorization_url_https CHECK (((authorization_url IS NULL) OR (authorization_url ~~ 'https://%'::text))),
    CONSTRAINT custom_oauth_providers_authorization_url_length CHECK (((authorization_url IS NULL) OR (char_length(authorization_url) <= 2048))),
    CONSTRAINT custom_oauth_providers_client_id_length CHECK (((char_length(client_id) >= 1) AND (char_length(client_id) <= 512))),
    CONSTRAINT custom_oauth_providers_discovery_url_length CHECK (((discovery_url IS NULL) OR (char_length(discovery_url) <= 2048))),
    CONSTRAINT custom_oauth_providers_identifier_format CHECK ((identifier ~ '^[a-z0-9][a-z0-9:-]{0,48}[a-z0-9]$'::text)),
    CONSTRAINT custom_oauth_providers_issuer_length CHECK (((issuer IS NULL) OR ((char_length(issuer) >= 1) AND (char_length(issuer) <= 2048)))),
    CONSTRAINT custom_oauth_providers_jwks_uri_https CHECK (((jwks_uri IS NULL) OR (jwks_uri ~~ 'https://%'::text))),
    CONSTRAINT custom_oauth_providers_jwks_uri_length CHECK (((jwks_uri IS NULL) OR (char_length(jwks_uri) <= 2048))),
    CONSTRAINT custom_oauth_providers_name_length CHECK (((char_length(name) >= 1) AND (char_length(name) <= 100))),
    CONSTRAINT custom_oauth_providers_oauth2_requires_endpoints CHECK (((provider_type <> 'oauth2'::text) OR ((authorization_url IS NOT NULL) AND (token_url IS NOT NULL) AND (userinfo_url IS NOT NULL)))),
    CONSTRAINT custom_oauth_providers_oidc_discovery_url_https CHECK (((provider_type <> 'oidc'::text) OR (discovery_url IS NULL) OR (discovery_url ~~ 'https://%'::text))),
    CONSTRAINT custom_oauth_providers_oidc_issuer_https CHECK (((provider_type <> 'oidc'::text) OR (issuer IS NULL) OR (issuer ~~ 'https://%'::text))),
    CONSTRAINT custom_oauth_providers_oidc_requires_issuer CHECK (((provider_type <> 'oidc'::text) OR (issuer IS NOT NULL))),
    CONSTRAINT custom_oauth_providers_provider_type_check CHECK ((provider_type = ANY (ARRAY['oauth2'::text, 'oidc'::text]))),
    CONSTRAINT custom_oauth_providers_token_url_https CHECK (((token_url IS NULL) OR (token_url ~~ 'https://%'::text))),
    CONSTRAINT custom_oauth_providers_token_url_length CHECK (((token_url IS NULL) OR (char_length(token_url) <= 2048))),
    CONSTRAINT custom_oauth_providers_userinfo_url_https CHECK (((userinfo_url IS NULL) OR (userinfo_url ~~ 'https://%'::text))),
    CONSTRAINT custom_oauth_providers_userinfo_url_length CHECK (((userinfo_url IS NULL) OR (char_length(userinfo_url) <= 2048)))
);


--
-- Name: flow_state; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.flow_state (
    id uuid NOT NULL,
    user_id uuid,
    auth_code text,
    code_challenge_method auth.code_challenge_method,
    code_challenge text,
    provider_type text NOT NULL,
    provider_access_token text,
    provider_refresh_token text,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    authentication_method text NOT NULL,
    auth_code_issued_at timestamp with time zone,
    invite_token text,
    referrer text,
    oauth_client_state_id uuid,
    linking_target_id uuid,
    email_optional boolean DEFAULT false NOT NULL
);


--
-- Name: TABLE flow_state; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON TABLE auth.flow_state IS 'Stores metadata for all OAuth/SSO login flows';


--
-- Name: identities; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.identities (
    provider_id text NOT NULL,
    user_id uuid NOT NULL,
    identity_data jsonb NOT NULL,
    provider text NOT NULL,
    last_sign_in_at timestamp with time zone,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    email text GENERATED ALWAYS AS (lower((identity_data ->> 'email'::text))) STORED,
    id uuid DEFAULT gen_random_uuid() NOT NULL
);


--
-- Name: TABLE identities; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON TABLE auth.identities IS 'Auth: Stores identities associated to a user.';


--
-- Name: COLUMN identities.email; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON COLUMN auth.identities.email IS 'Auth: Email is a generated column that references the optional email property in the identity_data';


--
-- Name: instances; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.instances (
    id uuid NOT NULL,
    uuid uuid,
    raw_base_config text,
    created_at timestamp with time zone,
    updated_at timestamp with time zone
);


--
-- Name: TABLE instances; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON TABLE auth.instances IS 'Auth: Manages users across multiple sites.';


--
-- Name: mfa_amr_claims; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.mfa_amr_claims (
    session_id uuid NOT NULL,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL,
    authentication_method text NOT NULL,
    id uuid NOT NULL
);


--
-- Name: TABLE mfa_amr_claims; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON TABLE auth.mfa_amr_claims IS 'auth: stores authenticator method reference claims for multi factor authentication';


--
-- Name: mfa_challenges; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.mfa_challenges (
    id uuid NOT NULL,
    factor_id uuid NOT NULL,
    created_at timestamp with time zone NOT NULL,
    verified_at timestamp with time zone,
    ip_address inet NOT NULL,
    otp_code text,
    web_authn_session_data jsonb
);


--
-- Name: TABLE mfa_challenges; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON TABLE auth.mfa_challenges IS 'auth: stores metadata about challenge requests made';


--
-- Name: mfa_factors; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.mfa_factors (
    id uuid NOT NULL,
    user_id uuid NOT NULL,
    friendly_name text,
    factor_type auth.factor_type NOT NULL,
    status auth.factor_status NOT NULL,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL,
    secret text,
    phone text,
    last_challenged_at timestamp with time zone,
    web_authn_credential jsonb,
    web_authn_aaguid uuid,
    last_webauthn_challenge_data jsonb
);


--
-- Name: TABLE mfa_factors; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON TABLE auth.mfa_factors IS 'auth: stores metadata about factors';


--
-- Name: COLUMN mfa_factors.last_webauthn_challenge_data; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON COLUMN auth.mfa_factors.last_webauthn_challenge_data IS 'Stores the latest WebAuthn challenge data including attestation/assertion for customer verification';


--
-- Name: oauth_authorizations; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.oauth_authorizations (
    id uuid NOT NULL,
    authorization_id text NOT NULL,
    client_id uuid NOT NULL,
    user_id uuid,
    redirect_uri text NOT NULL,
    scope text NOT NULL,
    state text,
    resource text,
    code_challenge text,
    code_challenge_method auth.code_challenge_method,
    response_type auth.oauth_response_type DEFAULT 'code'::auth.oauth_response_type NOT NULL,
    status auth.oauth_authorization_status DEFAULT 'pending'::auth.oauth_authorization_status NOT NULL,
    authorization_code text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    expires_at timestamp with time zone DEFAULT (now() + '00:03:00'::interval) NOT NULL,
    approved_at timestamp with time zone,
    nonce text,
    CONSTRAINT oauth_authorizations_authorization_code_length CHECK ((char_length(authorization_code) <= 255)),
    CONSTRAINT oauth_authorizations_code_challenge_length CHECK ((char_length(code_challenge) <= 128)),
    CONSTRAINT oauth_authorizations_expires_at_future CHECK ((expires_at > created_at)),
    CONSTRAINT oauth_authorizations_nonce_length CHECK ((char_length(nonce) <= 255)),
    CONSTRAINT oauth_authorizations_redirect_uri_length CHECK ((char_length(redirect_uri) <= 2048)),
    CONSTRAINT oauth_authorizations_resource_length CHECK ((char_length(resource) <= 2048)),
    CONSTRAINT oauth_authorizations_scope_length CHECK ((char_length(scope) <= 4096)),
    CONSTRAINT oauth_authorizations_state_length CHECK ((char_length(state) <= 4096))
);


--
-- Name: oauth_client_states; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.oauth_client_states (
    id uuid NOT NULL,
    provider_type text NOT NULL,
    code_verifier text,
    created_at timestamp with time zone NOT NULL
);


--
-- Name: TABLE oauth_client_states; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON TABLE auth.oauth_client_states IS 'Stores OAuth states for third-party provider authentication flows where Supabase acts as the OAuth client.';


--
-- Name: oauth_clients; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.oauth_clients (
    id uuid NOT NULL,
    client_secret_hash text,
    registration_type auth.oauth_registration_type NOT NULL,
    redirect_uris text NOT NULL,
    grant_types text NOT NULL,
    client_name text,
    client_uri text,
    logo_uri text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    client_type auth.oauth_client_type DEFAULT 'confidential'::auth.oauth_client_type NOT NULL,
    token_endpoint_auth_method text NOT NULL,
    CONSTRAINT oauth_clients_client_name_length CHECK ((char_length(client_name) <= 1024)),
    CONSTRAINT oauth_clients_client_uri_length CHECK ((char_length(client_uri) <= 2048)),
    CONSTRAINT oauth_clients_logo_uri_length CHECK ((char_length(logo_uri) <= 2048)),
    CONSTRAINT oauth_clients_token_endpoint_auth_method_check CHECK ((token_endpoint_auth_method = ANY (ARRAY['client_secret_basic'::text, 'client_secret_post'::text, 'none'::text])))
);


--
-- Name: oauth_consents; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.oauth_consents (
    id uuid NOT NULL,
    user_id uuid NOT NULL,
    client_id uuid NOT NULL,
    scopes text NOT NULL,
    granted_at timestamp with time zone DEFAULT now() NOT NULL,
    revoked_at timestamp with time zone,
    CONSTRAINT oauth_consents_revoked_after_granted CHECK (((revoked_at IS NULL) OR (revoked_at >= granted_at))),
    CONSTRAINT oauth_consents_scopes_length CHECK ((char_length(scopes) <= 2048)),
    CONSTRAINT oauth_consents_scopes_not_empty CHECK ((char_length(TRIM(BOTH FROM scopes)) > 0))
);


--
-- Name: one_time_tokens; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.one_time_tokens (
    id uuid NOT NULL,
    user_id uuid NOT NULL,
    token_type auth.one_time_token_type NOT NULL,
    token_hash text NOT NULL,
    relates_to text NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    CONSTRAINT one_time_tokens_token_hash_check CHECK ((char_length(token_hash) > 0))
);


--
-- Name: refresh_tokens; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.refresh_tokens (
    instance_id uuid,
    id bigint NOT NULL,
    token character varying(255),
    user_id character varying(255),
    revoked boolean,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    parent character varying(255),
    session_id uuid
);


--
-- Name: TABLE refresh_tokens; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON TABLE auth.refresh_tokens IS 'Auth: Store of tokens used to refresh JWT tokens once they expire.';


--
-- Name: refresh_tokens_id_seq; Type: SEQUENCE; Schema: auth; Owner: -
--

CREATE SEQUENCE auth.refresh_tokens_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: refresh_tokens_id_seq; Type: SEQUENCE OWNED BY; Schema: auth; Owner: -
--

ALTER SEQUENCE auth.refresh_tokens_id_seq OWNED BY auth.refresh_tokens.id;


--
-- Name: saml_providers; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.saml_providers (
    id uuid NOT NULL,
    sso_provider_id uuid NOT NULL,
    entity_id text NOT NULL,
    metadata_xml text NOT NULL,
    metadata_url text,
    attribute_mapping jsonb,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    name_id_format text,
    CONSTRAINT "entity_id not empty" CHECK ((char_length(entity_id) > 0)),
    CONSTRAINT "metadata_url not empty" CHECK (((metadata_url = NULL::text) OR (char_length(metadata_url) > 0))),
    CONSTRAINT "metadata_xml not empty" CHECK ((char_length(metadata_xml) > 0))
);


--
-- Name: TABLE saml_providers; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON TABLE auth.saml_providers IS 'Auth: Manages SAML Identity Provider connections.';


--
-- Name: saml_relay_states; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.saml_relay_states (
    id uuid NOT NULL,
    sso_provider_id uuid NOT NULL,
    request_id text NOT NULL,
    for_email text,
    redirect_to text,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    flow_state_id uuid,
    CONSTRAINT "request_id not empty" CHECK ((char_length(request_id) > 0))
);


--
-- Name: TABLE saml_relay_states; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON TABLE auth.saml_relay_states IS 'Auth: Contains SAML Relay State information for each Service Provider initiated login.';


--
-- Name: schema_migrations; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.schema_migrations (
    version character varying(255) NOT NULL
);


--
-- Name: TABLE schema_migrations; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON TABLE auth.schema_migrations IS 'Auth: Manages updates to the auth system.';


--
-- Name: sessions; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.sessions (
    id uuid NOT NULL,
    user_id uuid NOT NULL,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    factor_id uuid,
    aal auth.aal_level,
    not_after timestamp with time zone,
    refreshed_at timestamp without time zone,
    user_agent text,
    ip inet,
    tag text,
    oauth_client_id uuid,
    refresh_token_hmac_key text,
    refresh_token_counter bigint,
    scopes text,
    CONSTRAINT sessions_scopes_length CHECK ((char_length(scopes) <= 4096))
);


--
-- Name: TABLE sessions; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON TABLE auth.sessions IS 'Auth: Stores session data associated to a user.';


--
-- Name: COLUMN sessions.not_after; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON COLUMN auth.sessions.not_after IS 'Auth: Not after is a nullable column that contains a timestamp after which the session should be regarded as expired.';


--
-- Name: COLUMN sessions.refresh_token_hmac_key; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON COLUMN auth.sessions.refresh_token_hmac_key IS 'Holds a HMAC-SHA256 key used to sign refresh tokens for this session.';


--
-- Name: COLUMN sessions.refresh_token_counter; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON COLUMN auth.sessions.refresh_token_counter IS 'Holds the ID (counter) of the last issued refresh token.';


--
-- Name: sso_domains; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.sso_domains (
    id uuid NOT NULL,
    sso_provider_id uuid NOT NULL,
    domain text NOT NULL,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    CONSTRAINT "domain not empty" CHECK ((char_length(domain) > 0))
);


--
-- Name: TABLE sso_domains; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON TABLE auth.sso_domains IS 'Auth: Manages SSO email address domain mapping to an SSO Identity Provider.';


--
-- Name: sso_providers; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.sso_providers (
    id uuid NOT NULL,
    resource_id text,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    disabled boolean,
    CONSTRAINT "resource_id not empty" CHECK (((resource_id = NULL::text) OR (char_length(resource_id) > 0)))
);


--
-- Name: TABLE sso_providers; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON TABLE auth.sso_providers IS 'Auth: Manages SSO identity provider information; see saml_providers for SAML.';


--
-- Name: COLUMN sso_providers.resource_id; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON COLUMN auth.sso_providers.resource_id IS 'Auth: Uniquely identifies a SSO provider according to a user-chosen resource ID (case insensitive), useful in infrastructure as code.';


--
-- Name: users; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.users (
    instance_id uuid,
    id uuid NOT NULL,
    aud character varying(255),
    role character varying(255),
    email character varying(255),
    encrypted_password character varying(255),
    email_confirmed_at timestamp with time zone,
    invited_at timestamp with time zone,
    confirmation_token character varying(255),
    confirmation_sent_at timestamp with time zone,
    recovery_token character varying(255),
    recovery_sent_at timestamp with time zone,
    email_change_token_new character varying(255),
    email_change character varying(255),
    email_change_sent_at timestamp with time zone,
    last_sign_in_at timestamp with time zone,
    raw_app_meta_data jsonb,
    raw_user_meta_data jsonb,
    is_super_admin boolean,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    phone text DEFAULT NULL::character varying,
    phone_confirmed_at timestamp with time zone,
    phone_change text DEFAULT ''::character varying,
    phone_change_token character varying(255) DEFAULT ''::character varying,
    phone_change_sent_at timestamp with time zone,
    confirmed_at timestamp with time zone GENERATED ALWAYS AS (LEAST(email_confirmed_at, phone_confirmed_at)) STORED,
    email_change_token_current character varying(255) DEFAULT ''::character varying,
    email_change_confirm_status smallint DEFAULT 0,
    banned_until timestamp with time zone,
    reauthentication_token character varying(255) DEFAULT ''::character varying,
    reauthentication_sent_at timestamp with time zone,
    is_sso_user boolean DEFAULT false NOT NULL,
    deleted_at timestamp with time zone,
    is_anonymous boolean DEFAULT false NOT NULL,
    CONSTRAINT users_email_change_confirm_status_check CHECK (((email_change_confirm_status >= 0) AND (email_change_confirm_status <= 2)))
);


--
-- Name: TABLE users; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON TABLE auth.users IS 'Auth: Stores user login data within a secure schema.';


--
-- Name: COLUMN users.is_sso_user; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON COLUMN auth.users.is_sso_user IS 'Auth: Set this column to true when the account comes from SSO. These accounts can have duplicate emails.';


--
-- Name: webauthn_challenges; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.webauthn_challenges (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid,
    challenge_type text NOT NULL,
    session_data jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    expires_at timestamp with time zone NOT NULL,
    CONSTRAINT webauthn_challenges_challenge_type_check CHECK ((challenge_type = ANY (ARRAY['signup'::text, 'registration'::text, 'authentication'::text])))
);


--
-- Name: webauthn_credentials; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.webauthn_credentials (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    credential_id bytea NOT NULL,
    public_key bytea NOT NULL,
    attestation_type text DEFAULT ''::text NOT NULL,
    aaguid uuid,
    sign_count bigint DEFAULT 0 NOT NULL,
    transports jsonb DEFAULT '[]'::jsonb NOT NULL,
    backup_eligible boolean DEFAULT false NOT NULL,
    backed_up boolean DEFAULT false NOT NULL,
    friendly_name text DEFAULT ''::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    last_used_at timestamp with time zone
);


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
-- Name: buckets; Type: TABLE; Schema: storage; Owner: -
--

CREATE TABLE storage.buckets (
    id text NOT NULL,
    name text NOT NULL,
    owner uuid,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    public boolean DEFAULT false,
    avif_autodetection boolean DEFAULT false,
    file_size_limit bigint,
    allowed_mime_types text[],
    owner_id text,
    type storage.buckettype DEFAULT 'STANDARD'::storage.buckettype NOT NULL
);


--
-- Name: COLUMN buckets.owner; Type: COMMENT; Schema: storage; Owner: -
--

COMMENT ON COLUMN storage.buckets.owner IS 'Field is deprecated, use owner_id instead';


--
-- Name: buckets_analytics; Type: TABLE; Schema: storage; Owner: -
--

CREATE TABLE storage.buckets_analytics (
    name text NOT NULL,
    type storage.buckettype DEFAULT 'ANALYTICS'::storage.buckettype NOT NULL,
    format text DEFAULT 'ICEBERG'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    deleted_at timestamp with time zone
);


--
-- Name: buckets_vectors; Type: TABLE; Schema: storage; Owner: -
--

CREATE TABLE storage.buckets_vectors (
    id text NOT NULL,
    type storage.buckettype DEFAULT 'VECTOR'::storage.buckettype NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: migrations; Type: TABLE; Schema: storage; Owner: -
--

CREATE TABLE storage.migrations (
    id integer NOT NULL,
    name character varying(100) NOT NULL,
    hash character varying(40) NOT NULL,
    executed_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: objects; Type: TABLE; Schema: storage; Owner: -
--

CREATE TABLE storage.objects (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    bucket_id text,
    name text,
    owner uuid,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    last_accessed_at timestamp with time zone DEFAULT now(),
    metadata jsonb,
    path_tokens text[] GENERATED ALWAYS AS (string_to_array(name, '/'::text)) STORED,
    version text,
    owner_id text,
    user_metadata jsonb
);


--
-- Name: COLUMN objects.owner; Type: COMMENT; Schema: storage; Owner: -
--

COMMENT ON COLUMN storage.objects.owner IS 'Field is deprecated, use owner_id instead';


--
-- Name: s3_multipart_uploads; Type: TABLE; Schema: storage; Owner: -
--

CREATE TABLE storage.s3_multipart_uploads (
    id text NOT NULL,
    in_progress_size bigint DEFAULT 0 NOT NULL,
    upload_signature text NOT NULL,
    bucket_id text NOT NULL,
    key text NOT NULL COLLATE pg_catalog."C",
    version text NOT NULL,
    owner_id text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    user_metadata jsonb,
    metadata jsonb
);


--
-- Name: s3_multipart_uploads_parts; Type: TABLE; Schema: storage; Owner: -
--

CREATE TABLE storage.s3_multipart_uploads_parts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    upload_id text NOT NULL,
    size bigint DEFAULT 0 NOT NULL,
    part_number integer NOT NULL,
    bucket_id text NOT NULL,
    key text NOT NULL COLLATE pg_catalog."C",
    etag text NOT NULL,
    owner_id text,
    version text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: vector_indexes; Type: TABLE; Schema: storage; Owner: -
--

CREATE TABLE storage.vector_indexes (
    id text DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL COLLATE pg_catalog."C",
    bucket_id text NOT NULL,
    data_type text NOT NULL,
    dimension integer NOT NULL,
    distance_metric text NOT NULL,
    metadata_configuration jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: refresh_tokens id; Type: DEFAULT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.refresh_tokens ALTER COLUMN id SET DEFAULT nextval('auth.refresh_tokens_id_seq'::regclass);


--
-- Name: mfa_amr_claims amr_id_pk; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.mfa_amr_claims
    ADD CONSTRAINT amr_id_pk PRIMARY KEY (id);


--
-- Name: audit_log_entries audit_log_entries_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.audit_log_entries
    ADD CONSTRAINT audit_log_entries_pkey PRIMARY KEY (id);


--
-- Name: custom_oauth_providers custom_oauth_providers_identifier_key; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.custom_oauth_providers
    ADD CONSTRAINT custom_oauth_providers_identifier_key UNIQUE (identifier);


--
-- Name: custom_oauth_providers custom_oauth_providers_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.custom_oauth_providers
    ADD CONSTRAINT custom_oauth_providers_pkey PRIMARY KEY (id);


--
-- Name: flow_state flow_state_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.flow_state
    ADD CONSTRAINT flow_state_pkey PRIMARY KEY (id);


--
-- Name: identities identities_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.identities
    ADD CONSTRAINT identities_pkey PRIMARY KEY (id);


--
-- Name: identities identities_provider_id_provider_unique; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.identities
    ADD CONSTRAINT identities_provider_id_provider_unique UNIQUE (provider_id, provider);


--
-- Name: instances instances_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.instances
    ADD CONSTRAINT instances_pkey PRIMARY KEY (id);


--
-- Name: mfa_amr_claims mfa_amr_claims_session_id_authentication_method_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.mfa_amr_claims
    ADD CONSTRAINT mfa_amr_claims_session_id_authentication_method_pkey UNIQUE (session_id, authentication_method);


--
-- Name: mfa_challenges mfa_challenges_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.mfa_challenges
    ADD CONSTRAINT mfa_challenges_pkey PRIMARY KEY (id);


--
-- Name: mfa_factors mfa_factors_last_challenged_at_key; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.mfa_factors
    ADD CONSTRAINT mfa_factors_last_challenged_at_key UNIQUE (last_challenged_at);


--
-- Name: mfa_factors mfa_factors_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.mfa_factors
    ADD CONSTRAINT mfa_factors_pkey PRIMARY KEY (id);


--
-- Name: oauth_authorizations oauth_authorizations_authorization_code_key; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.oauth_authorizations
    ADD CONSTRAINT oauth_authorizations_authorization_code_key UNIQUE (authorization_code);


--
-- Name: oauth_authorizations oauth_authorizations_authorization_id_key; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.oauth_authorizations
    ADD CONSTRAINT oauth_authorizations_authorization_id_key UNIQUE (authorization_id);


--
-- Name: oauth_authorizations oauth_authorizations_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.oauth_authorizations
    ADD CONSTRAINT oauth_authorizations_pkey PRIMARY KEY (id);


--
-- Name: oauth_client_states oauth_client_states_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.oauth_client_states
    ADD CONSTRAINT oauth_client_states_pkey PRIMARY KEY (id);


--
-- Name: oauth_clients oauth_clients_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.oauth_clients
    ADD CONSTRAINT oauth_clients_pkey PRIMARY KEY (id);


--
-- Name: oauth_consents oauth_consents_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.oauth_consents
    ADD CONSTRAINT oauth_consents_pkey PRIMARY KEY (id);


--
-- Name: oauth_consents oauth_consents_user_client_unique; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.oauth_consents
    ADD CONSTRAINT oauth_consents_user_client_unique UNIQUE (user_id, client_id);


--
-- Name: one_time_tokens one_time_tokens_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.one_time_tokens
    ADD CONSTRAINT one_time_tokens_pkey PRIMARY KEY (id);


--
-- Name: refresh_tokens refresh_tokens_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.refresh_tokens
    ADD CONSTRAINT refresh_tokens_pkey PRIMARY KEY (id);


--
-- Name: refresh_tokens refresh_tokens_token_unique; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.refresh_tokens
    ADD CONSTRAINT refresh_tokens_token_unique UNIQUE (token);


--
-- Name: saml_providers saml_providers_entity_id_key; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.saml_providers
    ADD CONSTRAINT saml_providers_entity_id_key UNIQUE (entity_id);


--
-- Name: saml_providers saml_providers_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.saml_providers
    ADD CONSTRAINT saml_providers_pkey PRIMARY KEY (id);


--
-- Name: saml_relay_states saml_relay_states_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.saml_relay_states
    ADD CONSTRAINT saml_relay_states_pkey PRIMARY KEY (id);


--
-- Name: schema_migrations schema_migrations_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.schema_migrations
    ADD CONSTRAINT schema_migrations_pkey PRIMARY KEY (version);


--
-- Name: sessions sessions_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.sessions
    ADD CONSTRAINT sessions_pkey PRIMARY KEY (id);


--
-- Name: sso_domains sso_domains_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.sso_domains
    ADD CONSTRAINT sso_domains_pkey PRIMARY KEY (id);


--
-- Name: sso_providers sso_providers_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.sso_providers
    ADD CONSTRAINT sso_providers_pkey PRIMARY KEY (id);


--
-- Name: users users_phone_key; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.users
    ADD CONSTRAINT users_phone_key UNIQUE (phone);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: webauthn_challenges webauthn_challenges_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.webauthn_challenges
    ADD CONSTRAINT webauthn_challenges_pkey PRIMARY KEY (id);


--
-- Name: webauthn_credentials webauthn_credentials_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.webauthn_credentials
    ADD CONSTRAINT webauthn_credentials_pkey PRIMARY KEY (id);


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
-- Name: buckets_analytics buckets_analytics_pkey; Type: CONSTRAINT; Schema: storage; Owner: -
--

ALTER TABLE ONLY storage.buckets_analytics
    ADD CONSTRAINT buckets_analytics_pkey PRIMARY KEY (id);


--
-- Name: buckets buckets_pkey; Type: CONSTRAINT; Schema: storage; Owner: -
--

ALTER TABLE ONLY storage.buckets
    ADD CONSTRAINT buckets_pkey PRIMARY KEY (id);


--
-- Name: buckets_vectors buckets_vectors_pkey; Type: CONSTRAINT; Schema: storage; Owner: -
--

ALTER TABLE ONLY storage.buckets_vectors
    ADD CONSTRAINT buckets_vectors_pkey PRIMARY KEY (id);


--
-- Name: migrations migrations_name_key; Type: CONSTRAINT; Schema: storage; Owner: -
--

ALTER TABLE ONLY storage.migrations
    ADD CONSTRAINT migrations_name_key UNIQUE (name);


--
-- Name: migrations migrations_pkey; Type: CONSTRAINT; Schema: storage; Owner: -
--

ALTER TABLE ONLY storage.migrations
    ADD CONSTRAINT migrations_pkey PRIMARY KEY (id);


--
-- Name: objects objects_pkey; Type: CONSTRAINT; Schema: storage; Owner: -
--

ALTER TABLE ONLY storage.objects
    ADD CONSTRAINT objects_pkey PRIMARY KEY (id);


--
-- Name: s3_multipart_uploads_parts s3_multipart_uploads_parts_pkey; Type: CONSTRAINT; Schema: storage; Owner: -
--

ALTER TABLE ONLY storage.s3_multipart_uploads_parts
    ADD CONSTRAINT s3_multipart_uploads_parts_pkey PRIMARY KEY (id);


--
-- Name: s3_multipart_uploads s3_multipart_uploads_pkey; Type: CONSTRAINT; Schema: storage; Owner: -
--

ALTER TABLE ONLY storage.s3_multipart_uploads
    ADD CONSTRAINT s3_multipart_uploads_pkey PRIMARY KEY (id);


--
-- Name: vector_indexes vector_indexes_pkey; Type: CONSTRAINT; Schema: storage; Owner: -
--

ALTER TABLE ONLY storage.vector_indexes
    ADD CONSTRAINT vector_indexes_pkey PRIMARY KEY (id);


--
-- Name: audit_logs_instance_id_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX audit_logs_instance_id_idx ON auth.audit_log_entries USING btree (instance_id);


--
-- Name: confirmation_token_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE UNIQUE INDEX confirmation_token_idx ON auth.users USING btree (confirmation_token) WHERE ((confirmation_token)::text !~ '^[0-9 ]*$'::text);


--
-- Name: custom_oauth_providers_created_at_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX custom_oauth_providers_created_at_idx ON auth.custom_oauth_providers USING btree (created_at);


--
-- Name: custom_oauth_providers_enabled_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX custom_oauth_providers_enabled_idx ON auth.custom_oauth_providers USING btree (enabled);


--
-- Name: custom_oauth_providers_identifier_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX custom_oauth_providers_identifier_idx ON auth.custom_oauth_providers USING btree (identifier);


--
-- Name: custom_oauth_providers_provider_type_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX custom_oauth_providers_provider_type_idx ON auth.custom_oauth_providers USING btree (provider_type);


--
-- Name: email_change_token_current_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE UNIQUE INDEX email_change_token_current_idx ON auth.users USING btree (email_change_token_current) WHERE ((email_change_token_current)::text !~ '^[0-9 ]*$'::text);


--
-- Name: email_change_token_new_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE UNIQUE INDEX email_change_token_new_idx ON auth.users USING btree (email_change_token_new) WHERE ((email_change_token_new)::text !~ '^[0-9 ]*$'::text);


--
-- Name: factor_id_created_at_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX factor_id_created_at_idx ON auth.mfa_factors USING btree (user_id, created_at);


--
-- Name: flow_state_created_at_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX flow_state_created_at_idx ON auth.flow_state USING btree (created_at DESC);


--
-- Name: identities_email_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX identities_email_idx ON auth.identities USING btree (email text_pattern_ops);


--
-- Name: INDEX identities_email_idx; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON INDEX auth.identities_email_idx IS 'Auth: Ensures indexed queries on the email column';


--
-- Name: identities_user_id_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX identities_user_id_idx ON auth.identities USING btree (user_id);


--
-- Name: idx_auth_code; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX idx_auth_code ON auth.flow_state USING btree (auth_code);


--
-- Name: idx_oauth_client_states_created_at; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX idx_oauth_client_states_created_at ON auth.oauth_client_states USING btree (created_at);


--
-- Name: idx_user_id_auth_method; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX idx_user_id_auth_method ON auth.flow_state USING btree (user_id, authentication_method);


--
-- Name: idx_users_created_at_desc; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX idx_users_created_at_desc ON auth.users USING btree (created_at DESC);


--
-- Name: idx_users_email; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX idx_users_email ON auth.users USING btree (email);


--
-- Name: idx_users_last_sign_in_at_desc; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX idx_users_last_sign_in_at_desc ON auth.users USING btree (last_sign_in_at DESC);


--
-- Name: idx_users_name; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX idx_users_name ON auth.users USING btree (((raw_user_meta_data ->> 'name'::text))) WHERE ((raw_user_meta_data ->> 'name'::text) IS NOT NULL);


--
-- Name: mfa_challenge_created_at_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX mfa_challenge_created_at_idx ON auth.mfa_challenges USING btree (created_at DESC);


--
-- Name: mfa_factors_user_friendly_name_unique; Type: INDEX; Schema: auth; Owner: -
--

CREATE UNIQUE INDEX mfa_factors_user_friendly_name_unique ON auth.mfa_factors USING btree (friendly_name, user_id) WHERE (TRIM(BOTH FROM friendly_name) <> ''::text);


--
-- Name: mfa_factors_user_id_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX mfa_factors_user_id_idx ON auth.mfa_factors USING btree (user_id);


--
-- Name: oauth_auth_pending_exp_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX oauth_auth_pending_exp_idx ON auth.oauth_authorizations USING btree (expires_at) WHERE (status = 'pending'::auth.oauth_authorization_status);


--
-- Name: oauth_clients_deleted_at_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX oauth_clients_deleted_at_idx ON auth.oauth_clients USING btree (deleted_at);


--
-- Name: oauth_consents_active_client_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX oauth_consents_active_client_idx ON auth.oauth_consents USING btree (client_id) WHERE (revoked_at IS NULL);


--
-- Name: oauth_consents_active_user_client_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX oauth_consents_active_user_client_idx ON auth.oauth_consents USING btree (user_id, client_id) WHERE (revoked_at IS NULL);


--
-- Name: oauth_consents_user_order_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX oauth_consents_user_order_idx ON auth.oauth_consents USING btree (user_id, granted_at DESC);


--
-- Name: one_time_tokens_relates_to_hash_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX one_time_tokens_relates_to_hash_idx ON auth.one_time_tokens USING hash (relates_to);


--
-- Name: one_time_tokens_token_hash_hash_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX one_time_tokens_token_hash_hash_idx ON auth.one_time_tokens USING hash (token_hash);


--
-- Name: one_time_tokens_user_id_token_type_key; Type: INDEX; Schema: auth; Owner: -
--

CREATE UNIQUE INDEX one_time_tokens_user_id_token_type_key ON auth.one_time_tokens USING btree (user_id, token_type);


--
-- Name: reauthentication_token_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE UNIQUE INDEX reauthentication_token_idx ON auth.users USING btree (reauthentication_token) WHERE ((reauthentication_token)::text !~ '^[0-9 ]*$'::text);


--
-- Name: recovery_token_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE UNIQUE INDEX recovery_token_idx ON auth.users USING btree (recovery_token) WHERE ((recovery_token)::text !~ '^[0-9 ]*$'::text);


--
-- Name: refresh_tokens_instance_id_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX refresh_tokens_instance_id_idx ON auth.refresh_tokens USING btree (instance_id);


--
-- Name: refresh_tokens_instance_id_user_id_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX refresh_tokens_instance_id_user_id_idx ON auth.refresh_tokens USING btree (instance_id, user_id);


--
-- Name: refresh_tokens_parent_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX refresh_tokens_parent_idx ON auth.refresh_tokens USING btree (parent);


--
-- Name: refresh_tokens_session_id_revoked_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX refresh_tokens_session_id_revoked_idx ON auth.refresh_tokens USING btree (session_id, revoked);


--
-- Name: refresh_tokens_updated_at_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX refresh_tokens_updated_at_idx ON auth.refresh_tokens USING btree (updated_at DESC);


--
-- Name: saml_providers_sso_provider_id_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX saml_providers_sso_provider_id_idx ON auth.saml_providers USING btree (sso_provider_id);


--
-- Name: saml_relay_states_created_at_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX saml_relay_states_created_at_idx ON auth.saml_relay_states USING btree (created_at DESC);


--
-- Name: saml_relay_states_for_email_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX saml_relay_states_for_email_idx ON auth.saml_relay_states USING btree (for_email);


--
-- Name: saml_relay_states_sso_provider_id_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX saml_relay_states_sso_provider_id_idx ON auth.saml_relay_states USING btree (sso_provider_id);


--
-- Name: sessions_not_after_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX sessions_not_after_idx ON auth.sessions USING btree (not_after DESC);


--
-- Name: sessions_oauth_client_id_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX sessions_oauth_client_id_idx ON auth.sessions USING btree (oauth_client_id);


--
-- Name: sessions_user_id_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX sessions_user_id_idx ON auth.sessions USING btree (user_id);


--
-- Name: sso_domains_domain_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE UNIQUE INDEX sso_domains_domain_idx ON auth.sso_domains USING btree (lower(domain));


--
-- Name: sso_domains_sso_provider_id_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX sso_domains_sso_provider_id_idx ON auth.sso_domains USING btree (sso_provider_id);


--
-- Name: sso_providers_resource_id_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE UNIQUE INDEX sso_providers_resource_id_idx ON auth.sso_providers USING btree (lower(resource_id));


--
-- Name: sso_providers_resource_id_pattern_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX sso_providers_resource_id_pattern_idx ON auth.sso_providers USING btree (resource_id text_pattern_ops);


--
-- Name: unique_phone_factor_per_user; Type: INDEX; Schema: auth; Owner: -
--

CREATE UNIQUE INDEX unique_phone_factor_per_user ON auth.mfa_factors USING btree (user_id, phone);


--
-- Name: user_id_created_at_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX user_id_created_at_idx ON auth.sessions USING btree (user_id, created_at);


--
-- Name: users_email_partial_key; Type: INDEX; Schema: auth; Owner: -
--

CREATE UNIQUE INDEX users_email_partial_key ON auth.users USING btree (email) WHERE (is_sso_user = false);


--
-- Name: INDEX users_email_partial_key; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON INDEX auth.users_email_partial_key IS 'Auth: A partial unique index that applies only when is_sso_user is false';


--
-- Name: users_instance_id_email_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX users_instance_id_email_idx ON auth.users USING btree (instance_id, lower((email)::text));


--
-- Name: users_instance_id_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX users_instance_id_idx ON auth.users USING btree (instance_id);


--
-- Name: users_is_anonymous_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX users_is_anonymous_idx ON auth.users USING btree (is_anonymous);


--
-- Name: webauthn_challenges_expires_at_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX webauthn_challenges_expires_at_idx ON auth.webauthn_challenges USING btree (expires_at);


--
-- Name: webauthn_challenges_user_id_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX webauthn_challenges_user_id_idx ON auth.webauthn_challenges USING btree (user_id);


--
-- Name: webauthn_credentials_credential_id_key; Type: INDEX; Schema: auth; Owner: -
--

CREATE UNIQUE INDEX webauthn_credentials_credential_id_key ON auth.webauthn_credentials USING btree (credential_id);


--
-- Name: webauthn_credentials_user_id_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX webauthn_credentials_user_id_idx ON auth.webauthn_credentials USING btree (user_id);


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
-- Name: bname; Type: INDEX; Schema: storage; Owner: -
--

CREATE UNIQUE INDEX bname ON storage.buckets USING btree (name);


--
-- Name: bucketid_objname; Type: INDEX; Schema: storage; Owner: -
--

CREATE UNIQUE INDEX bucketid_objname ON storage.objects USING btree (bucket_id, name);


--
-- Name: buckets_analytics_unique_name_idx; Type: INDEX; Schema: storage; Owner: -
--

CREATE UNIQUE INDEX buckets_analytics_unique_name_idx ON storage.buckets_analytics USING btree (name) WHERE (deleted_at IS NULL);


--
-- Name: idx_multipart_uploads_list; Type: INDEX; Schema: storage; Owner: -
--

CREATE INDEX idx_multipart_uploads_list ON storage.s3_multipart_uploads USING btree (bucket_id, key, created_at);


--
-- Name: idx_objects_bucket_id_name; Type: INDEX; Schema: storage; Owner: -
--

CREATE INDEX idx_objects_bucket_id_name ON storage.objects USING btree (bucket_id, name COLLATE "C");


--
-- Name: idx_objects_bucket_id_name_lower; Type: INDEX; Schema: storage; Owner: -
--

CREATE INDEX idx_objects_bucket_id_name_lower ON storage.objects USING btree (bucket_id, lower(name) COLLATE "C");


--
-- Name: name_prefix_search; Type: INDEX; Schema: storage; Owner: -
--

CREATE INDEX name_prefix_search ON storage.objects USING btree (name text_pattern_ops);


--
-- Name: vector_indexes_name_bucket_id_idx; Type: INDEX; Schema: storage; Owner: -
--

CREATE UNIQUE INDEX vector_indexes_name_bucket_id_idx ON storage.vector_indexes USING btree (name, bucket_id);


--
-- Name: buckets enforce_bucket_name_length_trigger; Type: TRIGGER; Schema: storage; Owner: -
--

CREATE TRIGGER enforce_bucket_name_length_trigger BEFORE INSERT OR UPDATE OF name ON storage.buckets FOR EACH ROW EXECUTE FUNCTION storage.enforce_bucket_name_length();


--
-- Name: buckets protect_buckets_delete; Type: TRIGGER; Schema: storage; Owner: -
--

CREATE TRIGGER protect_buckets_delete BEFORE DELETE ON storage.buckets FOR EACH STATEMENT EXECUTE FUNCTION storage.protect_delete();


--
-- Name: objects protect_objects_delete; Type: TRIGGER; Schema: storage; Owner: -
--

CREATE TRIGGER protect_objects_delete BEFORE DELETE ON storage.objects FOR EACH STATEMENT EXECUTE FUNCTION storage.protect_delete();


--
-- Name: objects update_objects_updated_at; Type: TRIGGER; Schema: storage; Owner: -
--

CREATE TRIGGER update_objects_updated_at BEFORE UPDATE ON storage.objects FOR EACH ROW EXECUTE FUNCTION storage.update_updated_at_column();


--
-- Name: identities identities_user_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.identities
    ADD CONSTRAINT identities_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: mfa_amr_claims mfa_amr_claims_session_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.mfa_amr_claims
    ADD CONSTRAINT mfa_amr_claims_session_id_fkey FOREIGN KEY (session_id) REFERENCES auth.sessions(id) ON DELETE CASCADE;


--
-- Name: mfa_challenges mfa_challenges_auth_factor_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.mfa_challenges
    ADD CONSTRAINT mfa_challenges_auth_factor_id_fkey FOREIGN KEY (factor_id) REFERENCES auth.mfa_factors(id) ON DELETE CASCADE;


--
-- Name: mfa_factors mfa_factors_user_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.mfa_factors
    ADD CONSTRAINT mfa_factors_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: oauth_authorizations oauth_authorizations_client_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.oauth_authorizations
    ADD CONSTRAINT oauth_authorizations_client_id_fkey FOREIGN KEY (client_id) REFERENCES auth.oauth_clients(id) ON DELETE CASCADE;


--
-- Name: oauth_authorizations oauth_authorizations_user_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.oauth_authorizations
    ADD CONSTRAINT oauth_authorizations_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: oauth_consents oauth_consents_client_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.oauth_consents
    ADD CONSTRAINT oauth_consents_client_id_fkey FOREIGN KEY (client_id) REFERENCES auth.oauth_clients(id) ON DELETE CASCADE;


--
-- Name: oauth_consents oauth_consents_user_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.oauth_consents
    ADD CONSTRAINT oauth_consents_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: one_time_tokens one_time_tokens_user_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.one_time_tokens
    ADD CONSTRAINT one_time_tokens_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: refresh_tokens refresh_tokens_session_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.refresh_tokens
    ADD CONSTRAINT refresh_tokens_session_id_fkey FOREIGN KEY (session_id) REFERENCES auth.sessions(id) ON DELETE CASCADE;


--
-- Name: saml_providers saml_providers_sso_provider_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.saml_providers
    ADD CONSTRAINT saml_providers_sso_provider_id_fkey FOREIGN KEY (sso_provider_id) REFERENCES auth.sso_providers(id) ON DELETE CASCADE;


--
-- Name: saml_relay_states saml_relay_states_flow_state_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.saml_relay_states
    ADD CONSTRAINT saml_relay_states_flow_state_id_fkey FOREIGN KEY (flow_state_id) REFERENCES auth.flow_state(id) ON DELETE CASCADE;


--
-- Name: saml_relay_states saml_relay_states_sso_provider_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.saml_relay_states
    ADD CONSTRAINT saml_relay_states_sso_provider_id_fkey FOREIGN KEY (sso_provider_id) REFERENCES auth.sso_providers(id) ON DELETE CASCADE;


--
-- Name: sessions sessions_oauth_client_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.sessions
    ADD CONSTRAINT sessions_oauth_client_id_fkey FOREIGN KEY (oauth_client_id) REFERENCES auth.oauth_clients(id) ON DELETE CASCADE;


--
-- Name: sessions sessions_user_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.sessions
    ADD CONSTRAINT sessions_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: sso_domains sso_domains_sso_provider_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.sso_domains
    ADD CONSTRAINT sso_domains_sso_provider_id_fkey FOREIGN KEY (sso_provider_id) REFERENCES auth.sso_providers(id) ON DELETE CASCADE;


--
-- Name: webauthn_challenges webauthn_challenges_user_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.webauthn_challenges
    ADD CONSTRAINT webauthn_challenges_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: webauthn_credentials webauthn_credentials_user_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.webauthn_credentials
    ADD CONSTRAINT webauthn_credentials_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


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
-- Name: objects objects_bucketId_fkey; Type: FK CONSTRAINT; Schema: storage; Owner: -
--

ALTER TABLE ONLY storage.objects
    ADD CONSTRAINT "objects_bucketId_fkey" FOREIGN KEY (bucket_id) REFERENCES storage.buckets(id);


--
-- Name: s3_multipart_uploads s3_multipart_uploads_bucket_id_fkey; Type: FK CONSTRAINT; Schema: storage; Owner: -
--

ALTER TABLE ONLY storage.s3_multipart_uploads
    ADD CONSTRAINT s3_multipart_uploads_bucket_id_fkey FOREIGN KEY (bucket_id) REFERENCES storage.buckets(id);


--
-- Name: s3_multipart_uploads_parts s3_multipart_uploads_parts_bucket_id_fkey; Type: FK CONSTRAINT; Schema: storage; Owner: -
--

ALTER TABLE ONLY storage.s3_multipart_uploads_parts
    ADD CONSTRAINT s3_multipart_uploads_parts_bucket_id_fkey FOREIGN KEY (bucket_id) REFERENCES storage.buckets(id);


--
-- Name: s3_multipart_uploads_parts s3_multipart_uploads_parts_upload_id_fkey; Type: FK CONSTRAINT; Schema: storage; Owner: -
--

ALTER TABLE ONLY storage.s3_multipart_uploads_parts
    ADD CONSTRAINT s3_multipart_uploads_parts_upload_id_fkey FOREIGN KEY (upload_id) REFERENCES storage.s3_multipart_uploads(id) ON DELETE CASCADE;


--
-- Name: vector_indexes vector_indexes_bucket_id_fkey; Type: FK CONSTRAINT; Schema: storage; Owner: -
--

ALTER TABLE ONLY storage.vector_indexes
    ADD CONSTRAINT vector_indexes_bucket_id_fkey FOREIGN KEY (bucket_id) REFERENCES storage.buckets_vectors(id);


--
-- Name: audit_log_entries; Type: ROW SECURITY; Schema: auth; Owner: -
--

ALTER TABLE auth.audit_log_entries ENABLE ROW LEVEL SECURITY;

--
-- Name: flow_state; Type: ROW SECURITY; Schema: auth; Owner: -
--

ALTER TABLE auth.flow_state ENABLE ROW LEVEL SECURITY;

--
-- Name: identities; Type: ROW SECURITY; Schema: auth; Owner: -
--

ALTER TABLE auth.identities ENABLE ROW LEVEL SECURITY;

--
-- Name: instances; Type: ROW SECURITY; Schema: auth; Owner: -
--

ALTER TABLE auth.instances ENABLE ROW LEVEL SECURITY;

--
-- Name: mfa_amr_claims; Type: ROW SECURITY; Schema: auth; Owner: -
--

ALTER TABLE auth.mfa_amr_claims ENABLE ROW LEVEL SECURITY;

--
-- Name: mfa_challenges; Type: ROW SECURITY; Schema: auth; Owner: -
--

ALTER TABLE auth.mfa_challenges ENABLE ROW LEVEL SECURITY;

--
-- Name: mfa_factors; Type: ROW SECURITY; Schema: auth; Owner: -
--

ALTER TABLE auth.mfa_factors ENABLE ROW LEVEL SECURITY;

--
-- Name: one_time_tokens; Type: ROW SECURITY; Schema: auth; Owner: -
--

ALTER TABLE auth.one_time_tokens ENABLE ROW LEVEL SECURITY;

--
-- Name: refresh_tokens; Type: ROW SECURITY; Schema: auth; Owner: -
--

ALTER TABLE auth.refresh_tokens ENABLE ROW LEVEL SECURITY;

--
-- Name: saml_providers; Type: ROW SECURITY; Schema: auth; Owner: -
--

ALTER TABLE auth.saml_providers ENABLE ROW LEVEL SECURITY;

--
-- Name: saml_relay_states; Type: ROW SECURITY; Schema: auth; Owner: -
--

ALTER TABLE auth.saml_relay_states ENABLE ROW LEVEL SECURITY;

--
-- Name: schema_migrations; Type: ROW SECURITY; Schema: auth; Owner: -
--

ALTER TABLE auth.schema_migrations ENABLE ROW LEVEL SECURITY;

--
-- Name: sessions; Type: ROW SECURITY; Schema: auth; Owner: -
--

ALTER TABLE auth.sessions ENABLE ROW LEVEL SECURITY;

--
-- Name: sso_domains; Type: ROW SECURITY; Schema: auth; Owner: -
--

ALTER TABLE auth.sso_domains ENABLE ROW LEVEL SECURITY;

--
-- Name: sso_providers; Type: ROW SECURITY; Schema: auth; Owner: -
--

ALTER TABLE auth.sso_providers ENABLE ROW LEVEL SECURITY;

--
-- Name: users; Type: ROW SECURITY; Schema: auth; Owner: -
--

ALTER TABLE auth.users ENABLE ROW LEVEL SECURITY;

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
-- Name: draft_exams TEMP_DEBUG_allow_all_updates; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "TEMP_DEBUG_allow_all_updates" ON public.draft_exams FOR UPDATE USING (true) WITH CHECK (true);


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
-- Name: objects Admins can update school logo; Type: POLICY; Schema: storage; Owner: -
--

CREATE POLICY "Admins can update school logo" ON storage.objects FOR UPDATE USING (((bucket_id = 'school-logo'::text) AND ((EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'admin'::text)))) OR ((((auth.jwt() -> 'app_metadata'::text) ->> 'is_system_admin'::text))::boolean = true))));


--
-- Name: objects Admins can upload school logo; Type: POLICY; Schema: storage; Owner: -
--

CREATE POLICY "Admins can upload school logo" ON storage.objects FOR INSERT WITH CHECK (((bucket_id = 'school-logo'::text) AND ((EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'admin'::text)))) OR ((((auth.jwt() -> 'app_metadata'::text) ->> 'is_system_admin'::text))::boolean = true))));


--
-- Name: objects Anyone can view question images; Type: POLICY; Schema: storage; Owner: -
--

CREATE POLICY "Anyone can view question images" ON storage.objects FOR SELECT USING ((bucket_id = 'question-images'::text));


--
-- Name: objects Public read access to question media; Type: POLICY; Schema: storage; Owner: -
--

CREATE POLICY "Public read access to question media" ON storage.objects FOR SELECT USING ((bucket_id = 'question-media'::text));


--
-- Name: objects Public read access to school logo; Type: POLICY; Schema: storage; Owner: -
--

CREATE POLICY "Public read access to school logo" ON storage.objects FOR SELECT USING ((bucket_id = 'school-logo'::text));


--
-- Name: objects Public read access to task submissions; Type: POLICY; Schema: storage; Owner: -
--

CREATE POLICY "Public read access to task submissions" ON storage.objects FOR SELECT USING ((bucket_id = 'task-submissions'::text));


--
-- Name: objects Students update their own task submissions; Type: POLICY; Schema: storage; Owner: -
--

CREATE POLICY "Students update their own task submissions" ON storage.objects FOR UPDATE USING (((bucket_id = 'task-submissions'::text) AND (EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'student'::text))))));


--
-- Name: objects Students upload their own task submissions; Type: POLICY; Schema: storage; Owner: -
--

CREATE POLICY "Students upload their own task submissions" ON storage.objects FOR INSERT WITH CHECK (((bucket_id = 'task-submissions'::text) AND (EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'student'::text))))));


--
-- Name: objects Teachers can delete own question images; Type: POLICY; Schema: storage; Owner: -
--

CREATE POLICY "Teachers can delete own question images" ON storage.objects FOR DELETE USING (((bucket_id = 'question-images'::text) AND ((auth.uid())::text = (storage.foldername(name))[1])));


--
-- Name: objects Teachers can upload question images; Type: POLICY; Schema: storage; Owner: -
--

CREATE POLICY "Teachers can upload question images" ON storage.objects FOR INSERT WITH CHECK (((bucket_id = 'question-images'::text) AND (auth.role() = 'authenticated'::text)));


--
-- Name: objects Teachers update question media; Type: POLICY; Schema: storage; Owner: -
--

CREATE POLICY "Teachers update question media" ON storage.objects FOR UPDATE USING (((bucket_id = 'question-media'::text) AND (EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = ANY (ARRAY['teacher'::text, 'supervisor'::text, 'admin'::text])))))));


--
-- Name: objects Teachers upload question media; Type: POLICY; Schema: storage; Owner: -
--

CREATE POLICY "Teachers upload question media" ON storage.objects FOR INSERT WITH CHECK (((bucket_id = 'question-media'::text) AND (EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = ANY (ARRAY['teacher'::text, 'supervisor'::text, 'admin'::text])))))));


--
-- Name: buckets; Type: ROW SECURITY; Schema: storage; Owner: -
--

ALTER TABLE storage.buckets ENABLE ROW LEVEL SECURITY;

--
-- Name: buckets_analytics; Type: ROW SECURITY; Schema: storage; Owner: -
--

ALTER TABLE storage.buckets_analytics ENABLE ROW LEVEL SECURITY;

--
-- Name: buckets_vectors; Type: ROW SECURITY; Schema: storage; Owner: -
--

ALTER TABLE storage.buckets_vectors ENABLE ROW LEVEL SECURITY;

--
-- Name: migrations; Type: ROW SECURITY; Schema: storage; Owner: -
--

ALTER TABLE storage.migrations ENABLE ROW LEVEL SECURITY;

--
-- Name: objects; Type: ROW SECURITY; Schema: storage; Owner: -
--

ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

--
-- Name: s3_multipart_uploads; Type: ROW SECURITY; Schema: storage; Owner: -
--

ALTER TABLE storage.s3_multipart_uploads ENABLE ROW LEVEL SECURITY;

--
-- Name: s3_multipart_uploads_parts; Type: ROW SECURITY; Schema: storage; Owner: -
--

ALTER TABLE storage.s3_multipart_uploads_parts ENABLE ROW LEVEL SECURITY;

--
-- Name: vector_indexes; Type: ROW SECURITY; Schema: storage; Owner: -
--

ALTER TABLE storage.vector_indexes ENABLE ROW LEVEL SECURITY;

--
-- PostgreSQL database dump complete
--

\unrestrict TYwCT9LA9YzPVcJ0izpYGKhTkbPiYJWYG7Gjt5rkbIVhK0W3I7Jjc3OY2ypWgvO

