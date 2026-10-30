# Review r1: Website PR #1155, onboarding playful mood

Reviewer: independent zero-context review worker (did not build this). Branch reviewed:
`claude/onboarding-playful-mood` @ `a20495f` (one commit, up to date with `main` @ `2afd8d9`).
Brief: `docs/briefs/review-onboarding-playful-mood.md` (branch `brief/review-onboarding-playful-mood`).

## Verdict: FIX FIRST

One BLOCK. The diff adds a raw U+2026 to non-test source, and that turns the existing G3 copy guard red.
CI's unit-test run would go red on this PR. The handover's "383/383" counted only the
`p3/onboarding` folder, and the guard lives outside that folder. The rest of the work is small and
sound. Once the BLOCK is fixed (a one-character change), the result is PASS with should-fix.

## Findings

### 1. BLOCK: raw ellipsis in `welcomeTitle` reds guard G3 (B-N8)
- `src/modules/organiser/p3/onboarding/pageModel.ts:476`: `` `${cps.slice(0, WELCOME_NAME_MAX - 1).join('')}…` `` is a literal U+2026.
- Failing scenario, reproduced: `npx vitest run src/modules/organiser/__tests__/consistency.matrix.test.tsx`
  on the branch gives **1 failed | 109 passed**. The failing test is
  `G3 ... > no non-test source in the module has raw Unicode punctuation outside comments (B-N8: \u escapes or HTML entities)`
  (`consistency.matrix.test.tsx:287`), which received `["p3/onboarding/pageModel.ts: U+2026"]`. On `main` the same file
  gives 110/110.
- This also contradicts the handover's claim of "no raw Unicode punctuation in JSX/TS (escapes only)" and the
  CLAUDE.md "HTML entities over raw Unicode" rule (cp1252 mojibake risk on the Cowork pipeline).
- Fix: write `…`, as the rest of this file does (for example `'You’re live'`). The test file may keep its raw
  `…` in the expected strings, because the guard scans non-test source only. Then run the whole
  `src/modules/organiser` vitest tree, not only the onboarding folder.

### 2. SHOULD-FIX: the Welcome title can change after first paint, and the greeting depends on unrelated reads
- `OnboardingFlow.tsx:202` gates the page stage on `held && d && rs` only. `firstName` comes from
  `personHeld?.first_name` (`OnboardingFlow.tsx:306`), and `personHeld` (`:153-156`) is null until the dancer, intent
  AND teacher queries have all landed.
- Scenario: the page reads land before the teacher read. Welcome first renders "Welcome to Leeds Nights", then
  becomes "Hey Sam, you made it!". The `<h1 tabIndex={-1}>` has already been focused and announced with the old
  text, so the visible title changes under the person. On a slow phone the title can also re-wrap at a different
  line count (a 2-line page name followed by a 1-line greeting), which moves the content below it.
- Second scenario: the teacher read errors. `personHeld` stays null, so the person is never greeted by name, with
  no signal. That fallback is harmless, but the greeting should not depend on the teacher query.
- Not reproduced in a browser (the author's walk faked every call at the same time). Fix options: derive the first
  name from `dancer.data` alone, and/or hold the Welcome render (skeleton) until the dancer read settles.

### 3. SHOULD-FIX: the emoji fallback is wrong for `gb-nir` and can overflow on Windows
- `ObShell.tsx` `flagEmoji`: for `gb-nir` it builds `U+1F3F4 + tags(g,b,n,i,r) + U+E007F`. Unicode has no RGI
  Northern Ireland flag (only England, Scotland and Wales are RGI). Every platform therefore renders a plain black
  flag, and some render a black flag followed by tofu. That is a wrong flag rather than an empty box, so the
  design record's "never an empty box" holds only literally.
- Windows (the reason flag images were chosen, per the comment above `Flag`) renders regional indicators as the
  two letters "GB". At `font-size: 18px` inside a `width: 24px` box (`onboarding.css`, `.p3-ob-flag[data-emoji]`),
  two Segoe UI capitals at 18px are about 24-26px wide and can spill past the box into the chip's 8px gap. The
  span has no `overflow: hidden`.
- Impact is limited, because this path runs only when flagcdn fails. Fix: map `gb-nir` to the UK flag (or keep the
  hidden box for it), and add `overflow: hidden` (or `font-size: 14px`) to the emoji span. Add `gb-nir` and
  `gb-eng`/`gb-wls` to the `flagEmoji` test.

### 4. SHOULD-FIX: the "picked" screenshots do not show a picked state
- Every `*-picked.png` in `docs/design/onboarding-playful-mood/{before,after,after-flagfail}/` is **byte-identical**
  (same md5) to its unpicked pair. Examples: `after/light-nat.png` = `after/light-nat-picked.png` (`9efa9670...`)
  and `after/dark-styles.png` = `after/dark-styles-picked.png` (`87edeabb...`). The same holds for all 12 pairs.
- So the design record's "Nationality, UK picked" and "Styles, picked" rows are not evidence of the gold remove
  dot or the picked styling. The walk's pick step evidently did not take effect before the capture. Recapture
  after a real tap and settle (wait at least 220ms or disable animation) before calling the visuals verified.

### 5. NIT: the pop replays on every remount, not only on a tap
- The animation sits on the `[aria-pressed|aria-checked="true"]` rule, so it runs whenever a picked chip mounts.
  `PersonScreens` is keyed `person-${stage.step}` (`OnboardingFlow.tsx`), so going Back into Styles or Languages
  makes every already-picked chip pop at once. That is mild and arguably playful. If unwanted, set a
  `data-just-picked` flag on the tapped chip.

### 6. NIT: dead attribute on the flag `<img>`
- `data-failed={failed ? 'true' : undefined}` on the `<img>` in `Flag` can no longer be `'true'`, because the
  `failed` branch now returns the emoji span first. Remove it.

### 7. NIT: clipping counts code points, not graphemes
- `Array.from(first)` splits by code point, so a long name with ZWJ emoji, skin tones or combining marks (NFD
  accents, Devanagari) can be cut mid-grapheme. The test "emoji is not split mid-character" covers only
  single-code-point emoji. Prod has 0 non-ASCII first names and a maximum length of 21, so this is theoretical.
  `Intl.Segmenter` would make the clip exact if it is ever needed.

### 8. NIT: the shape table misses shapes that exist in prod
- Prod has 8 first names containing an apostrophe or one of `<`, `&`, `"` (count only). React renders `titleOf` as
  a text child (`OnboardingFlow.tsx:555`, no `dangerouslySetInnerHTML`, no `document.title`), so they are escaped
  and safe. Still, the handover says "every shape is in the table" and these rows are missing. Add `O'Brien` and
  `<b>&` cases.
- Punctuation-only first word: `'. Sam'` gives "Hey ., you made it!". The literal "Hey , you made it!" cannot
  happen, because the name is trimmed and empty falls back. Optional: fall back when the first word has no letter
  (`/\p{L}/u`).
- RTL: "Hey <Arabic>, you made it!" renders correctly in an LTR paragraph, because the comma resolves to LTR.
  Wrapping the name in `<bdi>` would harden mixed names, but it is optional.

## Brief checklist

| # | Item | Result |
|---|---|---|
| 1 | Title mapping: empty, whitespace, multi-word, long, non-Latin, RTL, emoji, apostrophe, `<`, `&`, unknown fallback | Pass with findings 2, 7, 8. No unescaped render. Never "Hey , ...". Fallback correct. Title CSS has `overflow-wrap: anywhere`, so a 23-character unbroken name cannot overflow. |
| 2 | Pop reduced-motion, layout shift, focus, contrast | Reduced-motion: `.p3-ob-chip` and `.p3-ob-chip-x` were added to the off-switch. The pop is transform-only, so it causes no layout shift. The chip button stays mounted, so focus is kept. No disabled controls are touched. Contrast table below. Finding 5. |
| 3 | Flag fallback: no empty box, no jump, alt/aria, sheet rows | Fixed 24x18 box, so no jump. The emoji span is `aria-hidden`, as the img was (`alt=""`). The country name is the accessible text. The sheet rows (`CountryRows`) use the same `Flag`, so they are covered. Finding 3. |
| 4 | Scope, G3, bundle | Scope: only `src/modules/organiser/p3/onboarding/*` plus `docs/design/...` and `docs/handovers/...`. **G3: FAILS** (finding 1). The G3 "for review" wording is unaffected. Bundle: rerun on both, see below. |
| 5 | Copy | British English. No new copy points at a control that is missing. The only new copy is the Welcome title and "A clear face shot works best.", and the photo helper sits beside the photo control. No new empty states. The raw-Unicode rule is broken once (finding 1). |

### Contrast (WCAG ratio, computed from the tokens in `p3/theme/p3.css` and `onboarding.css`)
| Pair | Light | Dark (true black) |
|---|---|---|
| X glyph `--btnfg` #1d0a03 on the gold dot `--gold` #f0703a (new) | 6.46 | 6.46 |
| Gold dot vs the picked chip background `--warn-bg` (non-text, 3:1 target) | 2.51 (#fde8dc) | 5.04 (#3a2113) |
| Chip text `--fg` on `--warn-bg` (unchanged) | 15+ | 13.33 |

The light dot-vs-chip ratio of 2.51 is under 3:1, but it is not the only cue for the picked state. The X glyph on
the dot reaches 6.46, and the chip also changes border and background, so this is acceptable and not a finding.

## Commands run (this review)
- `npx vitest run src/modules/organiser/p3/onboarding` on the branch: 6 files, **383/383 pass** (matches the handover).
- `npx vitest run src/modules/organiser/__tests__/consistency.matrix.test.tsx draftOrganiser.matrix.test.tsx page/__tests__/Page.test.tsx`
  on the branch: **1 failed / 110**. On main: **110/110**.
- `npm run lint` on the branch: 22 of 22 links green. The guard that fails is a vitest test, not a lint link, so lint
  does not catch it.
- `npm run build` + `npm run check:bundle-budget`, on main and on the branch (the local node_modules first needed
  `jsqr`, which main added recently). Identical line on both:
  `[ok] dancer-app (/app/*, lazy chunk via catchall): 373.6 KB first-load JS across 49 files (budget 374 KB)`, with the
  same chunk hash `dancer-app-B_6BCgbO.js`. The zero-byte /app first-load claim is **verified**.
  "All first-load JS budgets respected" on both.
- Supabase prod `stsdtacfauprzrdebmzg`, one read-only count on `dancer_profiles`: 195 total, 49 empty, 15 multi-word,
  0 with a first word over 23 characters, 0 non-ASCII, 8 with an apostrophe or `<&"`, maximum trimmed length 21.
  This matches the handover, except for the 8 apostrophe/markup rows that are missing from its table.
- md5 of every PNG in the design folder (finding 4).

## Not verified
- No browser walk by this reviewer. Findings 2 and 3 (title flip timing, Windows glyph width, `gb-nir` rendering) are
  reasoned from code and Unicode RGI data, not observed on a device.
- Whether CI on PR #1155 is actually red. I did not query GitHub (plain git only). The failure is reproduced locally
  with the same vitest test that the unit-test job runs.
- Real flagcdn behaviour, real devices, and reduced-motion on a real OS setting (checked in CSS only).
- Screens outside the diff (find, create, contact, the invite card).
- The full `npm run test:unit` run. Only the onboarding folder and the three suites that hold "for review" or G3 were run.
