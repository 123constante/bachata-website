# Brief: R1a REVIEW FIXES (Website, branch claude/dancer-app-r1a)

Read first: `briefs/dancer-rebuild-COMMON.md`, `-INTERFACE.md` (all additions incl. Round-3), then the review
`docs/handover/dancer-rebuild-r1a-review.md` on branch `arc/dancer-app-r1a-review` (git show) and r1a's own
`docs/handover/dancer-rebuild-r1a.md`. Start from r1a head 3a6aa23e. You fix; the review is the work list.

## Fix every finding (orchestrator decisions in brackets; for each: red-first test on the unfixed code, then green)
- **B1** make the `no-photo` shape real in the review-pack fixtures and walk the photo step; re-shoot the shots
  that change. A shape that cannot occur in prod data is not a shape.
- **S1** Edit "Try again" must recompute the delta against the CURRENT form + server state, never resend a stale one.
- **S2** ONE next-step copy table (shared mapping), used by Home, Me, onboarding. Table-driven test: every
  `next_step` value renders the same words on every screen.
- **S3** Nights/Home honour `is_active` and every RSVP status; no "Saved" anywhere (banned word).
- **S4 / S11** diff-first holds for chips: toggle twice = no write; stored values outside the preset list show once.
- **S5** `profile_strength_70` fires when the person crosses 70 on any path.
- **S6** one shared display-name helper honouring the surname-hide flag (same rule as the public page).
- **S7** validate `next_step` and `dance_role` at the API boundary (unknown value -> safe default + logged), no casts.
- **S8** replace raw Unicode punctuation in source per the repo rule.
- **S9** [decided] add a test that pins the event route's server HTML / first paint for an anonymous visitor
  (level-rating children lazy must not change what is rendered before hydration, beyond the lazy slot).
- **S10** [decided] the isolation allow-list lives in ONE place: the script reads it from
  `scripts/dancer-area-isolation-allowlist.json`; a test fails if the script adds paths in code. Copy the list into
  the handover so the orchestrator can mirror it in INTERFACE.
- **S12** nationality uses the existing country picker (shows the name, stores the ISO code), not free text.
- **S13** help text and disabled reasons >= the body text size used elsewhere on these screens (no ~10px).
- NOTEs: fix if trivial, else record why not in the handover.
- **Perf** [decided] add the dancer-app row to `perf-budgets.json` `attribution.baseline.routes` (measured value).

## Then
Re-run every no-secret CI job step, the production build, every dancer-app e2e spec and phone-qa; per-job table.
Append a "Review fixes" section to `docs/handover/dancer-rebuild-r1a.md` (finding -> commit -> test that went red).

## Boundaries
Only this branch; no PR, merge or approve; plain git (never `gh api`); commands without variables/loops/`$(...)`
where a plain command works; Supabase read-only. Context: at 25% start nothing new; by 30% push + handover with
subject ending `PARTIAL [worker-done <ticket>]`. Final commit subject ends `[worker-done <ticket>]`; push; stop.
