# Going P2 &mdash; Website: design record (Design Gate stages 3&ndash;4)

Branch `claude/going-p2-website`. Screenshots of every state: [`docs/handover/going-p2/INDEX.md`](../handover/going-p2/INDEX.md).

## Brief, in short

One "I&rsquo;m going" button per **night** (occurrence), never per series, and no "Interested".
Visitors see the **count and the people** going to that night: first name always, the photo only
when the dancer switched "Show my photo when I&rsquo;m going" on (OFF by default), a link to the
dancer&rsquo;s page only when their page is public. Only **finished** profiles may say going; the
screen names what is missing and links to the Finish screen. Un-going is always allowed. The
public dancer page shows "Going next" (up to 3 nights). Everything stays behind the going switch
(`src/lib/goingCheckin.ts`), which is OFF on production.

Real shapes (P0 survey, `docs/going/shape-survey.md` on `claude/going-p0-design`): every upcoming
night has 0 going, and 4 in 5 profiles are unfinished (usually no dance role). So "No one going
yet / Be the first" and "Add your dance role" are the two states people will see most.

## Chosen option: A &mdash; the "Who&rsquo;s going" tile

`git show origin/claude/going-p0-design:docs/design/going/option-a.html` (PR #970). A tile on the
event page bento: title strip, the night line ("Saturday 24 Oct &middot; 9 PM"), the count, up to 8
people (32px face + first name, 52px cell), "+N more", and the one 48px button with its line under
it. The festival hub card carries the same block on the hub&rsquo;s own tokens. Option A was the
P0 suggested pick (smallest build, calmest look, ticket button stays in the sticky bar).

### Obsolete states in mockup A, redrawn

Mockup A was drawn under the old privacy rule (switch OFF = "counted but face hidden"). The owner
decision now is: going is always NAMED; the switch controls the photo only. Redrawn as:

| Mockup A (obsolete) | Built (P2) | Screenshot |
|---|---|---|
| "face hidden" dot | First name + **initials circle** (no photo) | `event-tile--going-3-mixed-people.png` (Ben) |
| "N not shown" | Gone: everyone is listed by first name; only `+N more` (= going_count &minus; people shown) | `event-tile--going-12-plus-more.png` |
| "Me: opted out but going" | Gone: the viewer going is "You&rsquo;re going &middot; Undo"; switch OFF just means no photo | `event-tile--viewer-going.png` |
| Hidden public page | First name, **no link** (`dancer_profile_id` null) | `event-tile--going-3-mixed-people.png` (Cleo) |
| Organiser "hidden" count | Out of scope (P3) | &mdash; |
| Ended / cancelled "link to the next night" | Not built in P2: the button is disabled and its reason shows under it | `event-tile--night-ended.png`, `--night-cancelled.png` |

## Tokens used, per surface (no new colours)

There is no `DESIGN.md` in this repo; the token file is `src/index.css` (plus each surface&rsquo;s
existing local palette, named below). Every going colour is one the surface already had.

| Surface | Tokens |
|---|---|
| Event page tile (`RsvpBlock`, `RsvpBlockPlaceholder`; `BENTO_GOING_THEME` in `src/modules/going/goingTheme.ts`) | `--bento-surface` (page), `--bento-surface-raised` (tile body, ghost button), `--bento-hairline` (border), `--bento-accent` (title strip, pressed border/fill at 0.6 / 0.16), `--bento-fg` (count, names, links), `--bento-fg-muted` (night line, messages, disabled label: the contrast floor, 4.96:1). CTA = the event page&rsquo;s own gold from `EventStickyActionBar.tsx` (`#FFD64B`&rarr;`#FFB200`, text `#3A2603`), so no seam between tile and bento. |
| Festival hub card (`FestivalHubGoing.tsx`, `HUB_GOING_THEME`) | `--foreground`, `--muted-foreground`, `--card`, `--border`, `--primary` / `--primary-foreground` (CTA), `--primary` at 0.12 / 0.6 (pressed), `--muted` (ghost, faces). The hub renders on the **default dark** `:root` tokens (`--primary: 39 100% 50%`, black text), not the light `.auth-bright` set (`28 100% 56%` + white) that was flagged as a risk: measured CTA "I&rsquo;m going" passes (see Stage 4). |
| Calendar list count (`CalendarListView.tsx`, count chip only) | The file&rsquo;s own constants: `INK` (`#3a2418`, text) on `rgba(58,36,24,0.10)` over `CARD_BG`. Changed from the old hard-coded `#6b4c2a` (4.32:1, fails) to `INK` (8.8:1). |
| Public dancer page "Going next" (`PublicDancerPageV2.tsx`) | The page&rsquo;s `TEAL` palette: `TEAL.card`, `TEAL.border`, `TEAL.text`, `TEAL.amber` (night line), `TEAL.accent` ("See all N"). |
| Dancer app Home / Nights / Me | Dancer theme `src/modules/dancer-app/theme/dancer-color.css` tags `da-tone-teal` (Going), `da-tone-violet` (Went), `da-tone-rose` (Cancelled); Ember tokens. |
| Settings switch (Edit screen) | Ember tokens (`src/modules/organiser/ui/ember.css`): `--btn` / `--btnfg` (On), `--card2` / `--fg` (Off), `--line-strong` (border), `--mut` (the line). |
| `/account/attendance` (`MyAttendance.tsx`) | The page&rsquo;s existing classes only (`text-foreground`, `text-muted-foreground`, cyan/red/slate tag classes already on `origin/main`). |

DESIGN.md not updated by impeccable-documenter (agent unavailable): no `.claude/agents` directory
exists, and the repo has no `DESIGN.md` / component catalogue to add a going entry to.

## Stage 4 &mdash; self-checks (run 2026-10-23, 71 states, 390x844, DPR 1)

How: in the same Playwright run that made the screenshots, `audit()` measures inside the page:

- **Contrast**: every visible text node in the going surface; its colour composited over every
  layer painted under its centre (`document.elementsFromPoint`, page-fixed backgrounds included,
  each gradient stop tried, worst wins, element opacity applied). Bar: 4.5 for every size.
- **Tap targets**: bounding box of every `button`, `a[href]`, `[role=switch]` in the surface &ge; 44x44.
- **Sideways scroll**: `documentElement.scrollWidth - clientWidth` &le; 0.
- **Clipping**: any text whose clipping ancestor has `scrollWidth > clientWidth` (ellipsis/line-clamp reported as such).
- **Actionable**: each empty / loading / error state checked for an enabled control or link.

| Surface | States | Min contrast (text, state) | Taps &ge; 44 | Sideways scroll | Clipped text | Result |
|---|---|---|---|---|---|---|
| Event page tile | 37 | 4.96 (night line / messages in `--bento-fg-muted` on the raised tile) | all pass (button 48px, links 44px, person cells 52x48, Try again 44px) | 0 | "Maximiliana" ellipsis in the 52px cell (by design: first name truncates) | PASS |
| Festival hub card | 14 | 7.01 (disabled "I&rsquo;m going", event not live) | all pass | 0 | same ellipsis | PASS (going) |
| Calendar list count | 1 (0/1/3/200) | chip 8.78 after fix (was **4.32 FAIL**) | rows are the existing 75%-wide links | 0 | none | PASS after fix |
| Public dancer page "Going next" | 5 (0/1/2/3/3-open) | 6.27 (amber night line on `TEAL.card`) | cards + "See all 3" &ge; 44 | 0 | none | PASS |
| Dancer app Home | 3 | 5.33 | pass | 0 | none | PASS |
| Dancer app Nights | 4 | 5.33 ("Cancelled" tag) | pass | 0 | none | PASS |
| Dancer app Me | 1 | 4.54 (avatar initial, not going) | pass | 0 | none | PASS |
| Edit: photo switch | 2 (off/on) | 5.84 (the honest line, `--mut`) | switch 56x44 | 0 | none | PASS |
| `/account/attendance` | 4 | 6.72 | going controls pass | 0 | long title line-clamped to 2 lines in the 2-column card | PASS |

### Failures found and fixed (existing tokens / explicit px only)

1. **Calendar count chip contrast 4.32:1** (`#6b4c2a` on the chip). Fixed: `color: INK` (the file&rsquo;s
   own ink constant), 8.78:1. Only the going count chip changed (the arc plan&rsquo;s approved calendar
   scope; no density or layout change).
2. **Finish / WhatsApp link broke the message paragraph** (`GoingButton.tsx`): the inline link had
   14px vertical padding, so when the message wrapped, the last line box grew to ~44px and left a
   gap mid-sentence (`viewer-unfinished-all-four`). Fixed: the link sits on its own line,
   `flex min-h-[44px] w-fit items-center` (explicit px, still a 44px target).

### Out of scope, not changed (pre-existing, not going surfaces)

- Festival hub "Festival" pill: 4.35:1 (`text-accent-foreground` on `bg-accent/50`), existing card markup.
- Public dancer page hero labels (DANCER, Dancing/Level/Style, SPEAKS): 3.66&ndash;4.36:1 with
  `flags.personHub` OFF; the page already fixes them under that flag (`LABEL_AA`).
- Breadcrumb links on `/account/attendance` (17px tall) and "Get your own card" (16px): site chrome.

### Found by the walk and fixed (red test first for each)

1. **A failed or unknown nights read claimed a count.** With `get_nights_going_v1` failing, the
   tile said "Be the first" (count defaulted to 0). Fixed in the module so every surface gets it:
   `goingStateFor` invites only on a KNOWN 0 (`count === 0`; null = unknown), and `useNightGoing`
   returns `countKnown` and passes `count: null` when the read failed, is loading, or the database
   dropped the id; a dropped id is the same retry state as a failed read (`peopleError`). The tile
   and the hub row show "Couldn&rsquo;t load who&rsquo;s going &middot; Try again" and the button
   still taps; the calendar already shows no count for an unknown row (`nightGoingKnown`).
   Tests: `useNightGoing.test.tsx` ("a count the database did not give is never claimed"),
   `rsvpBlock.test.tsx` (failed read + dropped id). Shots: `event-tile--people-error.png`,
   `event-tile--people-unknown-night.png`, `festival-hub--people-error.png`.
2. **Cancelled past nights sat under "Nights you went to".** ONE rule in `mapMyGoing`
   (`nightsModel.ts`, read by the Nights screen, Home and `/account/attendance`): a cancelled PAST
   night is left out (nobody went to it); an upcoming cancelled night stays, tagged Cancelled. The
   level vote, the Home nudge and the attendance "Rate" link already require status `ended`, so none
   can target a cancelled night (`nightsAudit.test.tsx` checks the past list per shape).
   Tests: `nightsAudit.test.tsx`, `myAttendance.test.tsx`, `dancerAppReviewFixes.test.ts`. Shots:
   `app-nights--full.png`, `my-attendance--full.png`.
3. **Saving showed the viewer as "+1 more".** The optimistic count moved before the people list was
   re-read. `useNightGoing` now keeps `peopleCount` (the count the list was read with; client-only
   `people_count` on the cached row) and `GoingPeople` takes `peopleCount`, so "+N more" stays on the
   list&rsquo;s own count until the re-read; the count line still moves at once. Tests:
   `goingComponents.test.tsx` (in-flight table), `useNightGoing.test.tsx`, `rsvpBlock.test.tsx`.
   Shots: `event-tile--tap-saving.png`, `festival-hub--tap-saving.png`.
4. **"9 PM" wrapped onto its own line in the dancer page 2-up cards.** The card&rsquo;s night line
   (`goingNextCard`, `public-page/model.ts`) joins the hour and AM/PM with a no-break space; no
   density change. Test: `f13.test.tsx`. Shot: `dancer-page--going-next-2.png`.

### Left (out of scope for P2)

- Mockup A linked an ended / cancelled night to the series&rsquo; next night. Not built: the button
  is disabled with its reason under it. Carry into the handover&rsquo;s "what is left".
- Pre-existing, not going: `/account/attendance` header "3 nights" counts non-cancelled upcoming
  nights (`goingUpcomingCount`, the same number as Home) while a cancelled upcoming row also shows.

## Stage 5 &mdash; independent critique (2026-10-23): what changed, new numbers

Critique and ordered fix list: [`going-p2-critique.md`](going-p2-critique.md). Re-shot states (17 PNGs, 390x844, plus 360x800 / 430x932 for the first three):
[`docs/handover/going-p2/critique/`](../handover/going-p2/critique/). The handover is [`docs/handovers/going-p2-critique.md`](../handovers/going-p2-critique.md).

| Change | Before | After |
|---|---|---|
| Cancelled night count line | "No one going yet" / "3 going" | no line at 0 / "3 had said they were going" |
| Ended night, viewer going | "You&rsquo;re going &middot; Undo" | "You went &middot; Undo" (un-going still allowed) |
| Ended night, 0 | "No one went" | "No one said they were going" |
| Unfinished / no profile | grey disabled "I&rsquo;m going" + 12px link on its own 44px line | the 48px gold control IS "Finish your profile" / "Message us on WhatsApp"; the line names what is missing |
| Tile height at 390, placeholder &rarr; loading &rarr; loaded (0 going, signed in) | 172 &rarr; 172 &rarr; 194 (+22); unfinished 238 (+66) | 187 &rarr; 187 &rarr; 187 (0); unfinished 187 (0); same at 360 (186.8) and 430 (187.4) |
| Line under the button | only when there were words | always holds two lines (`min-h-[33px]`), in the placeholder too |
| `beFirst` | "&hellip; your friends will see you here." | "&hellip; your first name shows here." |
| `myUpcomingEmptyHow` | "Open a night and tap I&rsquo;m going on its page." | "Find a night on the calendar, then tap I&rsquo;m going on its page." |

Still moving: a night WITH people grows by the people row (+56px) when the people read lands. The placeholder can&rsquo;t know the count, and holding the space would need a new read (owner call). Cost of the steady height: one-line and wordless states keep 16&ndash;33px of empty space under the button.

## How these were made

Scratch walk (not in the repo, not in `test:e2e`): a Vite harness mounting the REAL components
(`RsvpBlock`, `RsvpBlockPlaceholder`, `FestivalGoing` inside the hub&rsquo;s own card markup,
`CalendarListView`, `PublicDancerPageV2`) with the switch defined ON, the real `AuthProvider` and
Supabase client, and `ProfileGateContext` per state; every `auth/v1` and `rest/v1` call answered by
`page.route` with prod-shaped rows (`get_nights_going_v1` people with photo / no photo / null id;
`get_my_going_v1`; `set_my_going_v1` ok / refusal codes / network abort / hang). The dancer app and
`/account/attendance` ran on the real `react-router dev` server built with `VERCEL_ENV=preview
VITE_GOING_PREVIEW=1` (renamed `VITE_ENABLE_GOING_PREVIEW=true` in the fix round), mocked with `tests/e2e/helpers/organiserFake.ts`. The event page, festival
hub and dancer page are SSR routes whose loaders a browser mock cannot reach (see
`playwright.config.ts`), hence the harness for those three. Clock fixed at Friday 23 Oct 2026 13:00
London (dancer app: the organiser fake&rsquo;s 8 Oct 2026).

Not rendered: the full `/event/:id` bento page and full `/festivals` page around the tile (SSR, see
above); the Home "Teachers and DJs" block shows its own error state in the shots (unmocked, not going).
