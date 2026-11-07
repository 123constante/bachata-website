# Brief W5 -- Ambassador badge on the profile (Website, normal lane, sonnet)

Brief-version: 2
Context cap 30%. Push an early checkpoint commit as soon as the badge renders; push again before every pause. Supabase READ-ONLY. Never `gh api`, never `--no-verify`, never merge/approve. If PARTIAL, subject ends PARTIAL and the handover lists what is left. Bristol stays INACTIVE: no activation, no city set, no flag flip, no prod data write.

- **Repo:** 123constante/bachata-website. **Branch:** `claude/bristol-ambassador-badge`. **Lane/model:** normal, sonnet.
- **UNBLOCKED 2026-11-07:** admin #1277 (ambassador_shared_link_v1) and admin #1312 (anon EXECUTE on `is_city_ambassador_public_v1`) are both applied on prod (read-only check: anon can execute it, anon still cannot run the tracker or join functions). Owner decision 2026-11-06: the badge is visible to EVERYONE, including signed-out visitors. Call the RPC with the public client; an error or a null shows no badge.

## Goal
Owner 2026-10-26 / 2026-10-29: the ambassador's reward is a badge on their profile. The badge next to the approver's name on events is a LATER admin slice (the approve audit row is not exposed): OUT OF SCOPE here.

## Do
1. On the public person profile show one chip "Ambassador" (add the city name only if a read returns it) when `is_city_ambassador_public_v1(user_id)` is true. Candidate files: `src/modules/person-page/PersonPage.tsx`, `src/pages/DancerProfile.tsx`, `src/pages/PublicProfile.tsx`. Prove which is the live render with `git grep` for importers before editing; apply `emitProfileView` rules in `.claude/rules/data-contracts.md`.
2. One shared `AmbassadorBadge` component in `src/modules/ambassador/link/` with one label mapping. Tapping it opens a one-line note "Helps new organisers join their city". No badge for non-ambassadors, no empty gap, no layout shift.
3. Fail safe: an RPC error, or signed-out if anon is not granted, shows no badge and no error UI.

## Tests
Table-driven {ambassador, not ambassador, rpc error, signed-out} x {each profile render that shows the badge}; badge text identical on every screen (one mapping); a long name at 390px does not clip the badge.

## Walk and design
390x844 with a mocked ambassador. Design record `docs/design/bristol-ambassador-badge.md` with INVENTORY first (admin ambassador screen, current profile pages, file:line).

## Done
Bot-authored PR, every CI job step run, Verified / Not verified, handover `docs/handover/bristol-ambassador-badge.md`.

## What main lacks
- No ambassador badge on any public profile (git grep is_city_ambassador_public_v1 finds nothing in src). -- grep: is_city_ambassador_public_v1

## Files
`src/modules/person-page/PersonPage.tsx`, `src/pages/DancerProfile.tsx`, `src/pages/PublicProfile.tsx` (prove the live one), new `src/modules/ambassador/link/AmbassadorBadge.tsx`, tests beside it.
