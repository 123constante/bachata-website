# P3 W4b build 1: onboarding and claim states in the P3 look

Brief: `docs/briefs/p3-w4b-onboarding.md` (branch `brief/p3-w4b-onboarding`). Mockups and the
decision table: `docs/design/p3-w4b-mockups.md` (PR #1114). Flag `organiserP3` stays OFF:
nothing here renders at `/account/o`, and R1 keeps today's behaviour (tests prove both).

## Chosen options (owner, 2026-10-28)

| Shape | Option | What ships |
|---|---|---|
| Brand-new account | **A, Quiet steps** | Today's one-scroll Welcome, same controls, same order (steps, signed-in line, heading + beta note, search, results / no match / error, Create, pending and declined cards, Browse) |
| Profile not finished (dancer row exists) | **B, Look first, finish on the tap** | The screen is identical to a new account's. A tap on Claim, Ask to join or Create opens ONE sheet first: `DANCER_GATE_REASON`, `stillToAddText`, primary **Finish your profile** (`finishProfileHref`, label from the shared `ratingGate`), the tapped action switched off with "Finish your dancer profile first.", and the return line as drawn |
| No dancer row (2 of 42) | its own frame | `NO_PROFILE_TEXT` + **Message us on WhatsApp** (`NO_PROFILE_CONTACT_URL`), only in this frame |
| Completeness read failed / loading / no provider | today | the tap opens today's sheet; the server decides; `profile_incomplete` still routes to Finish profile |

Return copy ships as drawn: "When you are done you come back to Welcome; search for your page
again." No task carry through `returnTo`.

## Where it lives

- `/account/p3/you/add` (`P3_PATHS.youAdd`, `p3/you/AddPageScreen.tsx`): title **Welcome** with no
  page (P3 Home redirects there), **Add a page** with a back to You otherwise (You's "Add another
  page" and Switch's add link now point here, not at R1 Home's `?add=1`).
- `OnboardingView` / `OrganiserSheet` / `SignOutLine` are the same components R1 uses; `look`
  (default: the surface's kind) switches P3's tokens (`.p3-onb` bridge in `p3.css`), the portalled
  sheets' theme (`SheetLookProvider`, `ui/sheetLook.ts`), focus without page scroll, the tap gate,
  and where a claim / create / ask to join lands (P3 Home with the confirmation line in
  `p3-ok`; P3 Done whose primary "Go back" returns to Welcome).
- One mapping for the gate: `onboarding/profileGate.ts` (`tapGate`) over `ProfileGateContext`.
  `claimStates.ts` (hint words) and `citySearch.ts` are unchanged.

## Data source (prod `stsdtacfauprzrdebmzg`, read-only, 2026-10-28)

`claim_organiser_v1`, `request_organiser_access_v1`, `create_organiser_profile_v1` call
`_require_complete_dancer_profile_v1`: admin exempt; persona `_my_dancer_profile_id_v1()` ->
`_dancer_profile_id_for_account_v1(auth.uid())`; `profile_complete_v1(persona)` = non-empty
`dancer_profiles.first_name`, `based_city_id`, `dance_role`, `avatar_url`; else raises
`profile_incomplete` with `DETAIL {"missing": [...]}` (all four when there is no row). The client
fact (`fetchProfileCompletion`) reads the same persona RPC, the same `profile_complete_v1` and the
same four columns. Counts: 42 live accounts, 30 with no page, 10 unfinished (8 with a row, 2 with
no dancer row), 20 complete with no page, 28 brand new (no page, no open request), 2 open requests.

## Self-check numbers (390x844, `tests/e2e/walk-p3-w4b-onboarding.spec.ts`)

See the PR body's "Phone QA" for the measured values per shape: min text contrast (>= 4.5),
controls under 44px (0), clipped boxes (0), page width (390), sheet / toast boxes inside the
viewport, and no page scroll on sheet open.
