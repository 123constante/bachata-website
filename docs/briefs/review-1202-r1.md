# Brief: independent review r1 of Website PR #1202 (P3 shell exits), read-only

Branch: `claude/review-1202-r1`. Reviewer model differs from the builder (Opus built it). Output: ONE file `docs/review/pr-1202-r1.md`, then push with marker `[worker-done <ticket>]`. Change NO source.

Review branch `claude/p3-shell-exits` (PR #1202) against its brief `brief/p3-shell-exits:docs/briefs/p3-shell-exits.md` and its handover `docs/handover/p3-shell-exits.md`. Use `git diff origin/main...origin/claude/p3-shell-exits`.

Check, with file:line evidence: (1) every new /account/p3 URL keeps Back inside P3 and nothing under `p3/**` links to /account/o except the listed intentional exceptions; (2) the R1 flows (`flows/new`, More, Help, SeriesOrganisers) behave IDENTICALLY with P3 off (the surface defaults) -- the highest risk, since R1 is live for everyone; (3) permission shapes: manager vs owner vs contributor on New event / Organisers / Account; (4) the three judgement calls in the handover (Cover Go live to P3 event page, Help rows to P3 Events, Done back = new event); (5) bundle: zero bytes to /app first load, P3 chunk; (6) tests assert behaviour, not copies of the implementation (mutate one routing line mentally: does a test go red?).

Findings ranked BLOCK / SHOULD-FIX / NIT, each with file:line and a failure scenario. End with a verdict line: PASS, PASS WITH NITS, or BLOCK.
