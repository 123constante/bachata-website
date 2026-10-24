# People arc S5 -- design record (wording and sr-only only)

No layout, colour, size or spacing change. Visible pixels on the wall and the frame are identical.

| Surface | Before | After | Why |
|---|---|---|---|
| Wall tile date line (sr-only prefix) | `Next gig ` | `, next gig ` | S0 critique F2: a screen reader read "Mr M Next gig Saturday 24 October, Teacher" with no pause after the name. Now "Mr M, next gig Saturday 24 October, DJ", the same `", "` pause the role chips already use (`RoleChip.tsx`). The visible line still reads only the date. |
| Frame Share button | shared `window.location.href` | shares `https://www.bachatacalendar.co.uk/<role page>/<slug>` of the world on screen | A pasted link previews the role the visitor was looking at, with no `?fbclid` / `#tab` / preview host. Label, icon and toast are unchanged. Flag OFF pages keep their own share code (untouched). |
| Wall tile link (flags.personWorlds ON) | always the list's own page (`/dancers/<id>` on /dancers) | the strongest open world (Teacher > DJ > Dancer), same rule as the `/people/:id` canonical | A DJ who also dances lands in the DJ world from /dancers. Flag OFF: unchanged. |
| Link-preview card text (all three role pages, middleware /teachers) | city always "London"; middleware title the bare name | the person's own city or none; middleware title = SSR title; dancer line keeps its wording, "`<Name>` - profile on Bachata Calendar `<City>`.", city real or omitted | One per-role rule (`src/lib/seo/personCard.ts`) for SSR and middleware. |

Not a visual change, so no comp; walked at 390x844 (see HANDOVER.md, Phone QA).
