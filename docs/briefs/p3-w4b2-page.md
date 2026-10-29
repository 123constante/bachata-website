# P3 W4b build 2, slices 2+3 as ONE branch: `claude/p3-w4b2-page`

Lane: normal, Opus builder (save paths). One independent review afterwards. Flag `organiserP3` stays OFF. No migration, no `supabase/**`.
Read first: `docs/briefs/p3-w4b2.md` (slices 2 and 3 text, standing header lines, owner changes), `docs/handovers/p3-w4b2-shell-person.md` (slice 1 is MERGED: shell, progress, person screens; reuse it, do not rewrite), `docs/design/onboarding-prototype.md` (spec).

## Scope
- Slice 2: organiser/page screens 1-9 (welcome, find, create name, city, contact, WhatsApp, category, link, logo) on build 1's claim/create RPCs.
- Slice 3: review screen (`organiser_onboarding_status_v1().missing[]`), go-live screen with confetti (call `complete_organiser_onboarding_v1` only if already deployed; else a clearly named stub interface, say so), Home grace banner, Settings sheet, and the entry link into the flow.
- The personal-email screen stays DROPPED (owner click 2026-10-29).
- **Progress % must cover the FULL path** (contact ... page screens ... person ... Review), rebased from slice 1's person-only count (review finding S6). aria-valuenow equals the % shown.
- Known gap, do not fix here: prod `my_role_details_v1` returns no `levels_taught` (admin item queued).

## Rules
Standing header lines from `docs/briefs/p3-w4b2.md` apply (prove data source first, zero bytes to /app first load, overlay geometry, table-driven tests every screen x every shape, no-scroll geometry spec at 390x844, 360x640, 320x568 and 130% text). Write diff-first saves (untouched screen sends nothing). Real-data shape survey (counts only) goes in the PR body "Verified on real data" block. Per-job CI table in the PR body. Design record link: `docs/design/onboarding-prototype.md`.
Context cap: 50%. If not finished, push, write `docs/handovers/p3-w4b2-page.md` and mark `PARTIAL [worker-done <ticket>]`; a continuation worker takes the rest. Pushes end `[skip preview]` except the last.
