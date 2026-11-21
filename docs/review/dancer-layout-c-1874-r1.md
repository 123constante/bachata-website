# Review r1 (PR #1874, head 57ebb90f39389f9476f6afe58c04f3f63c34e260): layout C S2 shell and Me Settings

Reviewer: Sonnet (independent of the Opus builder). One round, risky class: screens with saves and routing.
Merge dark: every change is behind VITE_ENABLE_DANCER_LAYOUT_C, default off. Findings below are follow-ups
to close BEFORE the flag is turned on in production. None blocks a flag-off merge.

## Verdict: PASS WITH NITS

## Findings
- med: MeScreen.tsx ~35, meSettingsRows uses opts.find(...)! and throws if an options id is missing. Fall back to null and filter, add an id-coverage test.
- low: MeScreen.tsx ~34, use APP_ACCOUNT_SETTINGS_PATH and assert the exact value.
- med: no Sign out in Me until S3 (#1877) lands. S3 is a hard prerequisite before the flag is enabled.
- med: DancerAppRoutes.tsx ~76, Tickets redirect must wait for useViewOnly to settle (return null while pending); add a slow-gate test.
