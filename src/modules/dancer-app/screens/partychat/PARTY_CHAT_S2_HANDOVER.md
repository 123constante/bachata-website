# Party chat S2 handover

Nothing STOPPED: every checklist element was built.

## Done
- Route `/account/party-chat/:chatId` (AnimatedRoutes seam, lazy `PartyChatRoute`; path added to catchallClientPaths). Flag off = redirect to `/account`, zero RPC calls (tested). Signed out = AuthGuard redirect.
- `PartyChatScreen.tsx`: header (back, title, party date, three-dots with Leave / Report a message), admin notice, bubbles, day dividers, composer, errors, Show earlier messages, Leave sheet, Report sheet + toast. API calls live in the same file (file-count cap).
- 5 s poll while visible, merged by id; mark-read on open and on new messages while visible.
- Tests: `__tests__/partyChat.test.tsx` (12).

## Not verified
- No 390x844 browser walk, no real-data survey, no dark-mode look. Keyboard handling uses visualViewport via useKeyboardInset, untested on a device. Unit tests and full lint run in GitHub CI.

## Extras noticed, NOT built
- No unread indicator on the Nights card; no "chat closed" notice when the poll flips state mid-visit beyond the composer swap.
- 380-line cap forced API + screen into one file; split later.

## TAP TABLE
| button | destination | prototype/OLD |
|---|---|---|
| Back arrow | /app/nights | prototype |
| Three-dots: Leave chat | Leave sheet | prototype |
| Three-dots: Report a message | tap-a-message mode | prototype |
| Their message (report mode) | Report sheet | prototype |
| Leave / Stay | /app/nights / close sheet | prototype |
| Send report | toast, back to chat | prototype |
| Show earlier messages | loads older page in place | prototype |
| Back to Nights (not a member) | /app/nights | prototype |
