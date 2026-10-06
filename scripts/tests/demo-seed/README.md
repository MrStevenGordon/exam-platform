# Testing the demo seed

On a throwaway Postgres only (never a real database). Same recipe as `scripts/tests/exam-insight/README.md`: structure copied from a school database (`pg_dump --schema-only`), Supabase stand-ins for `auth`, `storage` (`scripts/tests/resources/storage-stub.sql`), then migrations 070 to 087, then:

```bash
psql -d demo -f scripts/tests/demo-seed/fixture.sql       # a stand-in Manchester: 4 test accounts, 2 Grade 9 classes, students with IDs like 3-1-5
psql -d demo -v ON_ERROR_STOP=1 -f scripts/demo/manchester-demo-seed.sql
psql -d demo -v ON_ERROR_STOP=1 -f scripts/demo/manchester-demo-seed.sql    # second run: still 170 sittings, no duplicates
psql -d demo -f scripts/demo/manchester-demo-remove.sql                       # every table back to 0 rows
```
Then sign in as each account (`set local role authenticated` and `request.jwt.claims`) and call the app's functions (`my_topic_results`, `learning_student_lessons`, `learning_student_catchup`, `exam_insight_list`, `exam_insight_data`, `learning_coverage`) and read `department_resources`. Grant the `authenticated` role table access first (the dump has no privileges).
