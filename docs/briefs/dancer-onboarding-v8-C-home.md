# Brief C (index + shared spec): Home for v8 (sneak peek, progress ring, win badge, cleanup)

Repo: Website. Needs Brief A merged (B3 for confetti). Flags: VITE_ENABLE_DANCER_ONBOARDING_V3 for ring/peek/shine; VITE_ENABLE_DANCER_LAYOUT_C (Home layout C) is the layout these changes target. Flag off = Home unchanged.
Split (one PR each, max 5 files / 400 lines):
- dancer-onboarding-v8-C1-sneak-peek.md: locked real Home, shake, toast
- dancer-onboarding-v8-C2-ring-win-cleanup.md: progress ring card, 100% badge + confetti, remove "Nothing planned yet", Shine card parity
Merge order: C1 (needs A) and C2 (needs A, B3 neonConfetti) are independent of each other.

## Owner rules (binding)
- Remove the "Nothing planned yet" card, including its "Find events this week" button, from Home GO OUT. KEEP the ticket QR + door code + pager "Ticket 1 of 2" and the "1 night attended" tile.
- Sneak peek = the dancer's REAL Home, shown clearly (not blurred), every item locked with a lock icon. Tap a locked item: it shakes gently, message "Finish your profile to unlock this" + Finish button.
- Progress % = exactly what the mockup JS counts (Brief A profileProgress).
- 100%: card becomes a badge, full confetti, "Profile complete".

## Home order after v8 (journey Option A, home-profile-card-journey.html)
Top bar, "Hi {name}" (Anton 30px in the mockup look only where noted), linked-profile card (existing: "We've linked your profile" / "A profile made for you by the Bachata Calendar team is now yours. Have a look and make it right." / "Check my profile" -> Me tab, "Got it" -> removes card; unchanged), GO OUT label, "Your ticket" QR + door code + pager (kept), "Nothing planned yet" REMOVED, "1 night attended" (kept), Shine card, BE FOUND (Share my page, Preview my page).

## Facts about live code (origin/main)
- screens/home/HomeScreen.tsx -> HomeBodyView picks HomeCView (layout C) / B / A. homeOptionB.tsx: `FocusBody` has kinds 'profile' | 'night' | 'find'. 'find' is the "Nothing planned yet" h2 + "Tap Going on a night and it shows up here." + "Find events this week" link (~lines 58-64). HomeCView renders it in `home-c-go-card`; it also renders `{DANCER_ONBOARDING_V3_ENABLED && <ShineCard/>}`.
- homeFocus.ts: FocusKind, homeBView, homeCView, REQUIRED_TOTAL 4. ShineCard.tsx: SHINE_ADD_PATH '/app/welcome?step=bio&returnTo=/app/home', 30-day dismiss key dancer_app_shine_dismissed:${userId}, testids home-shine / home-shine-add / home-shine-dismiss.
- Tests to update (not delete intent): homeLayoutC.test.tsx:207 asserts "Nothing planned yet.*Find events this week"; homeOptionB.test.tsx:88 asserts home-b-cta 'Find events this week'.
- shell/focusChrome.ts + src/lib/focusMode.ts: /app/welcome hides chrome while the profile is incomplete; keep.

## Owner questions to carry
1. 100% reachable? mockup tot=7 vs max 6 items (see Brief A). Default total 6.
2. Ring card REPLACES the existing "Get ready" profile card (FocusBody 'profile') on Home? Default: replaces (one progress element only). Owner to confirm.
3. DECIDED by owner 2026-11-25: partner step is asked of everyone; no non-dancer exception. Also DECIDED: total = 6, 'You're in' = auto-advance with NO buttons, ring card REPLACES 'Get ready'.
