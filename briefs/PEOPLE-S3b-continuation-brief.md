# People arc S3b -- DJ world continuation: invite everywhere, one world shell, thin-page wording, short-page footer, serif font

Continue on branch `claude/people-dj-world` (PR #984, head e64b952). Lane: normal. Website only, no database change.
Everything stays behind `flags.personWorlds`; flag OFF must stay exactly as main today.
Read first: `docs/people-arc/s3/HANDOVER.md` and `docs/design/people-s3-critique.md` on this branch (your own earlier work),
and the original brief `briefs/PEOPLE-S3-dj-world-brief.md` on `brief/people-arc` (file ownership and decisions still apply).

## File ownership (unchanged, plus one additive change)
You own `app/routes/djs.tsx`, `src/pages/DJProfile.tsx`, `src/components/dj/**`, `src/modules/person-page/worlds/dj/**`,
`src/modules/person-page/frame/**`, `facts/**`, `worlds/tokens.ts`. NEW for this pass: one ADDITIVE opt-out prop on
`src/components/layout/GlobalLayout.tsx` (default behaviour unchanged for every other page). Do NOT touch the dancer page or
`src/modules/dancer-app/**` (S2 adopts your shell after you merge). Nobody touches `src/modules/person-page/wall/**`.

## What the owner saw / decided (binding)
- (a) D8' (owner, 16:20Z): "Get your own card" invite shows on EVERY person page regardless of the person's roles -- it speaks
  to the visitor. Today `worlds/dj/model.ts` line ~75 shows it only when `!p.roles.includes('dancer')`, so it is missing on
  papacito, jeff, brito, chong. Drop the role condition (keep waiting for `rolesAnswered` only if that avoids a load jump;
  otherwise show it always). Check that would have caught it: a matrix row per shape asserting the invite is present.
- (b) FRAME JUMP (owner spotted the frame mismatch at 17:05Z; my combined walk measured it): each world's page owns the
  padding around `PersonFrame` -- DJ page `px-3 pt-2`, dancer page `px-4 pt-3` -- so switching tab moves the Back button
  4px right and 3px down and the bar gets 7px narrower (Back L10 T113 vs L14 T116; bar W361 vs W354). Fix the CLASS:
  export ONE shared shell from `frame/` (e.g. `WorldPage`) that renders `GlobalLayout` + the page padding + `PersonFrame`
  slot, so worlds never wrap the frame themselves. Use it for every flag-ON DJ state (loading, not-found/thin, full).
  Add a test that renders each world page that exists on this branch through the shell and asserts the frame sits inside the
  shell with identical classes/styles, and a guard test that fails if a world file wraps `PersonFrame` in its own padding
  (S2 will adopt it; write the API so a dancer page can drop `px-4 pt-3` and call the shell -- document it in the handover).
- (c) D11 Thin DJ page: a muted line above the button -- "No dates on the calendar yet." when the DJ has 0 dates at all,
  "No dates coming up yet." when they only have past dates. D12 the button reads "Find a party" and goes to `/parties`
  (today `emptyAction` reads "Parties this week"). Wording lives in one place (model), matrix-tested per shape.
  Muted line contrast still >= 4.5.
- (d) D13 Short pages: on the people worlds only, the footer comes straight after the content (no empty ground before it).
  Today `GlobalLayout` has `min-h-screen` (line ~211) and the flag-ON DJ states add their own min heights. Add the opt-out prop
  to `GlobalLayout`, pass it from the shell, and remove the worlds' own `min-h-screen` / `HUB.groundMinHeight` on the flag-ON
  path. Every other page unchanged (test: GlobalLayout default still has min-h-screen).
- (e) DM Serif Display: the frame loads it whenever a DJ world or a DJ preview (e.g. a DJ card shown inside another world)
  is on screen, not only on `/djs/:id` (today `useDjPageFonts()` is called in `DJProfile.tsx` only). Put the call where the
  DJ serif is used (shell or the DJ preview component), idempotent, with a test.

## Tests (red first for a, b, c, d)
Run the new tests against the current head first and record that they fail. Extend `src/pages/__tests__/DJProfileWorlds.test.tsx`
matrix (every shape x flag ON/OFF). Mutate each fix away once and confirm a test goes red.

## Design Gate 4 + walk
Screenshots at 390x844 and 360x800 for papacito, jeff, brito, chong, carlos-de-la-cruz, dj-chino-bzuk26, bobby-blanco (prod
data, flag ON). For each: invite present, thin wording right, footer straight after content, Back L/T and bar width recorded
(they must equal the numbers on every other shape). Contrast, taps >= 44px, no sideways scroll. Update
`docs/design/people-s3-dj-world.md`.

## Checks before push
Run every CI job step that applies (read `.github/workflows`). Update the PR #984 body: per-job CI table, then
"## Verified on real data" with lines starting EXACTLY `- Shapes surveyed: `, `- Checks run: `, `- NOT verified: `
(no bold, nothing between the label and the colon), and "## Phone QA".

## Handover
Push once. Append an "S3b" section to `docs/people-arc/s3/HANDOVER.md`: head sha, what changed per item a-e, the shell API
for S2 (exact import + props + what S2 deletes), the frame box numbers per shape, not verified.
