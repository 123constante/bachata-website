Find step now says new organiser pages are by invite, offers "Message us" links when configured, and relabels the button "Have an invite? Create a page". Copy only; behaviour unchanged.

## Verified on real data
- Shapes surveyed: read-only SELECT on prod: trigger `trg_organiser_self_serve_door_v1` is enabled and still raises `organiser_invite_required` (invite-only holds today). Find states: no results / results / search error / short query x support links both / WhatsApp / email / none.
- Checks run: findFooter.matrix (written red first), all p3/onboarding vitest (652 pass), check:mojibake clean, tsc -p tsconfig.app.json: 0 new errors (1 pre-existing at OnboardingFlow.tsx:314).
- NOT verified: full CI jobs and pre-ship locally; real Vercel support env values.
## Phone QA
- Sizes checked: 390x844 not walked.
- Walked: nothing in a browser; jsdom tests only. Tap targets set to 44px min-height.
- Not verified: visual layout of the note and links at 390x844, screenshots (needs owner or a follow-up walk).
