# Design record: Share this event (p3-share-event-link)

**Chosen look.** One `p3-row` directly under "See it as dancers see it", same 44px row: title "Share this event", subline "Send dancers the link". Tap opens the share sheet, else copies the link and says "Link copied." under the row. Off states (draft, archived, no slug) are a disabled row with the `publicPageOf` reason, never hidden.

**Rejected: a button in the page head.** The head is identity only; a button there adds a second control style next to the status rows.
**Rejected: share inside the dancer-view link.** One row, two actions: the tap target would be ambiguous and the link would lose its plain "open" meaning.

**Rules.** Address = origin + `publicPageOf(ws).href` (eventHref, slug only, no tracking params). A closed share sheet (AbortError) says nothing. Clipboard failure says "Couldn't copy. Tap and hold the link below to copy it." and shows the url as selectable text. No analytics, QR or WhatsApp button.
