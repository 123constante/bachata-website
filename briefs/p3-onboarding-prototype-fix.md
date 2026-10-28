# Brief: onboarding prototype, FIX ROUND 1 (the only one)

Same branch, same two files: `docs/design/onboarding-prototype.html` and `.md` on claude/p3-onboarding-prototype (PR #1124). Original brief: `briefs/p3-onboarding-prototype.md` on branch brief/p3-onboarding-prototype. An independent critique is in `docs/review/onboarding-prototype-r1.md` on branch claude/review-onboarding-prototype (git fetch it, read it fully; its line numbers are at head 8bae8e3).

Do fixes 1 to 11 from that review, with these decisions from the program lead:
- Fix 1 (BLOCK) first: `[hidden]{display:none!important}`, then re-run ALL your own checks (130%, 320 px, 390 px, contrast, taps) with the hidden parts really hidden, and walk every screen again by tapping.
- Fix 2: grace shows the banner and lets Add an event through; add a drawer state "Grace ended" where it opens the gate.
- Fix 3: draw the A5 "Your page" step (category cards, one link, logo) and add its rows to Review and Home; dots become 8.
- Fix 4: KEEP the "Not sure yet" card (owner accepted it) but mark it in the .md as an assumption that also needs a status-RPC change in admin, and make Review treat it as missing so the prototype never shows a state the backend cannot produce.
- Fix 7: the .md states the true-black dark block replaces P3's dark block for every P3 surface (one token set).
- Fixes 5, 6, 8, 9, 10, 11 as written in the review.
No other changes, no new scope (ideas to the Parked list). Keep the file under 600 KB and fully offline. Push once at the end with the subject ending [worker-done <ticket>], context under 35%. Also update the .md "checks" section with the new results and an honest Not verified list.
