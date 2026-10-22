# Handover: Arc 1 PR 3, slice B (Almost live, quick questions, All set, Go live)

Branch `claude/arc1-pr3-ten`. Brief: admin `docs/briefs/arc1/arc1-pr3-onboarding.md` (slice B), `arc1-common.md`, `arc1-as-built.md`.

## Done
- New flow at `/account/o/go-live` (`ORG_PATHS.goLive`, `?series=<event>&o=<page>`), files under `src/modules/organiser/home/onboarding/golive/`:
  - `goLiveModel.ts`: pure rules and the approved v8 copy ("Almost live", "All set", counts, section labels, `mineFor`, `goLivePath`).
  - `GoLiveFlow.tsx`: bridge, one question per screen with dots, section and "Step k of n", slide transitions (none under reduced motion), "Use mine" on the two page questions that repeat a personal answer, All set, Go live (one `series.set_lifecycle live` command through `useFlowSend`), Not now / Not yet to Home.
  - `profileLeft.ts`: reads `series_go_live_check_v1`; a failed read answers false so the server still decides.
- The question list is the server's: required, open steps of `my_profile_progress_v1` that the wizard registry can answer, in server order, taken once at the start. No field list of our own. The People wizard (`wizard/`) is untouched: steps, `saveAnswer`, writers and `WizardEnvContext` are reused.
- Hook: New event's last step (`flows/new/NewFlow.tsx` CoverStep), when Go live is pressed and the server says profile answers are left, goes to the bridge instead of sending.
- Route in `OrganiserRoutes.tsx`; path in `paths.ts` (pinned table test updated).
- Home card kept as is (`home/ProfileButton.tsx`, "Finish your profile", People arc file, not edited): decision 12.

## Findings to know
- `GoLiveListView` is in `events/LifecycleActions.tsx`; its profile row still links to the old wizard (`/account/o/complete`). Left alone: it is the event page's own list, and the wizard stays the way for those who start there.
- Required profile steps include organiser name and city; if the admin has not set them they appear as questions (reused components), so the count can exceed 10.
- Not built (slice A / C): dancer 4, city request, claim states, switcher, cannot-create screen.

## Left / next steps
1. Browser walk at 390x844 against a prod-shaped account (needs a signed-in session this sandbox lacks).
2. Optional: make the home card open `/account/o/go-live` instead of the wizard (needs the People arc's agreement).
3. `/code-review` round (owner types it), fix pass if any.


## Fix pass (PR #929)
- Server-required steps with no wizard entry are no longer dropped. All set reads `series_go_live_check_v1` (and a Go live refusal's own JSON) and lists every blocker with an action and, where a screen fixes it, a link (`goLiveGaps` in `goLiveModel.ts`). A bare "Not ready to go live yet." only shows when the server gave no list.
- Table test: all 9 dancer + 7 organiser required fields are wizard questions; the six fields with no step (dancer gallery, partner_search; organiser contact_email, address, maps_link, gallery) are named gaps.
- Go live is never off without a reason: "Loading your event", or "Your event did not load..." with a Retry; "Checking what is left" while the check reads. A failed check read does not block (server still decides).
- Prod-shape survey (counts only, 49 organiser pages): name 49, city 49, logo 46, category 47, founded_year 6, instagram 45, phone 43; all seven present on 6. founded_year is the usual open question.
- Not done by design: no merge of main, NewFlow.tsx claim conflicts left for the later worker.
