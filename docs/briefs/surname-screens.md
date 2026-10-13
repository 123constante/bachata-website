# Brief: surname-hide Website slice (Phase E, Website repo 123constante/bachata-website)

Read first: CLAUDE.md and the docs it points to (UI quality, phone QA, tests, deploy windows). Never merge, never --no-verify, push once. Bot PR via gh with the repo's bot token. Branch `claude/surname-screens` from `main`. You own only Website files.

## CI rule (owner decision 2026-10-13)
GitHub Actions on `claude/*` branches may refuse to start ("payments have failed"): not a code failure; the owner will not pay. YOU run every CI job step (read .github/workflows) in your sandbox and put a per-job table (command, exit code) in the PR body and handover. Honest Verified / Not verified. Nobody runs anything on the owner's PC.

## Owner decisions (binding)
Surname hide: hidden EVERYWHERE public, first name only shown, default shown, existing 56 profiles unchanged. The DB side is admin PR #794 (applies before this deploys; deploy order: #794 applied, then this Website PR). Read its handover: `gh api repos/123constante/bachata-admin/contents/docs/briefs/surname-hide-db-handover.md?ref=claude/surname-hide-db -q .content | base64 -d` (section "Open 2" is your task list).

## Pinned DB interface (final)
- `dancer_profiles.hide_surname_publicly boolean NOT NULL DEFAULT false`. The person reads their own value with a plain select under RLS (`select hide_surname_publicly from dancer_profiles where id = <own id>`); no other client may rely on reading it.
- `save_my_dancer_profile_v1(payload)`: send `hide_surname_publicly` as a JSON boolean ONLY when the person changed it (absent or null leaves it; any other type raises 22023). Read how the own-profile form sends other fields so a save of an untouched record sends nothing new.
- `get_public_dancer_names_v1(uuid[])` (anon-callable, first 500 ids) returns for each visible dancer id the masked `surname`, `display_name` and `public_name`.
- Public RPCs (search, lineups, `resolve_person_v1`, teacher/DJ lists) already return masked names; `get_public_teachers_list_v1` still returns `hide_surname:false` on purpose: do not start abbreviating from it. Render `surname` null-safe everywhere.

## Task
1. Switch: add a clear "Hide my surname from the public" toggle to the own-profile form (the dancer's profile edit screen, NOT the account settings screens owned by PR #743; find the form by grep for the own-profile save and `save_my_dancer_profile_v1`). Plain English helper text: what is shown, "Anyone viewing your profile or a line-up sees only your first name". Disabled with a reason while the profile is unfinished or saving. Default shown. Reads its initial value from the person's own row; an untouched save sends nothing.
2. Public reads: grep `DANCER_PUBLIC_COLS`, direct selects of `surname` / `display_name` on `dancer_profiles`, and every page, og/meta, JSON-LD, sitemap title and share text that composes a person's name. Replace each direct read with `get_public_dancer_names_v1(ids)` and use `public_name` for headings; batch ids (<=500 per call). Produce a table of every site (file, what it showed, how it is fixed).
3. Do not touch slugs (owner decides separately). List every public place a slug is shown for the handover.
4. Tests, table-driven: (switch off | on) x (person page, line-up credit, search result, teacher/DJ card, og/meta title, JSON-LD) x (with surname | no surname | no display_name): the surname never appears when on, always when off; same fact reads the same on every screen (one shared mapping, not copies); empty states say what the person can do; save of an untouched record sends nothing. Run them red on the unfixed code first. Phone QA at 390x844 and 360x640 for the toggle screen.
5. PR body: heading exactly `## Verified on real data` with lines `- Shapes surveyed:`, `- Checks run:`, `- NOT verified:` (no extra words in the labels) plus the repo's Phone QA section; per-job CI table.

## Output
Head SHA, PR number, per-job table, handover docs/briefs/surname-screens-handover.md, honest Verified / Not verified (real DB responses before #794 is applied are NOT verified). Stop after the push.
