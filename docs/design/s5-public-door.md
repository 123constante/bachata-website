# S5 public door "I run events" (design record)

Brief: `docs/briefs/s5-screens.md` on branch `brief/s5-screens`. DB contract: admin PR #1018 (`docs/db-contracts.md`, "Organiser front door S5 public door"). PARKED: never merged until #1002 then #1018 are applied; the door stays OFF.

## Route and switch
- `/run-events` (not `/organisers/start`: the framework route `organisers/:id` would take "start" as an id). Registered in `AnimatedRoutes.tsx` and `catchallClientPaths.ts`; breadcrumb id `organiser.door`. No header/footer link in this PR.
- Env: Vite only exposes `VITE_*`, so the brief's `NEXT_PUBLIC_ORGANISER_DOOR` / `NEXT_PUBLIC_TURNSTILE_SITE_KEY` are `VITE_ORGANISER_DOOR=on` and `VITE_TURNSTILE_SITE_KEY`. Unset = closed page / no widget.

## Layout (390x844, single column, tokens only)
1. Closed page: title, one paragraph, three buttons (Browse events, Message us, Sign in to your page).
2. Public door: who it is for, 3 numbered steps, email box, "Send me a code", Turnstile slot (only with a key), then the terms line. After sending, the same card swaps to the code box (8-digit pattern shared with `EmailCodeProof`).
3. Start your page: name, city (existing `CityPicker`), debounced "Is this you?" cards (max 5, "Yes, that's mine" links to the page and says nothing is claimed; "No, create a new page" submits), Create my page.
4. Result screens: one mapping (`doorModel.startView`) for every code; each has at least one primary button.

Chosen: one route, state derived from env + auth + RPC result, so a reload resumes correctly and the closed page is the default. Buttons are 48px, fields 16px text (no iOS zoom), explicit px sizes per the 13.5px html trap.

## Files
`src/modules/organiser-door/`: `doorModel.ts` (all words/controls), `doorParse.ts` (boundary parsers; allow-listed in `lint-runtime-architecture.mjs` for `organiser_id`), `doorApi.ts` (RPCs by string name; not in generated types yet), `DoorScreens.tsx`, `DoorPage.tsx`, `Turnstile.tsx`.

## Checks
Table-driven tests: door on/off x signed in/out x every start code x lookalikes none/1/5/rate-limited/error x Turnstile key set/unset; untouched form sends nothing; double submit sends once; CSP pins (`tests/doorCsp.test.ts`). 390px screenshots: not captured (see PR body).
