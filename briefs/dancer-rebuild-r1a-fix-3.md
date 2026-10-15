# Brief: R1a REAL-DATA FIXES (Website, branch claude/dancer-app-r1a, PR #759)

Context: read `briefs/dancer-rebuild-r1a-fix.md` (boundaries, decisions) and `docs/handover/dancer-rebuild-r1a.md`
(section "Review fixes" and its continuation). Head is d50046ff; PR #759 is open with all real GitHub checks green.
Do NOT edit the PR title/body (the orchestrator owns them). Push with plain git only, never `gh api`.

The orchestrator walked every /app screen at 390x844 on the OWNER'S REAL PROFILE (read from prod with
`my_dancer_edit_v1`, fed through `createFakeBackend({ profile })`). Three defects that the fixture shapes could not
show. Prod counts are read-only, counts only (prod `stsdtacfauprzrdebmzg`, `dancer_profiles`, 167 rows):

## F1: next-step text asks for something the person already did (68 of 167 profiles)
Seen: Home strength tile and Me both say "Add a bio and a link towards 100%." for a profile that has a website,
Instagram AND Facebook but no bio. Server rule (`_dancer_strength_v1`): `has_bio_social` = bio non-empty AND at least
one of instagram / facebook / website_url non-empty. Prod: link but no bio 68, bio but no link 0, neither 99.
Fix: ONE function in `api/nextStep.ts` that picks the bio_social label FROM THE PROFILE: link present, no bio ->
"Add a short bio"; bio present, no link -> "Add your Instagram, Facebook or website"; neither -> keep "Add a bio and a
link". The Edit focus follows (bio field, or the first link field). Home, Me and Onboarding must all call it (no
copy). Add fixture shape `linkNoBio` (prod-shaped: website without scheme, 1-letter facebook, long instagram, no bio,
pct 90, next_step bio_social) to `api/fixtures.ts` so every table test runs it. Red-first: the table test must
fail on d50046ff with the old label.

## F2: Edit blocks every save because of an UNTOUCHED stored value (7 profiles)
Seen: untouched Edit form shows "Your website must start with http:// or https://." under the stored
`www.bachatacalendar.co.uk`, and Save is disabled with "Fix the fields marked above, then save." So the person
cannot change their name or city until they fix a field they never touched; the save would not even send it
(diff-first delta). Prod: website not matching `^https?://\S+$` 4, instagram failing the handle rule 2, facebook 1.
Fix (class, not instance): client validation gates ONLY fields that are in the delta (changed vs the server shape),
exactly as the server validates only the delta. An unchanged stored value that would fail shows a calm hint (not an
error, not aria-invalid) saying what to change, e.g. "Add https:// at the start so this works as a link.", and does
NOT disable Save. Editing that field still validates it as today. Tests (red-first on d50046ff): with the
`linkNoBio` shape, change only first_name -> Save enabled, the sent delta is exactly `{ first_name }`; edit the
website to another bad value -> error + Save disabled with the reason; untouched -> Save disabled for "nothing to
save" with that reason, never the "fix the fields" reason.

## F3: "Show my WhatsApp on my page: On" with no number (166 of 167 profiles)
Seen: the switch reads On while no WhatsApp number is stored, so it controls nothing. Rule (owner checklist): a
control that cannot work is disabled WITH a reason. Fix: while the number field is empty, the switch is disabled
with the reason "Add your number above to show it on your page." (it keeps its stored value; an untouched save
sends nothing for it). Typing a number enables it. Test red-first.

## Then
- Every no-secret CI job step (read `.github/workflows`), table in the handover with command + exit code, as the
  previous workers did (`git fetch origin main` first; `NODE_PATH=` for unit; never commit snapshot rewrites or a
  `chmod +x bin/*.sh` mode change). Event-route first-load bytes vs main re-quoted (owner rule <= +0.5 KB gz).
- Regenerate the review pack (`REVIEW_PACK_DIR=docs/review-pack/r1a`, review-pack.spec.ts, chromium) including the
  new `linkNoBio` shape; update `measurements.md`.
- Add a section "Real-data fixes (F1-F3)" to `docs/handover/dancer-rebuild-r1a.md`: table finding -> fix -> red
  quote; Verified / Not verified. Do not do a browser walk on real data or /code-review (orchestrator does).
- Final commit subject ends `[worker-done <ticket>]`; push; stop. No background jobs that outlive the push.

Boundaries: only `src/modules/dancer-app/**`, its tests, `tests/e2e/dancer-app/**`, `docs/handover/**`,
`docs/review-pack/**` (and `perf-budgets.json` only if a measured number moves). Never merge, approve or edit the PR;
Supabase read-only; never `--no-verify`. Write shell commands without variables, loops or `$(...)` where a plain
command works. Context: at 25% start nothing new; by 30% push + handover with subject ending
`PARTIAL [worker-done <ticket>]`.
