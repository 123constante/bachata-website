# Brief: INVENTORY + real-shape survey of the PUBLIC organiser page (Sonnet, read-only, docs only)

Branch `claude/organiser-public-inventory`. Writes ONE file: `docs/inventory/organiser-public-page.md`. No source edits, no tests, no DB write (Supabase read-only: counts and function bodies only, no personal data).

Owner context 2026-11-02: "I like the design of the page roughly, but there seem to be some errors", and the "no upcoming events" area may not be needed. Decision recorded: hide the empty-upcoming box; show past events if any; if no events at all, one small line "No dates announced yet". Do not build it here.

## Do
1. INVENTORY (file:line for every row): the public organiser page route and components on current main; every field and section it shows; every state (loading, error, empty, claimed/unclaimed, with/without photo, cover, bio, links, team, events upcoming/past/none, cancelled); the same fields in the admin repo `123constante/bachata-admin` (organiser editor fields, read-only) and what the organiser's own area (src/modules/organiser) can edit. List GAPs (field editable but not shown, shown but not editable, shown wrongly). End with a coverage count: N rows, N shown, none silently omitted.
2. SHAPE SURVEY on prod (stsdtacfauprzrdebmzg, read-only SELECT counts): organisers by claimed x has-bio x has-photo x has-links x upcoming-events count (0, 1-5, more than 100) x past-events count (0, some) x cancelled. Which shapes have an empty upcoming box today.
3. ERRORS: read the page code for defects (wrong empty state, text pointing at a missing control, layout at 390x844, bad links, missing alt/aria, data mismatch with the RPC). Each: file:line, concrete failing shape, severity, CONFIRMED or PLAUSIBLE. Do not fix.
4. Output also a short "Questions only the owner can decide" list (product choices, not lookups).

BASE CHECK: `git fetch origin main`, branch from it, verify `git merge-base HEAD origin/main` equals `git rev-parse origin/main` before pushing. Context cap 50%. Handover is the file itself; last commit subject ends with the done marker from your prompt.
