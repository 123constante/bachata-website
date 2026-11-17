# Brief: organiser area V1 shell (v2 look), behind a new flag

Lane: normal. Repo: Website. Branch: claude/organiser-v1-shell (off origin/main). One PR, bot-authored.
Plan: slice V1 of the organiser arc (owner clicks 2026-11-14). Prototype brief with every owner decision: docs/design or the arc's organiser-prototype-brief.md (copied below in short).

## Goal
A new organiser shell, behind NEW flag organiserShellV2 (VITE_ENABLE_ORGANISER_SHELL_V2, default off, added to src/lib/featureFlags.ts). Flag OFF = today's P3 shell exactly as is (src/modules/organiser/p3/shell/P3Shell.tsx unchanged in behaviour). Needs organiserP3 + organiserDash on.

## Build (flag ON only)
1. Slim top bar on every organiser screen: labelled 44px "Back to Bachata Calendar" link to the public landing page, with the event switcher beside it. Switcher: pick the event once, tabs act on it; default = the organiser's next event. Held in one context + URL-safe so a refresh keeps it.
2. Bottom tabs: Events + Team, Tickets, Guest list, Raffle. Reuse existing screens under the new tabs (p3/events, p3/tickets via TicketsEntry, guest list and raffle sheets from #1624/#1623). Do NOT edit anything under p3/tickets/* or p3/door/* (reserved for the ticketing session): link to them only.
3. Organiser-area-only look tokens: white background, ONE accent passing 4.5:1 on white (name it in the PR), soft grey cards and dividers; matching dark version when the phone is dark; no toggle. Scope tokens to the organiser area only. Public site colours untouched. Use explicit px sizes (13.5px html trap).
4. Shared helpers: bottom confirm sheet for risky actions (one plain sentence, one action, Cancel), toast with NO Undo, vibrate() helper behind a navigator.vibrate feature check (nothing may depend on it; 10ms tick on normal taps; double buzz on errors). No alert/confirm.
5. Every empty, loading and error state in the new shell: one sentence plus a next-step button. Tap targets 44px min.

## Rules
- Owner role rules: contributor sees only what slice 3 already allows; money owner only; raffle open/close stays an owner-only confirm sheet and a hard stop. No agent or test may call organiser_raffle_night_set_v1 on prod.
- No DB change, no new RPC. No new product decisions: if unsure, pick the plain default and list it in the PR.
- Do not touch density-excluded calendar files.

## Done
npm run pre-ship green; unit tests for the switcher default/persist and flag-off parity; 390x844 screenshots (light + dark) of each tab with the flag on, in the PR; PR body: what it does, checks, Not verified.
