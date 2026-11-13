# Website PR #1624 rebase (guest list inside each night)

Repo 123constante/Website, branch claude/profile-dash-organiser-guest-list-build (PR #1624, head fa2a1213).
Conflicts with main after T3 #1625 merged (f6bd1dbc) in `src/lib/featureFlags.ts` and `scripts/onboarding-write-doors.json`.

Task: merge origin/main into the branch. Keep BOTH sides in each conflict: main's new flag(s) / door entries from #1625 AND
this PR's guest-list flag / door entries. Door JSON must stay valid, sorted as main sorts it, no duplicate keys.
Do not change anything else. Run the unit gate and tsc (0 errors in touched files), push ONCE, handover in docs/handover/website-1624-rebase.md
(head sha, which entries were kept). Do NOT merge or approve.
