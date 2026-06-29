import http from 'k6/http';
import { check, sleep } from 'k6';
import { SharedArray } from 'k6/data';

const SUPABASE_URL = __ENV.SUPABASE_URL;
const SUPABASE_ANON_KEY = __ENV.SUPABASE_ANON_KEY;
const FINAL_EXAM_ID = __ENV.FINAL_EXAM_ID;

const students = new SharedArray('students', function () {
  return JSON.parse(open('./students.json'));
});

export const options = {
  scenarios: {
    concurrent_submissions: {
      executor: 'per-vu-iterations',
      vus: 50,
      iterations: 1,
      maxDuration: '2m',
    },
  },
};

export default function () {
  const student = students[(__VU - 1) % students.length];

  // 1. Log in
  const loginRes = http.post(
    `${SUPABASE_URL}/auth/v1/token?grant_type=password`,
    JSON.stringify({ email: student.email, password: student.password }),
    {
      headers: {
        'Content-Type': 'application/json',
        apikey: SUPABASE_ANON_KEY,
      },
    }
  );

  check(loginRes, { 'login succeeded': (r) => r.status === 200 });
  if (loginRes.status !== 200) {
    console.error(`Login failed for ${student.email}: ${loginRes.body}`);
    return;
  }

  const accessToken = loginRes.json('access_token');
  const userId = loginRes.json('user.id');

  const authHeaders = {
    'Content-Type': 'application/json',
    apikey: SUPABASE_ANON_KEY,
    Authorization: `Bearer ${accessToken}`,
  };

  // 2. Create or get exam session
  let sessionRes = http.get(
    `${SUPABASE_URL}/rest/v1/exam_sessions?final_exam_id=eq.${FINAL_EXAM_ID}&student_id=eq.${userId}&select=id,status`,
    { headers: authHeaders }
  );

  let sessionId;
  const existing = sessionRes.json();
  if (existing && existing.length > 0) {
    sessionId = existing[0].id;
  } else {
    const createRes = http.post(
      `${SUPABASE_URL}/rest/v1/exam_sessions`,
      JSON.stringify({
        final_exam_id: FINAL_EXAM_ID,
        student_id: userId,
        status: 'in_progress',
        started_at: new Date().toISOString(),
        time_limit_seconds: 3600,
      }),
      { headers: { ...authHeaders, Prefer: 'return=representation' } }
    );
    check(createRes, { 'session created': (r) => r.status === 201 });
    sessionId = createRes.json()[0]?.id;
  }

  if (!sessionId) {
    console.error(`No session for ${student.email}`);
    return;
  }

  sleep(Math.random() * 3); // stagger slightly, like real students reading questions

  // 3. Fetch questions for the exam
  const questionsRes = http.get(
    `${SUPABASE_URL}/rest/v1/final_exam_questions?final_exam_id=eq.${FINAL_EXAM_ID}&select=question_id,questions(id,question_type,correct_answer,points)`,
    { headers: authHeaders }
  );
  const links = questionsRes.json() || [];

  // 4. Submit responses (answer correctly half the time, to mix scoring)
  const rows = links.map((l) => {
    const q = l.questions;
    let answer = '';
    if (q.question_type === 'true_false') answer = Math.random() > 0.5 ? 'true' : q.correct_answer;
    else if (q.correct_answer) answer = Math.random() > 0.5 ? q.correct_answer : 'wrong';
    return {
      session_id: sessionId,
      question_id: q.id,
      answer,
      points_awarded: q.question_type === 'essay' ? null : (answer === q.correct_answer ? q.points : 0),
    };
  });

  if (rows.length > 0) {
    const insertRes = http.post(
      `${SUPABASE_URL}/rest/v1/responses`,
      JSON.stringify(rows),
      { headers: { ...authHeaders, Prefer: 'resolution=merge-duplicates' } }
    );
    check(insertRes, { 'responses submitted': (r) => r.status === 201 || r.status === 200 });
  }

  // 5. Mark session completed
  const completeRes = http.patch(
    `${SUPABASE_URL}/rest/v1/exam_sessions?id=eq.${sessionId}`,
    JSON.stringify({ status: 'completed', completed_at: new Date().toISOString() }),
    { headers: authHeaders }
  );
  check(completeRes, { 'session completed': (r) => r.status === 204 || r.status === 200 });
}
