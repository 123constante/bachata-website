# ER-C12 (website-screen): Home, desktop panes, retire the old flows

Branch `claude/er-c12-home` from `claude/er-wave1` (named in your prompt) once C8, C9 and C11 are on it. Rule 17; D1 (Home order, desktop two panes), rule 12, 16. Read ER-COMMON.

`home/**`, `jobs/**`, `flows/add/**`, `flows/change/**` (incl. `Time.tsx`), the take-off flow, `shell/OrganiserShell.tsx`: Home = "Needs you" first (draft / no way to pay / no coming dates), then Live, then Paused and ended, with the SAME readiness text as the event page (one shared mapping from `shared/eventRules.ts`); mount `InvitationsList` (C11) under "Invitations"; not-found states split (loading / archived / no access); desktop = two panes (events list left, chosen event right; New event steps left + live preview right); retire `flows/change/Time.tsx`, the Add-a-date and take-off flows once their replacements (C8, C9) are on the branch. Old screens are deleted only behind the switch rule 16: keep them reachable while the flag is off for anyone.

Tests: table of every Home shape (prod counts in ER-COMMON) x text; no copy points at a missing control; empty states say what the person can do. Touches as listed; no overlap with C8/C9/C11 files.
