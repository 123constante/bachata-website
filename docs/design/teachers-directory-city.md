# Design record: multi-city teachers directory (claude/teachers-directory-city)

Flag: `flags.teachersDirectory` (`VITE_ENABLE_TEACHERS_DIRECTORY`), still OFF in prod; this PR flips nothing.
Flag OFF: `/teachers` and `/city/:slug/teachers` both show the existing ComingSoonGate placeholder (noindex),
and the sitemap lists no teachers directory URL.

## Brief
- **Who:** a dancer on a phone (390x844) looking for a bachata teacher in their own city.
- **One job:** see the teachers in this city, or move to another city that has a directory.
- **Feel:** the existing directory, unchanged in style; one heading that names the city and one control to change it.

## Option chosen (owner)
"Per-city pages + switcher", from https://claude.ai/artifact/Av322D7J3JMxN1d5cXuafC.
- URL: `/city/<slug>/teachers` (the repo convention, as `/city/<slug>/classes`). Not `/<slug>/teachers`:
  vercel.json already 308s that bare form, and now points it here.
- Bare `/teachers` redirects to the visitor's city (`useCity()`), else `london-gb`.
- Only ACTIVE cities (`cities.is_active`) have a page. An inactive (e.g. Madrid) or unknown slug shows London's
  list with a note naming what was asked for -- never a blank page.
- Switcher: a bottom sheet listing active cities by name. No teacher count: it is not in the same query
  (one RPC call per city would be needed), and the brief says name only in that case.

## The one mapping
`src/modules/teachers-directory/teachersCity.ts`: `resolveTeachersCity` (which list, which name, canonical) and
`teachersCityCopy` (heading, subtitle, empty note, fallback line, SEO context). The page, the sitemap
(`teachersSitemapPaths`) and the tests all read it. The redirect target lives in `teachersRedirect.ts` (tiny, so
the app shell's first-load graph does not carry the rest).

## States (every one says what the person can do)
| State | Heading | Note | Action |
|---|---|---|---|
| Active city with teachers (London 46, a 5-teacher city) | Bachata Teachers in <city> | none | cards; Change city |
| Active city with 0 | Bachata Teachers in <city> | No teachers listed in <city> yet. Know one? | **Tell us** (ListingRequestForm, section `teachers_directory`); See another city |
| Inactive slug | Bachata Teachers in London | No teachers listed in Madrid yet. Know one? Showing teachers in London instead. | Tell us; London's cards |
| Unknown slug | Bachata Teachers in London | No teachers listed in that city yet. Know one? Showing ... London instead. | Tell us; London's cards |
| Loading | Bachata Teachers | -- | skeleton cards; switcher disabled ("Loading cities"); canonical London |
| Read error (cities or teachers) | -- | We couldn't load the teachers. Check your connection and try again. | **Try again** |
| Filters match nothing | -- | No teachers match your filters. | Clear filters |

The client-side City filter tab is gone (the list is narrowed on the server by `p_city_slug`); filter tabs are now
All / Name / Style in a 3-column row.

## Tokens
No new tokens or colours. Reuses the page's existing shadcn tokens: `Button` outline (switcher, Try again, See another
city), `border-primary/30 bg-surface/60` (the note card, same family as the hero widget cards), `text-primary`
(Tell us), `bg-primary/15` (current city row in the sheet), `text-muted-foreground` (secondary copy).
Tap height `min-h-[44px]` in px (the phone html font-size is ~13.5px, so rem would render small).

Density note: the teacher card grid itself is unchanged (1 column on phones, as before this PR). Compacting it to the
3-column rule is a separate visual change, not in this brief.

## Self-running checks
`tests/e2e-phone/teachers-city.phone.spec.ts`, both phone projects (390x844 and 360x640), against the fake's prod
shapes (London 46 / Manchester 5 / Leeds 0 / Madrid inactive / unknown slug):
- colour contrast >= 4.5:1 (axe `color-contrast`, scoped to the new elements and the sheet), measured after animations;
- every new control >= 44 px tall (switcher, Tell us, See another city, each sheet row);
- no sideways scroll (`checkOverflow`, against the device width), sheet inside the viewport (no clipping);
- every state above except loading/error, which `teachersCity.matrix.test.tsx` covers (error + retry, cities error).

Result on this head: 14/14 passed.

## Stages left to the orchestrator
The independent critique (stage 5) and the 390x844 walk on a preview (stage 6) are done by the orchestrator after
this worker.
