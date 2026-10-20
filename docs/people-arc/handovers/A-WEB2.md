# A-WEB2 handover (Website, branch claude/people-a-web2-invites)

Ticket dt_91b10b492be5. No PR opened (per brief). frontend-design skill: NOT available in this session (not in the skill list); I stayed inside the existing Tailwind/shadcn admin page styles.

## Built
1. **Invite person** on `/admin/organisers`: `InvitePerson.tsx` (new), `invitePersonApi.ts` (new; `admin_invite_person_v1` through the string-named `UntypedRpc` boundary, `searchPeople` via typed `admin_search_people_v1`, `fetchPageLeader` from `organiser_team_members.is_leader`, `fetchUpcoming` from the public feed), `invitePersonModel.ts` (new; ONE refusal table `INVITE_PERSON_COPY`, parser, message builder, blocked-reason). `AdminOrganisersPage.tsx`: 2 lines (import + `<InvitePerson organisers={list.data ?? []} />`). `inviteModel.ts` and `polish.test.tsx` untouched. Result: message with link, page URL, up to 5 upcoming events; Copy and WhatsApp buttons; shown once.
2. **Redeem**: `redeemMismatch.ts` (new) wraps `interpretRedeem` with `email_mismatch` copy (names the invite email if the answer carries `invite_email`/`email`); `InviteRedeemPage.tsx` uses it and shows a Sign out button for that refusal. **Email field prefill NOT done**: the redeem page has no invite lookup and no email field today (sign-in lives on /auth), so there was nothing to prefill. Needs an admin RPC that returns the invite email for a token.
3. **AuthCallback**: `src/lib/claimMyOrganisers.ts` (new; `claim_my_organisers_v1`, 4 s timeout, never throws, empty on any failure). After the dancer claim, a non-empty list lands on `/account/o` (also from the profile-incomplete fallback) with a toast "You now manage X. Not you? Tell us" (Tell us = WhatsApp link). The notice is a global toast because `src/modules/organiser/**` is read-only for this slice; it uses a plain link, not `ToastAction`, because importing `components/ui/toast` split a new first-load chunk (+1 request on /parties etc.).
4. **ReportProblemLink** in `contactLinks.tsx`, rendered at the end of `BentoPage.tsx` and `OrganiserProfile.tsx`.
5. **Paused/archived hidden**: `organiserPublicProfile.ts` adds `NOT_PUBLIC_LIFECYCLE` (`lifecycle_status` not in archived, rejected). Prod shape (read-only SELECT, counts only): 43 live/is_active NULL, 5 live/true; CHECK allows draft, pending_review, live, rejected, archived. **There is no "paused" lifecycle value**; paused = `is_active=false` (already filtered) or archived. `OrganiserProfile.tsx` also calls `useNoindexMeta` on the not-found state. SSR loader shares the same fetch so it 404s too.
6. **Full profile mark**: `fetchOrganiserFullProfile` (rpcLoose, any error/missing = false) and a `FullProfileMark` in `OrganiserProfile.tsx`; never the dead `is_verified` badge.

## Files outside the brief's list (needed)
- `scripts/lint-runtime-architecture.mjs`: allowlisted the two new files that read the server key `organiser_id`.
- `src/pages/__tests__/OrganiserProfileEmpty.matrix.test.tsx`: its "no WhatsApp link" selector now ignores the Report link.

## Red first
- `AuthCallbackOrganiserClaim.test.tsx` against unfixed AuthCallback: 5 failed (claimed 1/2 pages x complete/incomplete profile: no toast, wrong landing); 17 pass now (claimed 0/1/2, error, function missing, throws, malformed, nameless rows, x complete/incomplete profile, plus the Tell us link).
- `organiserPublicVisibility.test.ts` against unfixed code: archived and rejected pages with is_active NULL rendered (2 failed); 4 pass now.

## CI table (sandbox)
| job | step | command | exit |
|---|---|---|---|
| lint | chain | npm run lint | all links pass except check:integrity (script not executable here: ran `bash bin/check-integrity.sh` = ok) and lint:architecture (fixed by allowlist, now 0); eslint link informational, my files have 0 errors |
| build | production build | npm run build | 0 |
| perf | check:first-load-requests / check:bundle-budget | npm run ... | 0 / 0 |
| guards | check:rpc-typing, check:mojibake | npm run ... | 0 / 0 |
| unit | npm run test:unit equivalent | npx vitest run src/modules src/pages src/lib | all pass after the selector fix |
| e2e, phone-qa, Supabase contract checks | | | NOT RUN (browser/secrets/Docker) |

## Not verified
- **No 390x844 / 360x640 screenshots** (docs/people-arc/screens/A-WEB2 is empty) and no browser walk; no live-data walk of Invite person. Admin RPCs `admin_invite_person_v1`, `claim_my_organisers_v1`, `organiser_full_profile_v1` do not exist yet: everything is tested against a fake at the boundary only.
- Tap targets are 44px by class, contrast by existing tokens; not measured.
- Person search for teacher/DJ invites uses existing `admin_search_people_v1` (works); the Leader prefill reads `organiser_team_members` directly.

## Next
Screenshots + phone walk once A-DB1/A-DB2 land; redeem email prefill needs an invite-lookup RPC.
