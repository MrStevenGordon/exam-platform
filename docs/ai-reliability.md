# AI reliability (how Smart Assess Ja talks to Claude)

All AI features go through one place so an API problem is handled once, not five times.

- `src/lib/ai.ts` makes the call. It retries busy, dropped-connection and server errors (up to 2 retries, short waits), never retries things a retry cannot fix (bad key, no credit, unknown model, too large), and labels every failure with a `kind`.
- `src/lib/aiCall.ts` (`askClaude`) is what routes use. It reads the key, turns each `kind` into a plain message for the person at the screen (never the provider's raw text), and sends an alert to Sentry for the three kinds that need a person: `invalid_key`, `no_credit`, `bad_model`. Alerts are tagged `ai_problem` and sent at most once per kind per 10 minutes.
- The model used by new features is the one constant `AI_MODEL` in `src/lib/ai.ts`. Older routes keep the model they were tested with (named in each route).
- Run `npm run check:ai` any time: it tests the key and every model the app uses. To test the key that is on Vercel: `ANTHROPIC_API_KEY=sk-ant-... npm run check:ai`.
- Tests: `npm run test:ai`.

## Things only the account owner can do (Anthropic Console)
1. Billing: turn on auto-reload so credit never runs to zero, and set a low-balance email.
2. Usage limits / alerts: set a monthly spend alert.
3. Keep ONE key for the app. If it is replaced, change it in both Vercel projects (Manchester and exam-platform) and redeploy.

## Sentry
Create an alert rule on the tag `ai_problem` so an email arrives the first time any of the three needs-a-person problems occurs.
