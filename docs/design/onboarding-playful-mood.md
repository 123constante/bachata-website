# Design record: onboarding PLAYFUL mood (behind `organiserP3`, stays OFF)

Owner picked PLAYFUL (prototype #1124). Gaps 1-3 of `docs/audits/onboarding-tapthrough-2026-10-29.md` only.
The prototype's playful mood is only the gold title plus the friendlier Welcome title (`buildWelcome`),
so nothing else is invented: no new layouts, nothing added to the empty lower half.

## Changes
1. Welcome title: `welcomeTitle(firstName, pageName)` in `pageModel.ts` (one mapping, table-tested):
   "Hey <first word of first name>, you made it!"; names over 24 code points are clipped with an ellipsis;
   no first name falls back to "Welcome to <page>" / "Welcome".
2. Picked chips (nationality, styles, levels, languages) now pop and the little remove dot turns gold, as the
   cards' tick already did. Photo helper gains the prototype's "A clear face shot works best."
   Reduced-motion switch includes the new animation.
3. Flags: when the flagcdn image fails the chip shows the emoji flag (`flagEmoji`), never an empty box.

## Pictures (390x844, built with `playful-walk.spec.ts.txt`, every server call faked)
| Screen | Before (main) | After |
|---|---|---|
| Welcome | before/light-welcome.png, before/dark-welcome.png | after/light-welcome.png, after/dark-welcome.png |
| Photo | before/light-photo.png, before/dark-photo.png | after/light-photo.png, after/dark-photo.png |
| Nationality | before/light-nat.png, before/dark-nat.png | after/light-nat.png, after/dark-nat.png |
| Nationality, UK picked | before/light-nat-picked.png, before/dark-nat-picked.png | after/light-nat-picked.png, after/dark-nat-picked.png |
| Styles, picked | before/light-styles-picked.png, before/dark-styles-picked.png | after/light-styles-picked.png, after/dark-styles-picked.png |
| Flags when the CDN fails | (empty grey boxes) | after-flagfail/*-nat*.png |

Measured per screen on the walk (`*-metrics.json`): page scroll 0, sideways scroll 0, taps under 44px: none.
Colours reuse existing tokens (`--gold`, `--btnfg`, `--gold-fg`): no new colour pair.
