# Brief B2: Partner + sheet, Photo, Bio+links (Neon)

Repo: Website. Branch: claude/dancer-onboarding-v8-b2-partner-photo-bio. Size: 4 files, ~380 lines. Needs Brief A and B1 merged. Shared spec: dancer-onboarding-v8-B-screens.md.
Files (under src/modules/dancer-app/screens/onboarding/): neon/NeonStepsB.tsx (NEW), neon/neon.css (EDIT: add sheet/photoadd/toast-free classes), OnboardingV3.tsx (EDIT: wire), __tests__/neonStepsB.test.tsx (NEW).

## Partner (pos 3)
h2 "Looking for a dance partner?"; sub "Say yes and we show you to dancers who want a partner."; rows 🤝 "Yes, I am"; 🙂 "No, just social dancing"; Continue disabled until answered.
Tap Yes -> bottom sheet opens. Tap No -> selected, Continue advances.
Continue with Yes and sheet incomplete -> reopens sheet (Brief A partnerMissing). With complete -> advances and saves (existing saveDelta(partnerDelta)).
Sheet: left/right -22px, bottom -30px, top -120px, bg #1a0d33, radius 28px 28px 0 0, padding 16 22, border-top 1px #ff2d95, shadow 0 -10px 40px rgba(0,0,0,.6), z-index 5, scrolls. Grab bar 44x4 rgba(255,255,255,.4) centred. h3 "Your ideal partner" Anton 28px uppercase.
Sections (.sec): "What kind" chips Social dancing, Classes, Performance, Competition (multi); "Their role" Leader, Follower, Either (single); "Years dancing" 0-2, 2-5, 5+, Any (single). Note input placeholder "A line to potential partners" (margin-top 12, mb 8, max 300 chars). Hint (only while something missing): `<p class="small" style="margin:6px 0 4px">` text from PARTNER_HINT, e.g. "Pick a kind, their role and years dancing to save." Button "Save" (margin-top 4, padding 14) disabled while missing. Save closes the sheet AND auto-continues to the next step.
Storage mapping unchanged (Classes->Practice, Either->Lead and Follow).

## Photo (pos 4)
h2 "Show us your face"; sub "A photo is required. Partners and organisers need to know who you are."
Circle `.photoadd` 200x200, margin 6px auto 14px, 2px dashed rgba(255,255,255,.5), bg rgba(255,255,255,.08), flex column gap 6.
Empty: 📸 44px + "Tap to add a photo". Has photo: class on = 3px solid #ff2d95, glow 0 0 28px rgba(255,45,149,.6), 🧑 60px + "Photo added. Tap to change".
OWNER RULE: the circle ALWAYS shows the mockup stick figure/emoji, even after upload (do NOT show the real avatar). Only tick/label change. Background silhouettes always drawn.
Tap -> existing photo handoff (PHOTO_FLAG session key 'da-onboarding-v3-photo', existing upload flow); do not rebuild upload. Continue disabled until a photo exists. Confetti after Continue.

## Bio + links (pos 5)
h2 "Tell us about you"; sub "Optional. Skip any time."; textarea rows 3 placeholder "A short bio (optional)"; input placeholder "Instagram or other link (optional)"; CTA "Finish"; link "Skip for now"; small centred line "Next: your real Home, exactly as today." Confetti on Finish only when bio or link filled. Existing bioLinkResult/linkPrefill reused.
`?step=bio` entry (from the Home Shine card) keeps working: heading "Tell us about you", sub "Add a bio and a link so dancers know you. You can change this any time on Me.", textarea rows 4 placeholder "A short bio", input placeholder "Instagram or other link", button "Save", link "Not now" (back to Home, card stays). Save goes Home with the card gone if bio or link present.

## Tap table (fill in PR)
Yes | opens sheet | mockup; No | selects | mockup; Continue(partner) | next or reopen sheet | mockup; chip(kind/role/years) | toggle/single | mockup; Save | close + next | mockup; photo circle | photo handoff | mockup; Continue(photo) | bio | mockup; Finish | Home + confetti if filled | mockup; Skip for now | Home | mockup; Not now (bio-only) | Home | journey; Save (bio-only) | Home | journey.

## Tests
Keep-list per screen; partner gating (Save disabled until kind+role+years; hint text exact); photo circle stays stick figure after upload (assert no <img> avatar); Continue disabled states; bio-only variant copy.
## Not in scope
You're in, sneak peek, sign-in, Home.
