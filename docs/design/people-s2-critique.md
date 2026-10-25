# People arc S2 -- the dancer world (#986): independent critique (Design Gate stage 5)

Brief: `briefs/PEOPLE-S2-critique-brief.md` on `brief/people-arc` (sha d1b2953a). Critic: a fresh worker, not the
builder. Judged on 2026-10-23 on a production build of the branch head before any change here (e749849) with
`VITE_ENABLE_PERSON_WORLDS=true` and the teacher flags, reading prod through the public anon key (read-only),
Chromium at 390x844, 360x800 and 430x932. Compared with the approved mock (`claude/people-arc-worlds`,
`docs/people-arc/worlds/shots/magda-dancer-390.png`, `papacito-dancer-390.png`) and with the DJ world (S3) in the
same build.

Visitor: a London dancer on a phone, opening a dancer's page from the people wall or a shared link, wanting to see
who they are and where they dance next.

## Ordered fix list

| # | Finding | Why it matters to the visitor | Severity | Verdict |
|---|---|---|---|---|
| 1 | **The page moves while it loads, much more than the DJ world.** Measured layout shift per page (sum, with sources): 0.088-0.289 on the 8 shapes walked at 390 (`leoncio` 0.127, `carol-y-raul` 0.284, `llf-malva` 0.289); the DJ world in the same build: 0.024-0.094. Three causes: (a) the "dancer read in flight" box was 117 px shorter than the page it turns into (`FOOTER 536 -> 653`); (b) the lower half waited as one 64 px box, then grew into a week of socials, pushing the invite and the footer down twice (`dancer-world-invite 642 -> 765`); (c) the role tabs row arrives with the roles read (`dancer-world 173 -> 231`, 0.051). | The visitor starts reading (or reaches for "Get your own card") and the page jumps under the thumb, more than once. | should | **(a), (b) fixed here** (no new read): the loading box is now the world's own boxes at their real sizes (bar, card, a week of socials, the invite's room when this visitor will get it); the undecided lower half and the socials-loading state both hold a heading, a full week (6 rows) and the button. After, 390: `leoncio` (dancer only, London: the common shape) **0.127 -> 0**, `chloe-poyiatz` 0.144 -> 0.052, `aurora` 0.234 -> 0.052, `carol-y-raul` 0.284 -> 0.144, `llf-malva` 0.289 -> 0.112, `elias` 0.244 -> 0.122, `aitor-angelica-tbf` 0.116 -> 0.093; one page got slightly worse, `alex-boneva` 0.088 -> 0.100 (a teacher preview: the waiting week is taller than the preview, see #7); same pattern at 360 and 430. **(c) owner call**, see below. |
| 2 | **The invite rule differs between the worlds.** The DJ world showed "Dance bachata too? Get your own card" to everyone, signed in or not; the dancer world hid it from signed-in visitors AND from everyone until auth answered (so a signed-out visitor saw it appear late, at the bottom). | A signed-in dancer is asked to sign up on DJ pages; a signed-out visitor sees the dancer page grow after it settles. | should | **fixed here** (owner D8''): one rule in `facts/` (`showsJoinInvite`), both worlds import it: hidden for a signed-in visitor, shown to every signed-out one (an anonymous guest session counts as signed out), from the first paint. |
| 3 | **The DJ preview on a dancer page had no DM Serif Display.** "Next gig Friday 6 November" fell back to Georgia (S2b "needs frame" item 2). | The DJ's world looks different inside a dancer page than on its own page. | should | **fixed here**: `DancerWorld` loads the font (the ref-counted `useDjPageFonts`) while a DJ preview is on screen; a teacher-only preview does not. Seen in `shots/dj-dated-390.png`. |
| 4 | **The "Find a party" wording was read out of the DJ world.** The dancer model called `djWorldView(...)` with an empty DJ to get the label (S2b "needs frame" item 1). | None today (same words); a later edit on one side would split them. | nice | **fixed here**: `facts.FIND_A_PARTY` (`{ label: 'Find a party', href: '/parties' }`), imported by both worlds; a source test forbids a second copy and the dancer model reaching into `dj/`. |
| 5 | The nationality flag sticker rode 7 px above the photo and touched the DANCER kicker (1 px overlap at 390). | Looks cramped and accidental on 19 of 171 dancers (those with a nationality). | nice | **fixed here**: the photo sits 14 px under the kicker (was 10): now 3 px clear at 360, 390 and 430. |
| 6 | **Multi-role pages: the tabs row arrives 1-3 s late** and pushes the whole world down 58 px (0.051-0.054). The DJ world holds the row while the roles read is out (`rolesPending`). | Same mis-tap risk as #1, on the pages that have tabs. | should | **owner call**: the DJ trade-off is reversed here. Prod (role tables, 2026-10-23, counts only): 159 of 189 dancers hold no other role, 30 do. Holding the row would make 159 pages close it (58 px up) to spare 30. Recommendation: put the role list (or just a "has other roles" flag) on the dancer read the page already makes (an RPC change in the admin repo), then hold the row only when it is known. |
| 7 | Pages whose lower half is a preview (30 multi-role dancers) or an empty city (Madrid) shrink once the roles answer: the waiting week of socials is taller than a preview card or an empty state (0.04-0.07). | The invite moves up once on those pages. | nice | **owner call**: the same missing fact as #6 (which lower half it will be). With it the placeholder could be the right one. |
| 8 | The lower-half heading is "Coming up"; the mock's is "<Name> also" ("Papacito also"). | "Coming up" says what the rows are; "Papacito also" says whose other world it is. Either reads fine. | nice | **owner call** (copy). Recommendation: keep "Coming up", it pairs with "Next class" / "Next gig". |
| 9 | The invite looks different on the two worlds: a panel with the question and a filled button (dancer), one outlined pill carrying both lines (DJ). | Same words, so it is recognisable; the shapes differ. | nice | **owner call** (the DJ form is S3's approved build; D8'' is about who sees it). |
| 10 | A contact row says WEBSITE over an Instagram address (`leoncio`). | Mildly confusing. | -- | **not a bug**: the dancer stored the Instagram link in the website field; the kicker names the field. |
| 11 | Socials times (19:00, 20:00 ...) differ from the mock's (20:00, 21:00 ...). | A wrong time sends people at the wrong hour. | -- | **not a bug**: each row's time equals the start on the event page it links to (Unidos Flow 19:00 = 7:00PM, Pura Wild Nights 20:00 = 8:00PM, Ronald & Alba 21:00 = 9:00PM, Daytime Bachata Social 14:30 = 2:30PM; `critique/times.mjs`). The mock used sample data. |
| 12 | Content starts 10 px lower on the dancer world than on the DJ world after a tab hop (card top 231 vs the DJ world's 221). | The tabs and Back do not move (163 / 113 on both); only the content under them. | -- | **not a bug**: the frame is identical; each world owns its content below the tabs. |

## Checks that passed (no change needed)

- Frame box, every shape and width: Back L10 T113 63x44, Share 70x44 (L310 at 390, L280 at 360, L350 at 430),
  tabs y 163 h 52, bar W 370 / 340 / 410: identical to `/djs/papacito`, `/djs/jeff`, `/djs/brito` in the same build.
  Tab hop DJ -> Dancer (papacito, jeff): tabs stay at y 163 through the hop. (The orchestrator's numbers -- 60x44,
  W 354 -- were measured on another box; the rule that matters, equal on every world, holds.)
- Back (D9): label "Back", `/dancers` fallback; the history rule is the frame's (`frameBack.test.tsx`, unchanged).
- Taps >= 44 px for every link and button in the world (rows 52, previews 64, buttons 44), all shapes, 360 and 390.
- Contrast: lowest 5.06 (muted copy on the card), every shape. No clipping, no sideways scroll at 360 / 390 / 430.
- Focus ring: 2 px solid #FBEBDD, offset 2, on the first link of the world (same as the DJ world).
- Seams: header (black) over the dancer ground with the site's gold rule: no step. The teal card and the section
  rows read as cards on the ground. Page -> footer: the same hard edge to the amber footer as the DJ world and
  the mock; content to footer 54 px everywhere (D13).
- Thin / one-item / empty pages: the empty state is a muted line then "Find a party" (D11/D12); the copy names a
  control that is on screen; full weekday names ("Friday 23 October"); no count anywhere below 2.
- Socials rows lead with the time; a 23:30 summer gig shows its own day (matrix rows, unchanged).
- Flag OFF: unchanged (matrix "flag OFF" rows; `DancerProfile`'s `useAuth()` line is main's again).

## Probes

`docs/people-arc/s2/critique/probe.mjs` (layout-shift entries with sources, frame boxes, flag vs kicker, invite,
focus ring, footer gap), `hop.mjs` (tabs through a DJ -> Dancer hop), `times.mjs` (socials time vs the event page).
Run against a served flag-ON build (`scripts/_serve-build.mjs --port 4173`; `NODE_USE_ENV_PROXY=1` in this sandbox).
