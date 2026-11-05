# join-gaps-2 walk, 390x844, mocked at the network boundary (tests/e2e/walk-join-gaps-2.spec.ts)
Every picture opened by eye; none is an error card or blank.
- A1-about-invite-no-banner: About step on /invite, no "Finish your profile" banner, one Continue. PASS
- A2-parties-banner-unchanged: /parties, same incomplete profile, banner still shown. PASS
- B1-request-before: expired link, button "Ask the team for a new one". PASS
- B2-request-sent: "Request sent to the Bachata Calendar team. We cannot say when a new link will arrive...", WhatsApp button. PASS
- C-done-0-left: "Everything on its page is yours to use". PASS
- C-done-3-left: details first + "It takes a minute or two." PASS
- C-done-10-left: details first + "It takes about five minutes. You can stop and come back." PASS
- D1-revoked-join-page: "This link was withdrawn", ask-the-team + WhatsApp buttons. PASS
- D2-revoked-legacy: same render (the legacy route renders JoinPage). PASS, but the `?legacy=1` query is not a real flag switch; the legacy page is the same component, proven by code (InviteRedeemPage renders JoinPage), not by a separate flag-OFF walk.
Not walked: flag-OFF Done page (covered by unit tests only), real devices.
