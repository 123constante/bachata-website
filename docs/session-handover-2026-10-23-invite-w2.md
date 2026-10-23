# Handover: invite journey W2 (phone + Instagram inputs, "Almost live" DJ/teach, "It's live") -- PARTIAL

Branch `claude/invite-w2-phone-ig-golive` (off `main` d4bff828). Brief: `brief/invite-journey` `briefs/invite-journey/W2.md` (blob f60a5072).
Stopped at the owner's context gate (30% hook). Ticket `dt_9d3af6214f98`.

## Done (committed, unit-tested)
- `src/lib/phoneRules.ts`: `isValidE164` now `^\+[1-9]\d{7,14}$` (equal to A1's `normalize_phone_e164_v1`); new `normalizePhoneE164` + `INVALID_PHONE`.
- `src/lib/instagramHandle.ts` (new): `stripInstagram` = prod `normalize_instagram_handle_v1` step for step (read 2026-10-23); `normalizeInstagramHandle` adds A1's validator (30 chars, `[a-z0-9._]`, edge/double dots -> `invalid_instagram`); `checkInstagramField` (field-only: refuses non-profile links, post links, a link with no name); `instagramProfileUrl`, `instagramDisplay` (wraps `extractIgHandle`). `organiserLinkLabels.ts` now exports `IG_NON_HANDLE_PATHS`.
- Shared fixture `src/lib/__fixtures__/phone-instagram-cases.json` (ASCII, LF sha256 `3aa36343aa41ba82bb0767f47c3e35e39235434f81aeef6a0bdf786b20e8aee2`), includes the PLAN s2 legacy shapes (`+` with spaces, 8- and 7-digit no-`+`, the 34-char Instagram). Parity test `src/lib/__tests__/phoneInstagramParity.test.ts` pins the hash.
- `src/components/forms/PhoneInput.tsx` (new, extracted from the raffle): tones `app`/`raffle`; legacy row ("Saved before: ... Change") for a non-E.164 stored value, nothing emitted until edited; pasting `+44 ...`/`0044...` picks the country; grouped confirm line; keyboard select on country rows; `renderError`.
- `RafflePhoneInput.tsx` is a thin wrapper. New `modals/__tests__/RafflePhoneInput.test.tsx` pinned the raffle contract on the ORIGINAL code first (7/7), green after. Raffle copy change: the old feedback strings rendered a literal `&mdash;`; now plain sentences.
- `src/components/forms/InstagramInput.tsx` (new): bare name, "Saved as", "instagram.com/name: tap to check it's you" link; untouched stored value is not checked.
- Dancer edit (`dancer-app` EditScreen + `me/model.ts`): Instagram and WhatsApp use the new inputs; delta sends the bare name / E.164 only when edited (untouched legacy never re-sent); `invalid_phone`/`invalid_instagram` added to `DANCER_ERROR_CODES` + copy + field map (test lists updated).
- Organiser edit-in-place: `fieldRules.checkInstagram` saves the bare name (live RPC already accepts `^@?[A-Za-z0-9._]{1,30}$`, writes changed keys only); `checkPhone` = E.164; `ContactSheet` uses `PhoneInput` (wrapped in `.org-theme`, it renders in body); an untouched legacy phone never blocks Done and is never re-sent (2 new tests). `draftModel.refusedField` already mapped `invalid_instagram`.

## Open (not started)
1. Wizard steps (`src/modules/organiser/wizard/registry.tsx`): dancer `instagram`, `phone_or_whatsapp` and organiser `instagram`, `contact_phone` are still `makeTextStep`. Add `makePhoneStep`/`makeInstagramStep` (new file next to `stepKinds.tsx`, keep registry edits to 4 lines). `wizard/dancerApi.ts` COPY needs `invalid_phone`/`invalid_instagram`. Organiser `contact_phone` currently refuses a non-E.164 typed value via `checkPhone` (good) but the step is free text.
2. "Almost live" DJ/teach question in `home/onboarding/golive/GoLiveFlow.tsx`: new phase `roles` after the quick questions (only with a series), new `roleQuestion` model file: ask roles not in `my_role_intent_v1` roles/declined; Yes opens the minimum inline (DJ: `dj_name` + >=1 `genres`; teacher: >=1 `teaching_styles`), writes via `answerDoYou` (areas/home/rolesApi) + `saveMyRole` (changed keys only); prototype copy "Do you also DJ or teach?", "Answer both questions to continue." etc. Count it in the bridge's "N quick questions", section "About your page".
3. `goLiveCheck.parseGoLiveCheck` throws on a `profile_missing` area other than dancer/organiser: if A1 emits `dj`/`teacher` with keys `dj_name`/`dj_genres`/`teaching_styles`, accept them (additive) and map gaps to `DEFAULT_AREA_PATHS[role].profile`. Note role field key is `genres`, go-live key is `dj_genres`.
4. "It's live": `liveNow` -> `goDone` with title "It's live", message "<name> is live."; add optional `offer` roles to `DoneState` and an `ItsLiveOffer` card in `flows/Done.tsx` ("Make your DJ page stand out" -> `DEFAULT_AREA_PATHS.dj.profile`, "Maybe later").
5. Tests still to write: role combinations x missing keys table; "no text points at a missing control"; untouched save sends nothing (go-live); phone spec at 390 in `tests/e2e-phone/`.
6. PR body items: per-CI-job table, Verified / Not verified, "Agreed names", design record `docs/design/<pr>.md` + 390x844 screenshots under `docs/design/<pr>/`, list of overlap files touched (none of `goLiveCheck.ts` yet).

## Not verified
- A1's branch: the admin repo is not reachable from this session (add_repo denied), so names are COMMON.md's, unconfirmed; A1 must copy the fixture byte-for-byte.
- Only unit tests ran (touched areas: 125 files, 3617 passed). Not run: full `npm run lint` chain, `pre-ship`, e2e, typecheck gate steps, browser walk at 390x844, Vercel preview.

## Next session prompt
See the final message of this session.
