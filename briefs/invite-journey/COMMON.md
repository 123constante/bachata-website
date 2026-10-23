# Organiser-invite journey (Option B): rules shared by all five workers

Read `PLAN.md` (same folder, same brief branch) in full first. It is the owner-approved plan.
Ignore its "HANDOVER" block at the top: that is for the orchestrator and names local paths you cannot reach.
Your own slice is in your brief file; sections 1, 2, 2b, 3, 5 and 6 of PLAN.md bind you too.

## The five workers (run in parallel; do not touch another worker's files)
| Worker | Repo | Branch | Owns |
|---|---|---|---|
| W1 | bachata-website | `claude/invite-w1-join` | `src/modules/admin-organisers/InviteRedeemPage.tsx`, `inviteRedeemApi.ts`, new `src/modules/admin-organisers/join/*`, `DancerProfileGate` /invite exemption, `tests/e2e/arc1-invite-redeem-walk.spec.ts`, new `tests/e2e-phone/invite-*.spec.ts` |
| W2 | bachata-website | `claude/invite-w2-phone-ig-golive` | new `src/components/forms/PhoneInput.tsx`, `InstagramInput.tsx`, `src/lib/instagramHandle.ts`, `RafflePhoneInput.tsx` (thin wrapper), dancer/organiser contact editors, the "Almost live" and "It's live" screens, the shared phone/IG fixture file (W2 writes the Website copy) |
| W3 | bachata-website | `claude/invite-w3-names-person` | `src/modules/admin-organisers/InvitePerson*.tsx`, `invitePerson*.ts`, `inviteModel.ts`, new `src/modules/admin-organisers/duplicates/*`, the admin-home duplicates alert |
| A1 | bachata-admin | `claude/invite-a1-golive-phone-ig` | migrations `20261205100000`-`20261205199999` only: `_role_requirements_v1`, `series_go_live_check_v1`, `normalize_phone_e164_v1`, `normalize_instagram_handle_v1`, phone/IG triggers, `get_public_teacher_detail_v1`, a `check_*` guard, `rollback.sql` |
| A2 | bachata-admin | `claude/invite-a2-identity-join` | migrations `20261205300000`-`20261205399999` only: `redeem_organiser_invite_v1`, `organiser_invites.person_profile_id`, `admin_invite_person_v1`, the shadow-login edge function under `supabase/functions/`, `check_invitee_duplicates_v1`, `admin_join_duplicate_people_v1`, the dismiss table, `rollback.sql` |

Names both sides agree on (do not rename): error codes `invalid_phone`, `invalid_instagram`; go-live keys for DJ = `dj_name` + `dj_genres` (at least 1), teacher = `teaching_styles` (at least 1) — A1 must use exactly these keys or state the final key names in its PR body under "Agreed names" so W2 can be aligned; redeem outcome `not_linked`; dry-run return of `admin_join_duplicate_people_v1` = `{ changes: [{ kind, text }] , refused?: code }`.
If you must deviate from an agreed name, write it in your PR body under "Agreed names (changed)", never silently.

## Approved prototypes (the reference; match them)
- Join page, Option B v3: https://claude.ai/artifact/TYZuWuVfoSLc6MqyHWSB1G
- Profile linking (Who is this for, safety stop, duplicates repair): https://claude.ai/artifact/3gL4uGiZLMX9QgQrNsUQnk
- Publishing (Instagram/phone fields, "Do you also DJ or teach?", "It's live", teacher page): https://claude.ai/artifact/RRXU7H3ZaLvD4PFnx14MAu
If you cannot open an artifact link, build from PLAN.md's written description and say "prototype not opened" in the PR body.

## Data
Prod Supabase project `stsdtacfauprzrdebmzg` is READ-ONLY for you (counts and shapes only, no PII in the PR). E2E writes go to the E2E project only.

## Merge order (you never merge; this is for your PR body)
A1 applied by the owner -> W2 may merge. A2 applied by the owner -> W1 may merge; W3's duplicates / shadow-login parts switch on. Until then W3 shows "available soon", never a broken button.

## Every PR ends with
- A per-CI-job table (read `.github/workflows/*`, run every job's steps in your sandbox, paste pass/fail per job).
- Verified / Not verified block.
- "Agreed names" section.
- Website PRs: a design record `docs/design/<pr>.md` (stage 2 = the approved prototype; stages 4 checks by script, 5 and 6 are done by the orchestrator, say so) and phone-size (390x844) screenshots of every screen and every error screen, committed under `docs/design/<pr>/`.
- Checkpoint progress in the PR description after each major step.
