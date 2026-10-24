# Going P2 &mdash; independent design critique (Design Gate stage 5)

Branch `claude/going-p2-critique`, off `claude/going-p2-website` @ `0a7836e` (PR #992).
Written by a fresh worker that did not build P2, BEFORE editing. Inputs: the 71 shots in
[`docs/handover/going-p2/`](../handover/going-p2/INDEX.md) (each one looked at), the
approved mock `origin/claude/going-p0-design:docs/design/going/option-a.html`, the
builder's record [`going-p2-website.md`](going-p2-website.md), and the module source.

The visitor: a London bachata dancer on a phone deciding whether to go to a night, or
checking their own nights. Prod today: every upcoming night has 0 going, 4 in 5
profiles are unfinished, and 0 of 188 profiles have the photo switch on. So the three
states people will actually meet are **"No one going yet"**, **"finish your profile"**
and **initials circles**.

Verdicts: **fixed here** (red test first, see the handover) / **not a bug** /
**owner call** (it changes an owner decision, needs a new read, or adds new content:
a recommendation, not code).

## Ordered fix list

| # | Finding | Why it matters to the visitor | Severity | Verdict |
|---|---|---|---|---|
| 1 | **A cancelled night says "No one going yet"** (or "3 going") under "Who&rsquo;s going". `GoingPeople` printed `goingCountText(total)` whatever the night. No shot covered cancelled + 0, which is the real prod shape. | "Yet" invites people to a night that is not happening. "3 going" claims people are going to it. | blocker | **fixed here**: `goingCountText(n, past, cancelled)`. A cancelled night shows no count line at 0 and "3 had said they were going" otherwise. Tile and hub both pass `cancelled`. |
| 2 | **An ended night where you said going shows "&check; You&rsquo;re going &middot; Undo"** (`goingState.ts:276`). Present tense on a night that is over. (The shot `event-tile--night-ended-was-going.png` shows "Night ended" instead: it is stale, see 10.) | It reads as if the night is still on. | blocker | **fixed here**: the label is "You went &middot; Undo". Un-going after the end stays allowed: that was a deliberate review fix, and un-going is always allowed. Whether "Who went" should be lockable after the end is an **owner call**. |
| 3 | **Unfinished profile = a dead full-width grey "I&rsquo;m going"**, with the real way on as a 12px underlined link on its own line (`viewer-unfinished-*`, `festival-hub--viewer-unfinished-dance-role`). This is the commonest signed-in state (4 in 5). The same applies to "no dancer profile" with its WhatsApp link. | The eye lands on a button that does nothing. The next step is small and below it. | should | **fixed here**: when a refusal has a way on, the 48px gold control IS the way on ("Finish your profile" / "Message us on WhatsApp"). The line under it still names exactly what is missing. There is one control, not two, and no new words. |
| 4 | **The tile jumps when data lands.** Placeholder and people-loading are 172px; the commonest loaded state (0 going, finished) is 194px (+22px); unfinished is 238px (+66px). The placeholder had no line under the button, and loaded states with no words had none either. | Content below the tile moves while someone is reading or about to tap. | should | **fixed here** with no new read: the placeholder holds a two-line message (`min-h-[33px]`). The two commonest real states both wrap to two lines at 360&ndash;390px: signed out, and "Be the first" at 0 going. Unfinished loses its extra 44px link line because of fix 3. A first try held one line under every button: it still jumped +16px and left dead space under wordless states, so it was dropped (measured, see the handover). |
| 5 | **"No one went"** on an ended night with 0 (`goingCopy.ts`). | Untrue: people went, nobody tapped. The feature is honest about what it knows. | should | **fixed here**: "No one said they were going". "5 went" stays: it matches the app&rsquo;s "Went" tag. |
| 6 | **`myUpcomingEmptyHow` "Open a night and tap I&rsquo;m going on its page."** is vague: which night, and where? (The builder flagged it.) | A newcomer with 0 nights doesn&rsquo;t know where nights are. | should | **fixed here**: "Pick a night on the calendar, open it and tap I&rsquo;m going." In the app it is followed by the existing `FIND_A_NIGHT` line (the Bachata Calendar link at the top left, owner decision D130: no Browse button in /app). On `/account/attendance` it is followed by the existing "Browse events" button. |
| 7 | **"Be the first &mdash; tap I&rsquo;m going and your friends will see you here."** There is no friends list, and anyone can see the name. | It promises something that does not exist and hides who can actually see you. | should | **fixed here**: "&hellip; and your first name shows here." (This matches the sign-in line.) |
| 8 | **Ended and cancelled tiles are dead ends.** There are words but no way on. The mock had "See the next night &rarr;". | Someone on an old link has nowhere to go from the tile. | should | **owner call**: this needs the series&rsquo; next night (a new read). Recommend building it in P3 with the organiser view. The rest of the event page (sticky bar, breadcrumbs) is still a way on. |
| 9 | **Calendar list shows "N going" on a cancelled row** (`CalendarListView.tsx:152` has no cancelled check). It never says 0 (the chip shows only when the count is above 0). | Same as 1, but on the calendar. | should | **owner call**: `CalendarListView.tsx` is a density-excluded file, and CLAUDE.md says to ask Ricky before changing anything in it. Recommend `goingCount > 0 && !event.isCancelled`, a one-line change. |
| 10 | **Three shots did not match the code.** `event-tile--tap-success` showed "3 going" and the gold button: the scratch mock re-read the old rows after the save. `event-tile--night-ended-was-going` showed a disabled "Night ended". `app-nights--error` was a copy of `--loading`. | The pack could not be signed off as evidence. | blocker (process) | **fixed here**: the changed states were re-shot (see the handover). The builder&rsquo;s scratch harness is not in the repo, so the re-shoot is a new harness over the same real components. |
| 11 | **Dancer page "Back" always goes to `/dancers`** (`PublicDancerPageV2.tsx`). Going adds a new path in: tap a face on the event tile. | Back from that person drops you in the directory, not the night. | should | **owner call**: this is site-wide navigation, not the going module. Recommend history-back when the referrer is same-site, else `/dancers`. |
| 12 | **App Home says "0" three times** with 0 nights (`app-home--going-0`): the hero empty line, an "Upcoming nights 0" tile and a "0 Going" strip cell. | Noise on the screen most people see. | nice | **owner call**: removing a tile or cell is a content change on the app home. |
| 13 | **"Add your photo to say you&rsquo;re going"** while the photo stays hidden unless the switch is on. | A newcomer wonders why a photo is required if it isn&rsquo;t shown. | nice | **owner call**: `avatar_url` is in `profile_complete_v1` (owner decision 2, admin owns it). |
| 14 | **Focus ring**: `GoingButton` and the people links rely on the browser outline (no `outline-none` anywhere on them; `index.css` removes it only for `.gl-input`). | Keyboard users need to see focus. | nice | **not a bug**: Chromium&rsquo;s default two-tone ring shows on both the dark bento and the gold. A themed amber ring is a nice-to-have. |
| 15 | `/account/attendance` is titled "My Event Attendance", while the app says "Nights you&rsquo;re going to". | Two names for one list. | nice | **owner call** (page title / breadcrumb IA). |
| 16 | "+192 more" can&rsquo;t be tapped to see everyone. | You can&rsquo;t see the whole list. | nice | **owner call**: needs a list view and a paged read. |
| 17 | Two density-excluded files (`EventCalendar.tsx`, `CalendarListView.tsx`) were edited by P2 (the going feed and the chip colour), and CLAUDE.md says to ask Ricky first. These are not density changes. | Process. | should (process) | **owner call**: Ricky to OK the two calendar edits before merge. |

## Checks that came back fine

- **"+N more" maths**: 12 &minus; 8 = 4 and 200 &minus; 8 = 192. While a save is in flight it stays on the list&rsquo;s own count.
- **Tap targets**: the button is 48px, the people cells are 52x48, and the links and Try again are 44px, all in explicit px.
- **Contrast**: the lowest going text is 4.54 (app Me). It is 4.96 on the event tile and 8.78 on the calendar chip.
- **Full weekday names** on the tile and on every night line (`nightLine`).
- **Failed read**: a failed or unknown read never claims a count. It says "Couldn&rsquo;t load who&rsquo;s going &middot; Try again", and the button still works.
- **Wording** is the same on the event tile and the hub (one copy file).
- **Refusal words**: every refusal has words. After fix 3, the profile refusals also have a way on. Ended and cancelled have the page around them (finding 8).

## Seams (what was seen)

- **Tile vs bento**: no seam. The tile is `--bento-surface-raised` with a hairline on `--bento-surface`. The CTA is the sticky bar&rsquo;s own gold. The disabled grey button used to blend into the tile and read as dead (fixed by 3 for the profile refusals; ended and cancelled stay grey on purpose).
- **Hub card**: no seam. It uses the hub&rsquo;s own black and orange.
- **Header vs page ground**: the tile and hub shots are rendered without page chrome. In the app, no seam. On `/account/attendance`, the black header against the navy page is a mild seam that was already there.
- **Sign-in sheet over the tile**: a square, pure-black sheet with a flat orange "Sign in" over the green bento. The shared `AuthPromptModal` was already there, not going (noted).
- **Page vs footer**: on `/account/attendance`, short states end in about 600px of empty ground and then a full-bleed orange footer (already there). The dancer page&rsquo;s teal frame ends on pure black (already there). The calendar is unchanged.
