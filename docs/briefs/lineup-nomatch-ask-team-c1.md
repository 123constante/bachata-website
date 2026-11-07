# lineup-nomatch-ask-team continuation 1 (fix review findings)

Branch `claude/lineup-nomatch-ask-team` (PR #1464, head df39fecd). Lane normal, Sonnet. Start by merging `origin/main` into the branch, keep both sides. Original brief: `brief/lineup-nomatch-ask-team:docs/briefs/lineup-nomatch-ask-team.md`. Do ONLY what is left.

## What is left (review findings)
1. The searched text goes into the WhatsApp message untrimmed and unbounded. Trim it, collapse inner whitespace, and cap it at 60 characters (add "..." as `&hellip;`-safe ASCII "..." is NOT allowed; just cut) before `dancerMessageUsUrl`. Table rows: padded text, 200-character text, text with emoji, text with `&` and `#` (must be encoded in the href).
2. The tap-size test is missing: assert the `p3-lineup-ask-team` anchor is at least 44px high by an explicit px class (the public site root font is about 13.5px on phones, so rem sizes render small).
3. Gates: `npm run lint`, p3 unit tests, `check:bundle-budget` (0 bytes to /app first load), `check:integrity`; update PR body Checks run line; 390x844 screenshot of the no-match shape attached to the PR.
Push once; never add run-ci. Last commit ends `[worker-done <ticket>]`. Stop at 50% context with a handover.
