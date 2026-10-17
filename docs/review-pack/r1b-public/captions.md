# r1b public page v2: 390x844 screenshots (production build, invented prod-shaped rows)

Server: `npm run build` + `scripts/_serve-build.mjs` with a scratch preload that answers the
dancer reads / names RPC / gate / extras with invented rows in the shapes the 2026-10-17 prod
survey found. Every page below: no horizontal scroll, 0 page errors, Share button 44px tall.

- `01-open-complete-signed-out.png` - flag open, signed-out visitor: portrait first, name + city/nationality + role/years on the photo, Share, WhatsApp (RPC returned a number), Join card, About.
- `01b-open-complete-sections.png` - same page scrolled: Speaks, Experience (years + level), Practice buddy (all four facts), Styles, My sound, Highlights, Connect.
- `01c-open-complete-more.png` - same page, bottom: Event appearances list (kept), Gallery (kept), then the site footer.
- `02-open-photoless.png` - photoless profile: the initial on the dancer gradient; no WhatsApp button; Connect empty state says what to do ("Use Share ...").
- `03-open-long-name-many-languages.png` - 38-character name wraps on two lines; six languages.
- `04-open-nameless.png` - nameless profile: heading "Dancer" (head is noindex, unchanged).
- `05-open-surname-hidden.png` - hidden surname: only the masked first name shows.
- `06-open-share-copied.png` - no share sheet on the device: tapping Share copies the link and says "Link copied ..." under the button.
- `07-open-200pct-long-name.png` - 200% zoom: the long name grows the photo header instead of being cut off (bug found on this walk and fixed).
- `08-paused-not-found.png` - paused / hidden profile: the same not-found page as today.
- `09-closed-today-page.png` - flag closed: today's page, unchanged.
