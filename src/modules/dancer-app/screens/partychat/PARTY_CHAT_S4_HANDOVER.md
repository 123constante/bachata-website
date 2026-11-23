# Party chat S4 handover

Built (brief #1974): chat moved to `/app/party-chat/:chatId` inside the dancer shell (dancer background, shell chrome = `chat`: no site header, no tabs). `/account/party-chat/:chatId` redirects to it. Bell item and Nights card link to the new path. Catch-all path list updated. City list has Back (44px) and the empty line "No cities available right now.". The not-in-chat and error screens use the dancer theme (the Back to Nights contrast comes from the dancer violet with dark text).

Not verified: browser walk at 390x844, contrast measured in a real browser, unit suite and full lint (run in GitHub CI). `npm run typecheck` reports pre-existing errors elsewhere in the repo (none in touched files).

Extras noticed, not built: the old route component `PartyChatRoute` still wraps its own AuthGuard (now redundant inside /app).

TAP TABLE
| button | destination | prototype/OLD |
|---|---|---|
| Back (chat header arrow, "Back to Nights") | /app/nights | prototype |
| Back to Nights (not in chat / error) | /app/nights | prototype |
| Open chat (Nights card) | /app/party-chat/:chatId | prototype |
| Bell: Party chat is open | /app/party-chat/:chatId | prototype |
| Back (city list) | the two buttons, same card | prototype |
| Leave (after confirm) | /app/nights | prototype |
