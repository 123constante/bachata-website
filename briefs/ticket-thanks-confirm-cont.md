# Brief: CONTINUATION of ticket-thanks-confirm (Website, NORMAL lane, Sonnet)

Branch `claude/ticket-thanks-confirm` ALREADY has your predecessor's commit e2aa14ca (PARTIAL). Do NOT start from main: `git fetch origin claude/ticket-thanks-confirm` and check it out, then read `docs/design/ticket-thanks-confirm-handover.md` and the original brief `briefs/ticket-thanks-confirm.md` on `brief/ticket-thanks-confirm`. PR #1121 is already open for this branch; the context cap is 30% so stay lean: read only the files the diff touches.

## Still to do (from the handover's "Not done")
1. Read the RPC body on admin: `git clone --depth 1 --branch main https://github.com/123constante/bachata-admin` is not possible in your sandbox, so use the Supabase connector (SELECT only): `select pg_get_functiondef('public.ticket_order_public_status_v1(text)'::regprocedure);` The function is APPLIED in prod and merged (admin #1105). Confirm `parseOrderStatus` matches its real return shape `{status, ticket_count, event_title, event_date}` plus `retry_later` when rate limited. Fix any mismatch.
2. Polling budget: poll at 2, 4, 8 seconds then every 15 seconds, at most 8 polls (the function allows 120 calls per IP per hour). Check the code and tests do exactly that; stop on unmount.
3. `npm run check:bundle-budget` main vs branch (+0 bytes to the dancer-app first load).
4. The 390x844 e2e for the thank-you card (card, links and tap targets inside the viewport, text visible).
5. Run every CI job step that applies (read `.github/workflows`), put the per-job table and a Verified / Not verified block in the PR #1121 body (edit with `gh pr edit 1121 --body-file`).
6. Keep the design record `docs/design/ticket-thanks-confirm.md` linked in the PR body.

Push once at the end (final subject ends with the worker-done marker). Do not add labels.
