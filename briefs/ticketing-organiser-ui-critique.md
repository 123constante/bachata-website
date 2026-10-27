# Brief: independent design critique of the S3 redesign (Design Gate stage 5)

You are a reviewer, not the builder. Never edit claude/ticketing-organiser-ui. Push ONLY your own branch with one file `docs/review/ticketing-organiser-ui-1060.md`; end the commit subject with your done marker.

Target: Website PR #1060, branch `claude/ticketing-organiser-ui`, which the owner redesigned to "Option B: Compact". Spec: `git fetch origin brief/ticketing-organiser-ui` then `git show FETCH_HEAD:briefs/ticketing-organiser-redesign.md`. Owner's bar: "as intuitive as possible and ui and ux at a high standard". Rules: `.claude/rules/design-density.md`; the public site sets `html` font-size to ~13.5px on phones so rem sizes render ~16% small (taps need explicit px). Read `docs/design/1060.md`, `docs/handover/ticketing-organiser-ui.md`, `src/modules/organiser/tickets/**` and their tests on the branch.

If you can run the app (npm ci, vite dev with VITE_ENABLE_ORGANISER_TICKETING=true, faked ticket data) and screenshot at 390x844 (Playwright in YOUR sandbox only), do it and look at every screen; if not, judge from code and say so.

Check each of the six screens (Home first open; Home payments connected; Add-a-ticket steps 1, 2, 3 with live "Buyer pays"; One event with Selling switch and buyer names; Refund sheet) against the spec: one next step on first open; Back keeps entered values; sticky action bar clears the safe area; taps >= 44px; contrast >= 4.5; no sideways scroll (long names, big numbers, long event titles); every empty/loading/error state offers an action; copy exactly as briefed (refund wording, 50p fee, free ticket = no fee); contributor is read-only; disabled controls say why; returnFocusRef on every SheetView; full month and weekday names (no "Fri", "Nov"); no Unicode punctuation in source (HTML entities only). Say what the tests do NOT cover.

Output (under 700 words): ordered MATERIAL fixes only, each with file:line, what differs from the spec/mockup, and the concrete fix; mark blocking vs should-fix. Say plainly if the build matches.
