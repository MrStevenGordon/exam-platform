# Exam insight (Smart Assess): what to switch on, in order

Exam insight shows a teacher which questions a class missed, which wrong answers were common, which students may need support, and how the class compares with its earlier tests. It reads results that already exist and writes nothing. There is no AI in it and nothing for students to see.

It needs **one database migration on each school's database**. There is no switch in the owner console and nothing to add in Vercel. Until the migration is applied, no Insight button or menu item appears anywhere.

## 1. Apply the migration (Manchester first)

1. In the school's Supabase **SQL editor**, run `scripts/migrations/080_exam_insight.sql`. Copy it with `pbcopy < scripts/migrations/080_exam_insight.sql`. You should see a row saying **Migration 080 applied**.
2. Push the code. Redeploy the school's Vercel project if it does not deploy by itself.

It adds three functions (`exam_insight_ready`, `exam_insight_data`, `exam_insight_list`) and changes nothing that exists. Applying it twice is safe.

## 2. Where people find it

| Person | Where |
|---|---|
| Teacher | **Tests** or **My Classes**, button **Exam insight**; and **Insight** on a test's results page |
| Head of department | **Analytics**, tab **Exam Insight**; or the same buttons as a teacher |
| School admin | Sidebar, **Exam Insight** (under Analytics & Integrity) |
| Principal, vice principal | Sidebar, **Exam Insight** (read only) |

## 3. Who sees what

- **Teacher who set a test:** every student who sat it.
- **Class teacher on a school exam:** only the students they teach in that subject, even when the whole year group sat it.
- **Head of department:** everything in their own department.
- **School admin and principal:** everything. Principals could not read raw exam results before; this gives them a read-only view.
- **Students, inactive accounts, other departments:** refused.

Earlier tests used for "down on their average" and "class over time" are only ones the person could already see.

## 4. Topic scores

Topic scores use the topic on each question. If a test's questions have no topic the page says so and shows no topic scores. To see how many of a school's questions have a topic, run this in the school's SQL editor (read only):

```sql
select count(*) filter (where topic_id is not null) as tagged_with_topic,
       count(*) filter (where topic_id is null and topic is not null and btrim(topic) <> '') as free_text_topic_only,
       count(*) as all_questions
from public.questions;
```

## Undoing it

`scripts/migrations/rollback/080_exam_insight_rollback.sql` removes the three functions. The Insight buttons and menu items then hide themselves.

## For developers: the tests

The checks live in `scripts/tests/exam-insight/` and run on a private copy of the database, never on a real school. See the README there.
