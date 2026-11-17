# Review: organiser V1 shell PR #1731

Read-only review of PR 1731 (branch claude/organiser-v1-shell, head 49b4de5252fabfc53b34e8dfe6dbd2bcd61f2054) in 123constante/bachata-website.
Flag organiserShellV2 stays OFF at merge. Focus: (1) flag-OFF parity: P3Routes renders the same P3Shell and routes as main; (2) routing under flag ON (V2Home redirect, tabs, toHome back link, ?e= event choice and sessionStorage); (3) no change to any money/auth/RLS path; (4) bundle/flag-folding (flags read by name, never passed whole).
Already verified: 30 CI checks green, 390x844 light+dark walk 10/10 on the Dell, coral accent contrast test.
Out of scope: look and feel, copy, follow-ups listed in docs/handover/organiser-v1-shell.md.
Report PASS or findings with file:line and a concrete failing case.
