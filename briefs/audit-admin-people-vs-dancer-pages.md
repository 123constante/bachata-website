# AUDIT (read-only): admin people profile vs the Website dancer pages. Model: Sonnet. Repo: bachata-website. READ-ONLY: no code changes, no migrations, no PR.
Read dancer-rebuild-COMMON.md (briefs branch arc/briefs-dancer-rebuild: `git fetch origin arc/briefs-dancer-rebuild`, `git show FETCH_HEAD:briefs/dancer-rebuild-COMMON.md`). Use PLAIN git only, never `gh api`; no shell variables/loops/$(...) where a plain command works.

## Why (owner's words)
"Before I approve, did you audit the admin people profiles to make sure that the dancers have the complete features?" PR #821 (branch claude/dancer-app-r1b, head e0541df) ships the new public dancer page /dancers/<slug> and the beta /app area. Nobody has checked that every dancer field/feature the ADMIN people profile holds or edits appears (or is deliberately absent) on those Website pages. The owner is a beginner: plain words.

## Sources
- Admin repo: `git clone --depth 1 https://github.com/123constante/bachata-admin.git` into a SEPARATE directory outside the Website checkout. Look at components/admin/people/ (PersonView.tsx, PersonViewRoleTabs.tsx, PersonCard.tsx and siblings), its services/types, and the dancer_profiles + dancing_role_details (sidecar) columns they read/write.
- Website at origin/claude/dancer-app-r1b: src/pages/DancerProfile.tsx (public), the /app screens (Home, My page, profile edit, Going), and the data hooks they use.
- Prod DB read-only via the Supabase MCP (counts only, no personal data): which dancer_profiles/sidecar columns are actually populated across real rows (non-null counts), so gaps are ranked by how many real dancers they affect.

## Do
1. List EVERY dancer field and feature in the admin people profile (name, surname/hide flags, photo/cover, bio, roles, levels, styles, languages, city/location, socials/links, contact + show_*_publicly flags, partner-search/looking-for-partner state, availability, teacher/DJ/etc role details, verification, status, anything else you find).
2. For each, mark: SHOWN on public page / SHOWN in /app (editable?) / MISSING / DELIBERATELY HIDDEN (privacy flag). Note the privacy rule that applies (a hidden-by-flag field is correct, not a gap).
3. Add a count of real prod dancers with that field populated (counts only).
4. Rank gaps: (A) data a dancer entered or admin set that the public page should show but drops; (B) a /app edit control missing for something the dancer owns; (C) admin-only by design.
5. Write the result to docs/handover/dancer-admin-parity-audit.md (table + ranked gap list + one-paragraph plain verdict: "safe to merge #821 as is" or "these gaps block"). Push ONCE to a NEW branch claude/audit-dancer-parity (docs-only, no PR). Last commit subject must end `[worker-done audit-dancer-parity]`; if you run past 25% context push a partial with `PARTIAL [worker-done audit-dancer-parity]`.
Stop after the push and report. Never merge or approve; no writes to prod.
