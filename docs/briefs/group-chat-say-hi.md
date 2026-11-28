# Brief: Group chat button: WhatsApp say-hi card (option J, Pro)
Brief-version: 2
Branch: claude/group-chat-say-hi
Lane: normal, Sonnet. Repo 123constante/bachata-website. One PR.
Size: 4 files, ~150 lines

## Goal
The event page's "Join the group chat" row looks plain. Behind a new flag (OFF), WhatsApp links render a small dark WhatsApp-chat card with a green "Say hi in the group" button. Owner-approved mockup: https://claude.ai/artifact/Ct5iq1NKenmzSuoagbv9vh (option J, with the Pro changes below).

## What main lacks
- VITE_ENABLE_GROUP_CHAT_CARD flag (featureFlags.groupChatCard) -- grep: VITE_ENABLE_GROUP_CHAT_CARD
- WhatsApp chat card with 'Say hi in the group' pill -- grep: Say hi in the group
- GroupChatBlock test file -- grep: GroupChatBlock.test

## Files
- src/modules/event-page/bento/blocks/GroupChatBlock.tsx
- src/modules/event-page/bento/BentoPage.tsx
- src/lib/featureFlags.ts
- src/modules/event-page/bento/blocks/__tests__/GroupChatBlock.test.tsx (new)

## What to build
0. Write INVENTORY.md first (scratch, not committed): every state of GroupChatBlock today (no url, each platform from src/lib/groupChat.ts, past/cancelled gate at BentoPage.tsx ~878, telemetry call) with file:line. Report the coverage count at the end.
1. featureFlags.ts: add `groupChatCard: import.meta.env.VITE_ENABLE_GROUP_CHAT_CARD === 'true'` with a comment in the same style as its neighbours ("OFF = every screen exactly as before").
2. Tests FIRST (GroupChatBlock.test.tsx, vitest + testing-library, mock the flag the way other bento block tests do): (a) url null renders nothing; (b) flag ON + WhatsApp url renders the card with "Who's coming on Friday?" and "Say hi in the group"; (c) flag ON + Telegram url renders today's row unchanged ("Join the group chat"); (d) clicking the card fires recordEventLinkClick with source 'bento_group_chat' (keep linkType exactly as today); (e) flag ON + weekday null renders "Who's coming?"; (f) flag OFF + WhatsApp renders today's row. Run them red against the unchanged component first.
3. BentoPage.tsx ~879: pass `weekday={formatWallClockLocalIntl(occurrence?.startsAt, { weekday: 'long' }) ?? null}` (formatter already imported and used at ~246). NEVER new Date().getDay(): startsAt is a London wall clock stamped +00. Keep the existing `!over && !occurrence?.isCancelled` gate and position.
4. GroupChatBlock.tsx: new optional prop `weekday?: string | null`. When `featureFlags.groupChatCard && meta.platform === 'whatsapp'`, render the card; otherwise the existing row, byte-for-byte unchanged. Card = one `<a>` (same href/target/rel/onClick/aria-label as today), mt-3, rounded-[18px], background #0b141a, p-3:
   - incoming bubble (left, bg #202c33, text #e9edef, 13px, rounded with small tail feel): `Who's coming on {weekday}?` or `Who's coming?` when weekday is null. NO sender label (do not write "Organisers").
   - outgoing bubble (right, bg #005c4b, text #e9edef, 13px): `Me! First time &#128075;` plus small blue ticks `&#10003;&#10003;` (#53bdeb, 11px).
   - full-width pill below, min-height 44px (explicit px, html font is ~13.5px on phones), bg #25D366, text #06281a, 15px extrabold, WhatsAppIcon 18px + "Say hi in the group".
   - bubbles are decoration: aria-hidden; aria-label stays the link's name.
   Use HTML entities in JSX, never raw emoji/Unicode punctuation (the apostrophe in "Who's" as &rsquo;).
5. Density: keep it compact (p-3, 13px text); this card is an owner-approved exception to design-density.md for colour only.

## Do NOT touch
EventCalendar.tsx, calendar/CalendarGrid.tsx, calendar/CalendarListView.tsx, calendar/DayDetailModal.tsx, calendar/calendarUtils.ts, useCalendarEvents.tsx (density-exempt calendar files), src/components/ui/dialog.tsx, supabase/**, migrations, workflows, scripts/**, .env*, any file not listed under Files. Do not change src/lib/groupChat.ts, FestivalDetail.tsx, share buttons, or the telemetry linkType.

## Done when
One push; PR body has "## Verified on real data" (- Shapes surveyed: / - Checks run: / - NOT verified:) and "## Phone QA" (- Sizes checked: / - Walked: / - Not verified:); tests green; every CI job step that applies has been run and the per-job table is in the PR body; last commit subject ends with the [worker-done ...] marker. Real-data note: 10 of 79 live series have group_chat_url, all WhatsApp. Wrong-day check: a Friday-night London event shows "Friday" with TZ=America/Los_Angeles (run that vitest case under that TZ too). Phone QA at 390x844 with the flag ON locally: card fits, RSVP below still reachable.
