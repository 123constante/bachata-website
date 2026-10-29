# Brief: independent critique of the onboarding prototype, ROUND 2 (read-only review)

Review `docs/design/onboarding-prototype.html` and `.md` on branch claude/p3-onboarding-prototype (PR #1124, head after dt_2089206ffa4d) against the owner's round-2 picks. You did not build it. Do NOT edit the prototype. Branch for your review file: claude/review-onboarding-prototype-r2 (create from main).

Owner picks (binding): corners softer/pill-like; short text; calm mood; NO "Not sure yet" role card; NO PAGE SCROLL on any onboarding screen (must fit one page at 390x844, 360x640, 320x568, at 130% text and with the keyboard open); one question per screen; nationality and languages = search box plus about 6 popular chips with a picker sheet; field and big Continue button move up above the keyboard; dark mode true black; English only; photo required; go-live confetti + "You're live"; friendly dismissible grace banner; level picker big tap cards; medium animation.

Check with evidence (measured values; run what you can offline, e.g. a headless browser or node/jsdom; no network):
1. Each pick above: met / not met.
2. The measured screen-by-size table in the .md: re-measure at least the 8 tightest cells yourself (scrollHeight vs clientHeight of the screen container, with 130% text and the keyboard simulated). Report any that disagree with the worker's numbers.
3. Every screen reachable by tapping from the start; Back everywhere; no dead buttons; taps >= 44px; contrast >= 4.5 light and dark; reduced motion; focus visible; no horizontal scroll at 320.
4. Anything costly or impossible to build.
5. Copy: plain, playful, British English.

Output: `docs/review/onboarding-prototype-r2.md` on claude/review-onboarding-prototype-r2: verdict (PASS / PASS with should-fix / BLOCK), ordered material fixes (max 10) with where and how, and a short "what the owner should look at first". Push once. Context under 35%. Docs only. Final commit subject ends [worker-done <ticket>].
