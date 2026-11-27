# Party chat S2: chat screen (Website, web only)

Branch: claude/party-chat-s2
Size: 5 files, 380 lines
Flag: VITE_ENABLE_PARTY_CHAT (default OFF; flag off = route renders nothing new / redirects to /account, zero RPC calls)
Design registry rows: DANCER NIGHTS + PARTY CHAT + BELL (CHAT LOOK), FABLE REVIEW ANSWERS (owner clicks 2026-11-22/23). Owner scope click 2026-11-23: full party chat to preview.
Builds on S1 (merged): src/modules/dancer-app/screens/nights/partyChatApi.ts, partyChatFlag.ts, PartyChatCard.tsx ("Open chat" navigates to /account/party-chat/<chat_id>).
Place: new route `/account/party-chat/:chatId` inside the dancer area (find how /account/* dancer screens are routed and lazy-loaded; follow it). New folder src/modules/dancer-app/screens/partychat/.

## Backend (live on prod, do not touch supabase/)
All authenticated, return jsonb, never a count:
- `get_party_chat_v1(p_chat_id uuid, p_before timestamptz default null, p_limit int default 50)` -> `{ ok:true, chat:{id, city_id, city_name, party_date, closes_at, state:"open"|"closed"}, messages:[{id, profile_id, display_name, avatar_url, body, created_at, mine}] oldest first (newest LAST), has_more }` or `{ok:false,error:"not_member"}`. Older page: pass `p_before = messages[0].created_at`.
- `post_party_chat_message_v1(p_chat_id, p_body)` -> `{ok:true, message}` or `{ok:false,error:"not_member"|"closed"|"empty"|"too_long"|"slow_down"}` (body 1..500 trimmed; slow_down = 5 msgs / 10 s).
- `leave_party_chat_v1(p_chat_id)` -> `{ok:true, already}` or `not_member`. FINAL: no rejoin.
- `report_party_chat_message_v1(p_message_id, p_reason default null)` -> `{ok:true, already}` or `not_member|not_found|own_message`.
- `mark_party_chat_read_v1(p_chat_id)` -> `{ok:true}`; call on open and when new messages arrive while visible.
No realtime publication: POLL `get_party_chat_v1` every 5 s while the tab is visible (pause when document.hidden); merge by message id.

## Prototype checklist (CHAT LOOK, WhatsApp style)
- [ ] Header: back arrow (to Nights), title "Party chat · <city_name>", subline party date; header three-dots menu (owner row: Report and Leave both live there) with two items: "Leave chat" and "Report a message"; "Report a message" turns on a tap-a-message mode, tapping another person's message opens the report sheet.
- [ ] Notice line under header, always visible: "Admin can read this chat to keep it safe."
- [ ] Bubbles: mine = accent colour, right-aligned; others = left, name above the bubble, small avatar (initials fallback); 24h time (HH:mm, London) on each bubble; text only (no images, links not auto-previewed).
- [ ] Day dividers: "Today", "Yesterday", else "Mon 24 Nov" (London dates).
- [ ] Composer pinned at bottom (44px+ input and Send), disabled when chat state is "closed" (shows "This chat is closed" instead); Enter sends; 500 char limit with counter near the limit; keeps scroll at bottom when new message arrives only if user was at bottom.
- [ ] Errors inline, plain: empty (disable Send), too_long ("Keep it under 500 characters."), slow_down ("Slow down a little."), closed (switch to closed state), not_member (screen "You're not in this chat." with a Back to Nights button).
- [ ] Load older: "Show earlier messages" button at top when has_more.
- [ ] Leave: sheet "Leave this chat?" "You can't rejoin once you leave." buttons Leave (destructive) / Stay; on success go to Nights.
- [ ] Report sheet: reason chips (Spam, Rude or unsafe, Other) + Send report; success toast "Thanks, we'll look at it."; own messages not reportable.
- [ ] Flag off: route not reachable (redirect to /account), zero RPC calls. Signed out: normal auth redirect.
- [ ] Dark mode via existing tokens; 390x844 no horizontal scroll; every tap target >= 44px; keyboard does not cover composer.
- [ ] Tests: render per state (open/closed/not_member), send ok + each refusal, day dividers, polling merge without duplicates, leave and report flows, flag-off zero calls.

## Rules
- Any tap that leaves the prototype (old page) = not done. End the handover with TAP TABLE: button | destination | prototype/OLD. One OLD row = keep building.
- A prototype element you cannot build: STOP and put it at the top of the handover.
- Do not add anything not listed (no push, no unread badge, no block, no images, no member count). List extras you noticed in the handover, never build them.
- Handover file goes under src/modules/dancer-app/screens/partychat/ (isolation guard), not docs/.
- Opens one PR, never merges.
