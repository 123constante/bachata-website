# Brief B (index + shared spec): dancer onboarding v8 screens, Neon Night

Repo: Website. Needs Brief A merged first. Flag: VITE_ENABLE_DANCER_ONBOARDING_V3 (DANCER_ONBOARDING_V3_ENABLED). Flag OFF = old flow unchanged.
Spec (clone 1:1, every pixel, copy line, tap, motion, stick figure): admin repo docs/design/dancer-onboarding/mockup-v8-after-code.md, direction D1 "Neon Night" only. Rules: docs/design/dancer-onboarding-rules.md.
Split (each worker one PR, max 5 files / 400 lines). Merge order B1 -> B2 -> B3 -> B4:
- dancer-onboarding-v8-B1-frame.md: neon frame + Roles, Styles, Years
- dancer-onboarding-v8-B2-partner-photo-bio.md: Partner + sheet, Photo, Bio+links
- dancer-onboarding-v8-B3-flow.md: "You're in" 2s moment, phase flow, confetti, sneak-peek hook
- dancer-onboarding-v8-B4-signin-look.md: name/city/lead-follow/email/code look (seams, look only)

## Shared spec (all B briefs copy these values)
Phone 390x844. Fonts: Anton (headings), Inter (body). Page bg #0b0614. Palette D1: #ff2d95, #7a1fff, #ffa600, #12072a.
Anton is NOT loaded in the Website today. Load it via index.html (allowlisted seam) with a Google Fonts link for Anton; src/main.tsx is NOT on the isolation allowlist, do not touch it. Inter is already self-hosted.

Photo background (every step screen): SVG from `photo(d,id)`: radial gradient of the palette, blurred bokeh circles, two dancer silhouettes (stick-figure drawing). Copy the SVG path data verbatim from the mockup file into a NEW file `neon/NeonPhoto.tsx` (B1). Overlay gradient 180deg rgba(11,6,20,.1) 0%, .55 40%, .95 78%.
Segment bar: 6 segments, 4px high, gap 4px, left/right 20px, top 20px; segment k<=pos white, rest rgba(255,255,255,.35). Order after code: Roles, Styles, Years, Partner, Photo, Bio+links. OWNER 2026-11-25: Partner is shown to EVERY role (all roles have a dancer profile), never skipped; bar then still shows its segment count of the steps actually used (mockup: ORDER array filtered; follow the mockup).
Back: top 34px, left 14px, text "‹ Back", Inter 600 15px, bg rgba(0,0,0,.35), radius 99px, padding 6px 12px; shown when pos>0.
Body: left 22, right 22, bottom 30, top 300 (years: top 215px; "You're in" and sneak peek: top 52px).
h2.q Anton 54px/1 uppercase, letter-spacing .01em, text-wrap balance, margin 0 0 8px. .sub margin 0 0 18px opacity .85.
.opt flex, gap 12, mb 10, bg rgba(255,255,255,.08), border 1px rgba(255,255,255,.2), radius 16, padding 14, backdrop-filter blur 8px. .opt.on bg rgba(255,45,149,.25), border #ff2d95, shadow 0 0 22px rgba(255,45,149,.55). .ic 26px. Tick .ck 24px circle, 2px border, opacity .6 (1 when on), shows check 14px. small 13px opacity .75.
.cta mt auto, padding 17, width 100%, 800 17px, bg linear-gradient(90deg,#ff2d95,#ffa600), white, radius 16, shadow 0 0 28px rgba(255,45,149,.6), uppercase, letter-spacing .06em; disabled opacity .4. .cta.alt transparent, 2px currentColor border.
.fld padding 16, mb 12, bg rgba(255,255,255,.1), border 1px rgba(255,255,255,.3), radius 14, white text.
.chip Inter 600 15px, bg rgba(255,255,255,.1), border 1px rgba(255,255,255,.3), radius 99, padding 10 16. .chip.on bg rgba(255,45,149,.35), border #ff2d95.
.lnk underline, opacity .8, 14px, padding 8px 0. .small 13px opacity .8. .sec 12px uppercase letter-spacing .1em opacity .75 margin 12px 0 8px.
Bottom bar (.sheet/.peekbar): linear-gradient(180deg, rgba(11,6,20,0), rgba(11,6,20,.97) 30%), padding 16 22 28, left/right -22px, bottom -30px; `b` Anton 28px uppercase.

Confetti on forward navigation (CONFETTI_DELAY_MS 120 after nav, small burst via neon confetti module, built in B3) from: photo, years, styles, partner, and bio if bio or link filled. Constants come from Brief A neonMotion.ts.

## Rules for every B brief
- All new CSS in `src/modules/dancer-app/screens/onboarding/neon/neon.css` scoped under `.neon` root so nothing leaks. New components under `neon/`. Reuse existing step logic/saving (OnboardingV3 saveDelta, set_my_buyer_roles etc.); change look only unless stated.
- Keep every existing test id (onboarding-role-*, onboarding-years-*, onboarding-partner-yes/no, partner-sheet, partner-sheet-save, partner-details, onboarding-photo-tile, onboarding-bio-input, onboarding-link-input, onboarding-finish, onboarding-skip, onboarding-back, onboarding-progress, onboarding-seg).
- Every brief carries: element checklist, TAP TABLE (button | destination | mockup/OLD; one OLD row = not done), per-screen keep-list unit test, 390x844 check.
- Honour prefers-reduced-motion for shake/confetti/ring (still show end state).
- Not in scope across B: Welcome menu (stays prod), auth logic, DB, Home (Brief C).

## Owner questions to carry (do not decide in code)
1. "You're in" screen: rules say about 2 seconds, NO button; the mockup draws "Add bio and links" and "Go to Home" buttons that do nothing. Default: build auto-advance only, NO buttons. Owner to confirm.
2. Photo mockup photos are stand-in SVG silhouettes (real dance photos not supplied). Build the SVG exactly; swap later.
