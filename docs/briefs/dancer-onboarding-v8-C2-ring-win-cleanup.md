# Brief C2: Progress ring card, 100% badge, remove "Nothing planned yet", Shine parity

Repo: Website. Branch: claude/dancer-onboarding-v8-c2-ring-win. Size: 5 files, ~390 lines. Needs Brief A and B3 (neonConfetti) merged. Index: dancer-onboarding-v8-C-home.md. Flags: DANCER_ONBOARDING_V3_ENABLED + layout C.

## 1. Remove "Nothing planned yet" (applies in layout C; flag-gated by ONBOARDING_V3 so flag off keeps prod)
In homeOptionB.tsx FocusBody 'find': render nothing (no h2 "Nothing planned yet", no "Tap Going on a night and it shows up here.", no "Find events this week" link). `home-c-go-card` is not rendered when kind is 'find' (and the empty go-card wrapper must not leave a gap). Keep: ticket QR + door code + pager "Ticket 1 of 2", `home-b-attended` "1 night attended", more-plans rows.
Update tests: homeLayoutC.test.tsx:207 (new assertion: no go-card, no "Nothing planned yet" / "Find events this week" text), homeOptionB.test.tsx:88 (home-b-cta absence under the flag). Order lists in homeLayoutC.test.tsx (lines ~78-139) drop 'home-c-go-card' for no-event cases under the flag.

## 2. Ring card (replaces "Get ready" profile card when profile incomplete)
Card (.card) with ring row; values from Brief A `profileProgress`:
- SVG 84x84, circle r=34, stroke-width 9, track stroke rgba(255,255,255,.2), progress circle stroke gradient #ff2d95 -> #ffa600, stroke-linecap round, stroke-dasharray 213.6 (RING_CIRC), start dashoffset 213.6, transform rotate(-90).
- Animate dashoffset to 213.6*(1-pct/100) with transition 1.1s cubic-bezier(.2,.8,.2,1), set after a double requestAnimationFrame.
- Beside it: bold 22px count that counts up +3 every 18ms until pct, then "%"; line "Your profile"; amber (#ffa600) line "Next: {profileProgress.next label} (+1 step closer)" e.g. "Next: add a bio (+1 step closer)".
- Below: chips for missing optionals only: "＋ Add a bio" and "＋ Add a link" (both -> SHINE_ADD_PATH existing `/app/welcome?step=bio&returnTo=/app/home`). Required missing items (photo/years/styles) link to their onboarding step.
- Reduced motion: show final offset and number at once.
- Default decision (owner to confirm, see index Q2): replaces FocusBody 'profile'.

## 3. 100% win
When pct === 100: card becomes `.card.win`: bg linear-gradient(135deg, rgba(255,45,149,.35), rgba(255,166,0,.35)), border #ffa600, `pop` animation .6s (scale .8 -> 1.06 -> 1); content centred: 🏆 44px, "Profile complete" bold 20px, "You are fully visible to dancers and organisers." 250ms after reaching 100% fire neonConfetti big (once, guard `won` persisted per user in session/localStorage so reload does not repeat). The badge stays on Home afterwards.

## 4. Shine card parity (journey Option A)
Keep ShineCard behaviour: copy "Add a bio and a link so dancers know you."; orange "Add" button -> SHINE_ADD_PATH; ✕ dismiss 28px at top 8 right 8; dismiss hides and returns after 30 days (existing key). Do NOT build the mockup-only green dashed outline or the "NEW" tag. Verify existing test ids home-shine, home-shine-add, home-shine-dismiss.

## Files (src/modules/dancer-app/screens/home/)
1. ProgressRingCard.tsx (NEW) 2. progressRing.css (NEW) 3. homeOptionB.tsx (EDIT: FocusBody 'find' + wire ring) 4. __tests__/homeLayoutC.test.tsx + homeOptionB.test.tsx (EDIT, counts as one touch only if kept tiny; else STOP and tell lead) 5. __tests__/progressRingCard.test.tsx (NEW).

## Tap table
Add a bio / Add a link chip | /app/welcome?step=bio&returnTo=/app/home | journey; Shine Add | same | journey; Shine ✕ | hides 30 days | journey; Check my profile | Me tab | existing; Got it | removes linked card | existing; Share my page / Preview my page | existing; ticket pager | existing.
## Tests
Ring: offset math at 0/33/50/86/100; count-up steps; next-label per missing item; win card at 100, confetti fires once; "Nothing planned yet" and "Find events this week" absent with flag on, present with flag off; ticket, pager, "1 night attended" still rendered (keep-list).
## Rollout
Land behind flag; final tiny PR flips VITE_ENABLE_DANCER_ONBOARDING_V3 only after A, B1-B4, C1, C2 merged and the Dell prod walk.
