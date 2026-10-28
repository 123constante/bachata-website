# Brief: independent critique of the onboarding prototype (read-only review)

Review `docs/design/onboarding-prototype.html` and `.md` on branch claude/p3-onboarding-prototype (PR #1124) against the designer brief `briefs/p3-onboarding-prototype.md` (branch brief/p3-onboarding-prototype) and `docs/plans/onboarding-arc.md` Appendix A on main. You did not build it. Do NOT edit the prototype.

Check, with evidence (line numbers or measured values), and run what you can offline (node or a headless check; no network):
1. Every owner decision in the brief is honoured (list each: met / not met).
2. Every screen reachable by tapping from the start; Back works everywhere; no dead buttons.
3. Tap targets >= 44px, no horizontal scroll at 390 and 320, text at 130% scale, contrast >= 4.5 light and true-black dark, reduced-motion path, focus visible.
4. Colours/tokens match src/modules/organiser/p3/theme/p3.css and DESIGN.md (no colour seams).
5. Anything that would be impossible or costly to build (needs a DB value that does not exist, e.g. "Not sure yet"; extra bytes to the first load).
6. Copy: plain, playful, no jargon, British English, no raw Unicode punctuation traps for JSX (note only).

Output: write `docs/review/onboarding-prototype-r1.md` on branch claude/review-onboarding-prototype with: verdict (PASS / PASS with should-fix / BLOCK), an ordered list of material fixes (max 12) each with where and how to fix, and a short "what the owner should look at first" paragraph. Push once. Context under 35%. Docs only.
