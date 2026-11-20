# Dancer layout C, slice S2: three tabs, Me gets Settings, redirects, preview twins
Repo: 123constante/bachata-website. Branch: claude/dancer-layout-c-s2. Lane: normal. Model: opus.
Size: 5 files, 380 lines
Brief-version: 2
Design: DESIGN-REGISTRY row "Dancer dashboard" (layout C picked 2026-11-20). Prototype: https://claude.ai/artifact/HdwfoouZXEQvXM8LaXDyVF (option C, Me + Options phones). Spec: docs/briefs/dancer-layout-c-spec.md.
Flag: `DANCER_LAYOUT_C_ENABLED` from src/modules/dancer-app/screens/home/layoutCFlag.ts (slice S1 creates it; if S1 has not landed, create the identical file yourself and say so). Flag OFF = shell, routes, Me, Options exactly as today.
Rules: HTML entities in JSX, explicit px tap targets, 390x844.

## Files
- src/modules/dancer-app/shell/routes.ts
- src/modules/dancer-app/shell/DancerAppShell.tsx
- src/modules/dancer-app/shell/DancerAppRoutes.tsx
- src/modules/dancer-app/screens/me/MeScreen.tsx
- src/modules/dancer-app/screens/teaser/TeaserScreens.tsx

## What changes (flag ON)
Tabs: Home, Nights, Me only. No Options tab, no Tickets tab (the ticket card lives on Home, slice S1). `/app/options` redirects to `/app/me`; `/app/tickets` redirects to `/app/home` (keep both route ids so old links and the catch-all path list still work; routes stay in `catchallClientPaths.ts`). Locked tabs (view-only / no_profile) keep the "What are you?" sheet.
Me, top to bottom: paused card; profile card (avatar, name, "Role · City", Profile strength %, next-step CTA); AccountLinkPanel (flagged, unchanged); rows "Edit my profile", "See my public page" (disabled if hidden, as today); NO "My page" row (moved to Home "Be found"); head "Settings" with rows in this order: Account settings (-> /account), Your areas (-> /account/areas), organiser row (-> /account/o: "I run events" | "Run events? Become an organiser" + beta sublabel, same logic), Send feedback (FeedbackSheet), Help and message us (WhatsApp link), Add to my phone's home screen (install sheet, exact copy), Terms, Privacy policy (TWO rows, owner click); then the card "Back to the Bachata Calendar website" (-> /). NO Sign out here (it lives in Account settings, slice S3). Reuse optionsModel rows, FeedbackSheet, install Sheet, SITE_HOME_PATH from screens/options (import, do not copy). Share my page row is NOT on Me (it is on Home).
Preview twins (TICKET_TEASER on): read-only Home/Nights/Me, same locked ghost rows and the "Finish your profile to use this" sheet. Map: Home ghosts = Share my page, Preview my page, Plans, Nights attended; Me ghosts = Edit my profile, See my public page; Me Settings section is live (not locked) EXCEPT Send feedback and Add to my phone's home screen stay locked ghosts as in today's teaser Options; Nights unchanged (Rate this night ghost). Owner decision: preview Me ends with a quiet "Sign out" text row (the teaser's existing sign-out control) at the very bottom, below "Back to website". Teaser Options screen is not reachable with C on.
no_profile Me/Options: NoProfileWayOut keeps Account settings, Sign out, organiser area (unchanged, it is the stuck-user way out).

## Prototype checklist
- [ ] bottom tabs exactly: Home, Nights, Me
- [ ] Options tab gone; /app/options -> Me; /app/tickets -> Home
- [ ] Me: profile card + "Add your photo" style CTA
- [ ] Me: "Edit my profile", "See my public page"
- [ ] Me: head "Settings"
- [ ] Settings rows in order: Account settings, Your areas, Run events? Become an organiser, Send feedback, Help and message us, Add to my phone's home screen, Terms, Privacy policy
- [ ] Me: "Back to website" card stays
- [ ] no Sign out on Me (non-preview users)
- [ ] Options tab-removed note exists only in the prototype; nothing to build
- [ ] preview twins mapped as above, with quiet Sign out at the bottom of preview Me

## Done when
Tests: shell tabs table (flag on/off x publicTicketing x teaser x view-only), redirects, Me row order, teaser Me mapping incl. Sign out row; existing b1bAppScreens/journey*/teaser tests green with flag off. Each new test red on old source. Do not touch Home (S1), AccountSettings (S3), Nights. LIST extras in the handover, never change them.

## TAP TABLE (mandatory in handover)
End the handover with a TAP TABLE: button | destination | prototype/OLD, covering every tab, every Me row, every preview ghost, the redirects. Any tap that leaves the prototype (old page, today's screen) = not done; one OLD row = keep building. A prototype element you cannot build: STOP, write it at the TOP of the handover. Checkpoint PR at 60% of your limit.

## Inventory first
INVENTORY.md for this slice = docs/briefs/dancer-layout-c-spec.md (live inventory of every row, tap and flag, already written). Before building, tick each Prototype checklist line against it; end the handover with a coverage count: "coverage N of N checklist lines built".

## What main lacks
- extends: three-tab shell, Me Settings section, /app/options and /app/tickets redirects behind the layout C flag -- src/modules/dancer-app/shell/routes.ts
- no Settings section on Me today -- grep: head "Settings"
