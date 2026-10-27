# Brief: ROUND 1 review of PR #1082 (P3 W3a Name and details + Prices, one save model) -- READ-ONLY, findings doc only

Repo 123constante/bachata-website. Review branch `claude/p3-w3a-details` (head 4da101f) against `main`. You did not build it (an Opus worker did). You write ONE file on branch `claude/review-1082-r1`: `docs/reviews/1082-r1.md`. No source edits, no tests added, no DB write (Supabase read-only: counts and function bodies only, no personal data).

## Read
`git fetch origin claude/p3-w3a-details` then `git diff origin/main...FETCH_HEAD --stat` (ignore any Bristol/city files: they are #1056, already on main; if the stat shows them, your `main` is stale, fetch `origin main` first). Then: `src/modules/organiser/p3/model/saveModel.ts`, `p3/screens/EditTray.tsx`, `DetailsScreen.tsx`, `PricesScreen.tsx`, `p3/data/details.ts`, `p3/data/prices.ts`, the About rows in `EventPage.tsx`, the SessionSheet / LineupSheet changes (nits A/B/C), `shared/seriesCommands.ts` (`groupChatCommand`, `OWNER_COMMAND_KINDS`), `events/eventModel.ts`, `docs/design/1082.md`, `docs/session-handover-2026-10-27-p3-w3a-details.md`. Brief it was built from: `docs/briefs/p3-w3a-details.md` on `brief/p3-w3a-details`. Old-area code it must agree with: `src/modules/organiser/events/Details.tsx`, `PaymentEdit.tsx`, `paymentModel.ts`, `seriesExtras.ts`, `linkRules.ts`, `venueOverride.ts`.

## Judge (find real defects; do not restate the PR)
1. Save correctness: for a series.upsert save, what exactly is sent? Read the prod `series.upsert` handler and `_snapshot_series_p5` read-only. Does an untouched save send NOTHING? Does a one-field edit send only that field, or can it overwrite another field with a stale or defaulted value (e.g. a price list, passes, music, venue, group chat url)? Is `expected_version` sent; does retry reuse the idempotency key AND the version; does a stale version keep the typing and offer reload?
2. Data loss on prices: prod has 7 non-empty price lists, all team-shaped (extra keys; one string price), `payment_methods` null on all. Does opening and saving Prices or Details on those rows silently rewrite or drop them? Is the team-shaped list locked with a reason while how-to-pay still saves; does saving how-to-pay leave the list byte-identical?
3. Old-area parity: compare each rule (price validation, link rule, venue/city, music styles, Instagram, videos, cover upload) with the old area. A rule the old area enforces and P3 does not (or the reverse) is a finding. Is anything copied rather than called?
4. Leave guard: fires on Back, tab-bar navigation, browser back, tab close, ONLY when dirty; "Undo my changes" confirms and sends nothing; the tray text count is right for several fields.
5. Greyed states: ended/archived/festival/draft shapes: locked with a reason, never silently editable and never hidden. No copy points at a control that is not on screen. Every empty state says what the person can do. British English, full weekday names, HTML entities.
6. `series.set_group_chat`: check `_cmd_series_set_group_chat_p5` read-only: what does `{url}` accept (null to clear, https only?) versus what the client sends; is the builder in `OWNER_COMMAND_KINDS` and both mirror tests consistent with `check_owner_command_allowlist_v1`?
7. Nits A/B/C (W2d): are they actually fixed without a new defect (e.g. nit A keeping typing: does it ever send an old-version edit on top of newer data?); were the new tests red against the old code?
8. Flag-OFF guarantee and scope: no P3 import in an always-loaded route; `/account/o` untouched; only W3a files changed (no foreign PNG rewritten); append-only edits in EventPage.tsx / P3Routes.tsx / paths.ts / p3.css (website-c2 has open PRs on the same files). Bundle: is P3 still lazy?
9. Accessibility on the cover-upload control (a native file input shows "Choose File / No file chosen" unstyled in the walk): is the control reachable, 44px, labelled?

## Output
Findings ranked most severe first, each: file:line, what is wrong, a concrete failing input, severity (blocks merge / fix before arc end / nit). Mark each CONFIRMED (you traced it) or PLAUSIBLE. End with a short "Not reviewed" list. Do not pad: zero findings is a valid answer if you checked each point and say what you checked.

## Done =
Push `claude/review-1082-r1` once; final commit subject ends with the done marker from your prompt. Stop at 30% context with a PARTIAL marker.
