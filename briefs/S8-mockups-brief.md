# S8 mockups: "one page per person" vs "separate linked role pages" (prototype, NO PR)

Repo: Website. Your branch: `claude/s8-mockups`, created FROM `origin/claude/s7-mockups` (it already has the prototype route `/__mock/person/...` and `src/modules/person-page/mockups/`; read its `docs/handover/s7-mockups.md` first). Plain git only (never `gh api`). Commands without variables/loops/`$(...)` where a plain command works. PRODUCTION build (`VITE_MOCKS=true npm run build` + preview) for every screenshot. Push ONCE; final subject ends `[worker-done <ticket>]`; 30% context rule (`PARTIAL [worker-done <ticket>]` + handover). Never merge, approve or open a PR. Supabase READ-ONLY. Do not change any live page: prototype files only (`src/modules/person-page/mockups/`, the dev-only route, docs).

## Owner decisions (made, do not re-ask)
- Each role keeps its own look: dancer = the teal ID card (`PublicDancerPageV2`), DJ = near-black + gold vinyl (`DjTiles`, `djInkTheme`), teacher = its own look.
- Lead role = the role with something happening (DJ with upcoming gigs leads; else dancing).
- Roles are always public; every role is shown.
- NAME RULE: the stage (DJ) name leads on DJ things (DJ section/page, lineups, DJ search label); the real name everywhere else (person card, dancer, teacher).
- SEARCH: one row per person with small role labels (DJ / Dancer / Teacher), not one row per role.
- THIN PAGES: hide empty parts. No "coming soon" cards (DJ guestbook), no empty FAQ card, no default shown as a fact ("Dancing 0 years / Newcomer" when never answered), no "DANCER" label on someone who does not dance, no empty Connect card.
- Organiser: one line "Leads: <organiser>" (fixture is fine; label it sample).

## Build TWO options, same real people, side by side
- **Option 1 - One page per person.** One shareable page: person card (real name, photo, flag, city, languages, Share once), then each role as a "room" in its own look, lead role first (reuse the S7 "stacked" or "stamps" arrangement, whichever reads cleaner; say which and why).
- **Option 2 - Separate linked role pages.** Today's dancer / DJ / teacher pages, each cleaned by the thin-page rules above, plus a small "Also: DJ as Oreo Sensual / Teaches" link bar at the top of each page that links to the person's other role pages (the Share button shares the page you are on).
Also mock, for both options: (a) ONE search result row for the three-role person with role labels and the right name per the name rule; (b) one event-lineup entry for a DJ showing the stage name.

## People (real prod rows, read-only; same ids as S7 where possible)
Three-role person whose names differ (S7 `threerole` = Bisket / Oreo Sensual); Roger (DJ with upcoming gigs + dancer); a teacher-only thin person (no photo); a dancer-only thin person. Say how you picked each.

## Output
- 390x844 full-page screenshots: `docs/mockups/s8/opt1-<person>.png`, `docs/mockups/s8/opt2-<person>-<role>.png`, `docs/mockups/s8/search-row.png`, `docs/mockups/s8/lineup-entry.png`.
- PHOTOS: the image host (r2.dev) was unreachable from the last sandbox. Try it first; if it is blocked, say so in the handover and keep the fallbacks (do not invent photos).
- `docs/handover/s8-mockups.md`: reused vs new, fixture vs real per line, every place the thin-page rules hid something, what is NOT verified. Stop after the push.
