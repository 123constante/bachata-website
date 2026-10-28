# Brief: S3a nationality list (full ISO + England, Scotland, Wales, Northern Ireland)

Repo: 123constante/bachata-website. Branch: claude/nationality-list-gb-home-nations (fresh from main).
Lane: normal (no database change). Model: Sonnet (copy/data, no new permission or save rule).
Output: one PR, one push, handover. Do not merge. No prod data write.

## Verified facts (read-only audit, 2026-10-28)
- prod `dancer_profiles.nationality` is plain text, no length limit, no check or foreign key. 22 rows, all 2-char codes.
- `nationality_code` in the generated Website types does NOT exist in prod. Ignore those types for nationality.
- Readers: src/modules/profile/dancerPublicProfile.ts, src/pages/DancerProfile.tsx (subtitle prints the raw value),
  src/pages/Dancers.tsx, DJs.tsx, DJProfile.tsx, Teachers.tsx, src/components/dj/DjTiles.tsx,
  src/pages/EditProfile.tsx, src/components/ui/nationality-picker.tsx, src/lib/dancerEditorPayloads.ts,
  src/lib/utils.ts, src/constants/countries.ts (toFlagEmoji and flagcdn).

## Change
1. Replace the UN-members list in src/constants/countries.ts with the full ISO 3166-1 list (about 249 entries).
2. Add four home-nation choices stored as ISO 3166-2 codes: GB-ENG (England), GB-SCT (Scotland), GB-WLS (Wales),
   GB-NIR (Northern Ireland). Show them as separate entries next to United Kingdom (GB).
3. Make every reader handle 5-char codes (GB-ENG style) with no crash: flag lookup, subtitle, admin-facing text.
   Existing 2-char values must still display.
4. Verify flagcdn serves subdivision flags (gb-eng, gb-sct, gb-wls, gb-nir). If one is missing, use the fallback
   flag and say so in the PR. Do not invent a flag URL.
5. Display: keep the raw value as today unless a name lookup already exists for it (do not add a new display rule).

## Checks (definition of done)
- Table test: every stored value (2-char, 5-char, empty, null) through picker, subtitle, flag: no crash, nothing blank
  where a value exists.
- Save path: an untouched save sends nothing for nationality; a changed value sends the new code only.
- Run `npm run check:bundle-budget` on main and on the branch. The PR must add 0 bytes to the dancer-app first load.
  Never edit perf-budgets.json or vite.config.ts.
- Unit tests for the changed files. Name any test you could not run.
- Walk at 390x844 if the picker UI changes; otherwise say "no visible change beyond the list".

## Stop rules
- Stop on any red. Do not start the Languages field (that waits for the Design Gate). Do not merge.
- Push once. Put the per-check table in the PR body under Verified / Not verified.

## Required output
Final line: `DONE <head sha>` or `PARTIAL <what is left>`.
