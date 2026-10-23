# Dancer bar blend &mdash; Design Gate (one Back, no box)

Ticket dt_b9192c70afac, brief `brief/dancer-bar-blend:briefs/dancer-bar-blend.md`. Owner said yes 2026-10-22.
It lives in `docs/people-arc/`, not `docs/design/` as the brief says: a dancer-area PR may add docs only under
the isolation allow-list's doc prefixes (`docs/handover/`, `docs/people-arc/`, ...), and `docs/design/` is not one.
Everything is behind `flags.personHub` (default OFF). Flag OFF renders today's page (unchanged DOM; the
`dancerPage.today` and `embedded` snapshots are untouched).

## What changes (flag ON, /dancers/:id public page)

| Fix | Before (#956) | After |
|---|---|---|
| Bar ground | Solid warm `WALL.page` band painted ON the bar, full-bleed to both screen edges, fading only top (12 px) and bottom (24 px). At 390 it reads as a box: warm right up to the screen edge, with a short bottom edge onto the teal. | The warm ground is its own `aria-hidden` layer behind the bar (`DancerRoleBar`), faded on THREE sides: a mask fades it out over 24 px at the left and right, the fill fades in over 12 px at the top and out over 32 px at the bottom. The text and pills are never masked. |
| Back | Two: the bar's "Back to &lt;name&gt;" and the card's own "Back" (to /dancers). | One: while the bar is on screen the card drops its Back (`back={false}`); Share stays, right-aligned. No bar (no public role, reads not answered yet, a /people tab) = today's Back. |
| Hero labels | DANCER `#CFF3F6` (4.04 on the lightest stop `#1C7D93`), Dancing / Level / Style / SPEAKS `#BFE9EE` (3.66). | `#F5FDFE` for all five: 4.62 on the lightest stop. Flag OFF keeps today's colours (see Owner call 1). |

## Where it lives (and why not in person-page)

`src/modules/dancer-app/public-page/DancerRoleBar.tsx` (the ground + `RoleSwitchView`) and `roleBarModel.ts`
(fades + `useDancerRoleBar`, which reads nothing off the public-page branch or when embedded). The bar's labels, links and pills still come from the ONE person-page mapping
(`roleSwitchModel`, `RoleSwitchView`); only the ground is drawn here. A cleaner home would be a
`useRoleSwitch` hook in `person-page/RoleSwitchBar.tsx`, but a dancer-area PR may change only
`src/modules/dancer-app/**`, tests and the seam files (`check-dancer-area-isolation`, rule a), and no
person-page file is a seam; adding one is an orchestrator decision. So `useDancerRoleBar` repeats
`RoleSwitch`'s three-line gate (embedded / answered / has a visible role). Owner call 2.

The teacher page still gets the #956 bar through `AlsoRoles` (unchanged); the DJ page's bar has no fade (unchanged).

## Numbers (REAL app: react-router dev server, `GlobalLayout` with the real site header + footer, prod data via the anon key, 390x844, flag ON)

Walked: `bisket` (DJ+dancer), `tuli` (DJ+dancer), `giovana-rafael-bzuk26` (teacher+dancer = one role page),
`spyridoula` (no public role, no photo, thin), `ricky-quinonez` (teacher+DJ+dancer, languages, facts).
Raw: `dancer-bar-blend/walk-before.json` (main) and `walk-after.json`.

| Measure | Before (main) | After |
|---|---|---|
| Back controls on screen | 2 on the 4 hub dancers, 1 on spyridoula | **1 on all 5** |
| Colour at the screen edge (x=1) mid-bar | rgb(30,20,16) warm: the box runs off-screen | rgb(7,24,30) ~ teal page rgb(6,25,31) |
| Bottom fade / side fade | 24 px / none | 32 px / 24 px |
| Largest one-row step down the ground (x = 2, 8, 382, 388; bar top to 20 px into the card) | 2 | **1** |
| Largest one-column step across the ground (rows in the top fade, under Back, in the bottom fade) | 0&ndash;1 (no side edge in view: solid to the screen edge) | **2** (the side fade) |
| scrollWidth | 390 | 390 |
| Controls &lt; 44 px | 1 | 1: the pre-existing inline "Get your own card" link inside the signed-out Join sentence (F13, untouched; inline links are exempt under WCAG 2.5.8). Every bar control (Back, pills) is 44. |
| Label contrast, strict (on the lightest stop) | 3.66 (Style, SPEAKS, Dancing, Level), 4.04 (DANCER) | **4.62** all |
| Label contrast, on the real pixels under each label | 6.20&ndash;7.16 | 7.84&ndash;9.05 |

Honest note on the metric. A one-row step cannot show this seam: before, the bottom fade already changed
only 2/255 per row, yet the owner saw a box. #956's walk window started 20 px above the bar, so it also
caught the site header's gold rule (the 27&ndash;30 "steps" in my first run were that rule, not the bar). What
shows the box is where the warm stops: before it ran solid to both screen edges and ended over 24 px at the
bottom; after it reaches the teal at the screen edges and ends over 32 px. The pictures are the evidence;
the orchestrator's 390x844 walk is the final look.

## Pictures (looked at one by one)

`dancer-bar-blend/before-bisket.png` (main: two Backs, warm box to the edges), `after-bisket.png`,
`after-ricky-quinonez.png` (two pills), `after-giovana-rafael-bzuk26.png` (one role page: Back row only),
`after-spyridoula.png` (no hub: no bar, today's Back). Avatars show their alt text: the dev browser could not
load the image CDN through the sandbox proxy (not a page fault; not verified here).

## Tests (red first)

`src/modules/dancer-app/public-page/__tests__/oneBack.test.tsx`, 52 cases: 4 dancer shapes (thin, overfull,
no photo, long name) x 4 role shapes (no public role, one role, teacher+dancer, DJ+dancer) x {flag OFF, flag ON
answered, flag ON not answered} = exactly one Back, the right one; the ground layer (sides mask + top/bottom
fill, nothing on the bar itself); the labels &ge; 4.5 on the lightest stop with the flag ON and today's colours
OFF; a /people/:id tab via the `embedded` prop alone shows no bar and no Back. On main: 14 failed (12
two-Back cases, the ground layer, DANCER 4.04).

## Owner calls

1. **Label contrast with the flag OFF.** The brief asks for the fix AND flag OFF byte-for-byte, so the new label
   colour is behind `flags.personHub`. Live today the labels measure 6.2&ndash;7.2 on their real pixels; only the
   strict lightest-stop reading fails. To apply it everywhere: make `labelColor` in `PublicDancerPageV2.tsx` return
   `LABEL_AA` unconditionally (and re-pin any snapshot that captures them).
2. **Seam list.** Allow `src/modules/person-page/RoleSwitchBar.tsx` as a dancer-area seam and `useDancerRoleBar`
   folds into one shared `useRoleSwitch` hook (no repeated gate).
3. Value text (`#EAF7FA`, 4.36) and the role line (`#DDF6F8`, 4.23) also read under 4.5 by the strict
   lightest-stop rule, though they sit lower on the darker part of the gradient (real pixels well above 4.5).
   Not in the brief; not changed.
