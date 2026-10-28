# Hide the dancer-profile banner on /ambassador (option A)

Full design record: `docs/design/ambassador-a1-banner.md` on branch `claude/ambassador-a1-banner-mockups`.

## Brief
A signed-in account with no dancer profile reviews the pending queue at `/ambassador`. The global banner ("Your dancer profile is missing") pushes the queue down. Goal: the queue is the first thing on screen.

## Option A (owner pick, 2026-10-27)
Add `/ambassador` and `/ambassador/*` to `BANNER_HIDDEN_ON` in `src/lib/profileCompletion.ts`. No UI change. The banner still shows on every other page. Trade-off: the person is not told on this page they have no dancer profile; reviewing needs none.

## Measurements (mockups, headless Chromium, 390x844)

| | Today (mock) | A |
| --- | --- | --- |
| Height above first queue row (list) | 152 px | 0 |
| Height above review content | 152 px | 0 |

The owner's screenshot of the real banner is about 190 px, so the saving is at least this.

## Not verified
- The real component and real banner height were not rendered; numbers come from the mock.
- No real phone, no WhatsApp tap, no iOS Safari.
- No `/ambassador` route existed in `src` on `main` when the design was written; the match is on pathname only.
