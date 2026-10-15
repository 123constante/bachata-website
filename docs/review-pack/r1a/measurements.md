# R1a review pack: 390x844 measurements (MOCKED RPCs)

Every screenshot here is drawn against **MOCKED RPCs** (the organiser fake + page.route; no real backend), Chromium at 390x844, branch claude/dancer-app-r1a.
Regenerate: REVIEW_PACK_DIR=docs/review-pack/r1a npx playwright test tests/e2e/dancer-app/review-pack.spec.ts --project=chromium --workers=1

Columns: scrollWidth/clientWidth (no horizontal scroll when equal to 390); controls under 44px (every visible a/button/input/select/textarea/[role=button|switch] in the dancer shell); the primary control picked on the screen and whether document.elementFromPoint at its centre lands on it (nothing covers it).

Shapes: new-stub (emptyStub), partial (name + city), complete-extras (100% + 3 nights), long-name-city (21-char first name, 31-char surname, 40-char city), no-photo (review B1: 55%, name + city + role, no photo, so the next step is the photo), link-no-bio (real-data fixes F1-F3: 90%, website, Facebook and Instagram but no bio, the website stored without https://, a WhatsApp-eligible person with no number), legacy-photo (avatar on a host outside app/csp.ts img-src). Photo URLs in the mocks are on img.example, which the CSP also blocks, so every photo shape shows the initial fallback; a real r2.dev photo would show the image.

| Screen x shape | Landed on | scrollWidth | Controls < 44px | Primary control | elementFromPoint |
|---|---|---|---|---|---|
| welcome x new-stub | /app/welcome | 390/390 | none | onboarding-continue | on it |
| home x new-stub | /app/home | 390/390 | none | Browse what’s on | on it |
| nights x new-stub | /app/nights | 390/390 | none | Browse what’s on | on it |
| me x new-stub | /app/me | 390/390 | none | me-main-action | on it |
| edit x new-stub | /app/me/edit | 390/390 | none | edit-save | on it |
| photo x new-stub | /app/me/photo | 390/390 | none | Take photo | on it |
| options x new-stub | /app/options | 390/390 | none | opt-switch-organiser | on it |
| welcome x partial | /app/welcome | 390/390 | none | onboarding-continue | on it |
| home x partial | /app/home | 390/390 | none | Browse what’s on | on it |
| nights x partial | /app/nights | 390/390 | none | Browse what’s on | on it |
| me x partial | /app/me | 390/390 | none | me-main-action | on it |
| edit x partial | /app/me/edit | 390/390 | none | edit-save | on it |
| photo x partial | /app/me/photo | 390/390 | none | Take photo | on it |
| options x partial | /app/options | 390/390 | none | opt-switch-organiser | on it |
| welcome x complete-extras | /app/home | 390/390 | none | See event | on it |
| home x complete-extras | /app/home | 390/390 | none | See event | on it |
| nights x complete-extras | /app/nights | 390/390 | none | Soho Sensual Thursdays | on it |
| me x complete-extras | /app/me | 390/390 | none | me-main-action | on it |
| edit x complete-extras | /app/me/edit | 390/390 | none | edit-save | on it |
| photo x complete-extras | /app/me/photo | 390/390 | none | Take photo | on it |
| options x complete-extras | /app/options | 390/390 | none | opt-switch-organiser | on it |
| welcome x long-name-city | /app/home | 390/390 | none | See event | on it |
| home x long-name-city | /app/home | 390/390 | none | See event | on it |
| nights x long-name-city | /app/nights | 390/390 | none | Soho Sensual Thursdays | on it |
| me x long-name-city | /app/me | 390/390 | none | me-main-action | on it |
| edit x long-name-city | /app/me/edit | 390/390 | none | edit-save | on it |
| photo x long-name-city | /app/me/photo | 390/390 | none | Take photo | on it |
| options x long-name-city | /app/options | 390/390 | none | opt-switch-organiser | on it |
| welcome x no-photo | /app/welcome | 390/390 | none | onboarding-take-photo | on it |
| home x no-photo | /app/home | 390/390 | none | Browse what’s on | on it |
| nights x no-photo | /app/nights | 390/390 | none | Browse what’s on | on it |
| me x no-photo | /app/me | 390/390 | none | me-main-action | on it |
| edit x no-photo | /app/me/edit | 390/390 | none | edit-save | on it |
| photo x no-photo | /app/me/photo | 390/390 | none | Take photo | on it |
| options x no-photo | /app/options | 390/390 | none | opt-switch-organiser | on it |
| welcome x link-no-bio | /app/home | 390/390 | none | See event | on it |
| home x link-no-bio | /app/home | 390/390 | none | See event | on it |
| nights x link-no-bio | /app/nights | 390/390 | none | Soho Sensual Thursdays | on it |
| me x link-no-bio | /app/me | 390/390 | none | me-main-action | on it |
| edit x link-no-bio | /app/me/edit | 390/390 | none | edit-save | on it |
| photo x link-no-bio | /app/me/photo | 390/390 | none | Take photo | on it |
| options x link-no-bio | /app/options | 390/390 | none | opt-switch-organiser | on it |
| welcome x legacy-photo | /app/welcome | 390/390 | none | onboarding-boost | on it |
| home x legacy-photo | /app/home | 390/390 | none | See event | on it |
| nights x legacy-photo | /app/nights | 390/390 | none | Soho Sensual Thursdays | on it |
| me x legacy-photo | /app/me | 390/390 | none | me-main-action | on it |
| edit x legacy-photo | /app/me/edit | 390/390 | none | edit-save | on it |
| photo x legacy-photo | /app/me/photo | 390/390 | none | Take photo | on it |
| options x legacy-photo | /app/options | 390/390 | none | opt-switch-organiser | on it |

Before the R1a fixes the same walk found: Nights night-name links 23px tall (3 per screen with nights); reachability found Edit city picker 340x34 and Options Account settings link 103x16; a legacy/blocked avatar drew a broken-image icon on Me and Home. All fixed on this branch.

Regenerated 2026-10-15 after the R1a review fixes (B1): every shape is now built through the shared derivation, so the no-photo shape really lacks a photo; Home, Me and Onboarding all say "Add your photo to reach 70%." on it, and Welcome x no-photo now lands on the photo step (primary onboarding-take-photo, was onboarding-boost). Every other row is unchanged from the previous run.

Regenerated 2026-10-15 after the real-data fixes F1-F3: the new link-no-bio shape adds 7 rows (every one 390/390, no control under 44px, primary on it). Home and Me say "Add a short bio towards 100%."; Edit shows the calm website hint, Save off only for "Nothing has changed yet", and the WhatsApp switch disabled with its reason. Every other row and every other screenshot is byte-identical to the previous run.
