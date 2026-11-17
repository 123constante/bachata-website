# Review PR #1748 (organiser slice 1: V2 shell nav + technical fixes)

Review `feat/organiser-slice1-nav` at head 3f315ff81 against main. Files: src/modules/organiser/p3/** (V2Shell, V2Tabs, paths, P3Routes, P3Shell, OnboardingFlow, returnTo, GetPaid, v2.css) and two tests. Flags organiserShellV2 + organiserP3 + organiserDash are off on live.

Check: route/back-nav correctness (pushed screens hide bottom tabs, Switcher keeps name+status, returnTo cannot open-redirect), undated-draft copy "Add a date to this event to use Guest list." with Add or edit a night button, flag-off behaviour unchanged, no secrets, HTML entities in JSX (no raw Unicode punctuation), tests meaningful.

Write the review doc docs/review/review-1748.md on your branch with a `## Verdict` and `## Hard-tier: PASS` (or BLOCK) section naming PR #1748 and head 3f315ff81. One round only; list blockers vs nits.
