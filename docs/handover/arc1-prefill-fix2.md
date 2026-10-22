# Arc 1 prefill, fix pass 2 (A, B, C): handover

Done: A (bound-link signed-in card, `hintMatchesEmail`), B (already-on-the-team card via the person's own organiser list, `ownPageForName`), C (Dancer4Flow `networkMode: 'always'` + 3 s latched fallback), dead `parseDancerPrefill` removed. Tests added red-first in inviteModel / inviteReasons / Dancer4Flow suites. PR body text: `arc1-prefill-pr-body.md` (orchestrator patches the PR).

Left: phone walk at 390x844; CI jobs not run in the sandbox (see the PR body). "Go to {name}" goes to Organiser Home (no per-page URL exists for a member who is not switching).
Note: the brief lives in the admin repo; it was read through the GitHub tool (added `bachata-admin` to session scope, nothing written there).
