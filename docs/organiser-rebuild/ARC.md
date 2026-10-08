# Organiser area rebuild -- ARC (binding for every worker)

Branch: `arc/organiser-rebuild` (draft PR "Organiser area rebuild (arc): work in progress").
Workers cannot see the prompt that started this arc. THIS FILE is the spec. If
something here conflicts with older docs, plans or code comments, this file wins.

## Why

The owner says everything after login was bad. The OLD organiser area was (all of it
deleted by W5a; the URLs now redirect, see the route map):

| URL | Page | Components (src/modules/organiser-self-serve/components) |
|---|---|---|
| `/account` | `src/pages/Account.tsx` | OrganiserHome + OrganiserOnboarding |
| `/account/new` | `src/pages/AccountNew.tsx` | CreateEventForm |
| `/account/series/:seriesId` | `src/pages/AccountSeries.tsx` | SeriesEditor + DateActionSheet + ProgrammeEditor |
| `/account/team/:organiserId?` | `src/pages/AccountTeam.tsx` | TeamPanel |

Routes live in `src/components/AnimatedRoutes.tsx` (flag `flags.organiserSelfServe`).

The Line-up built in PR #653 failed on phones. The primitives in `src/modules/organiser/ui`
exist to make each of those failures impossible:

| #653 failure | Primitive that prevents it |
|---|---|
| Search popover off-screen inside a 300px sheet at 390x844 | `SheetView`: list and search are VIEWS of one sheet (`viewKey`), `fullHeight` 85dvh capped to the visible viewport above the keyboard; no popovers |
| Removal faded but left a 48px gap | `Collapse`: opacity AND height (and divider border) to exactly 0, then unmount |
| Sessions looked empty after save (writer re-creates date-only sessions with new ids) | Not a UI primitive: W3 must re-read the schedule after save and match sessions by content, never by a cached id (see W3 notes) |
| Contrast failures 2.1-2.99:1 | `.org-theme` tokens, every pair measured (table below) |
| Nested Radix dialogs | `SheetView` throws in development when rendered inside another `SheetView` |

## Owner decisions (binding)

The approved mockup is v12 (https://claude.ai/artifact/S5F8epkUaiV9AbT5spHskK; source
`c:\tmp\organiser-mockup.html` on the owner's machine). The tokens below ARE the spec.

- Phone first (390px, also 320px). Wide screens (>= 900px): two columns (list left ~300px, editor right).
- Bottom tab bar: Home, Events, Team, Profile (fixed, safe-area aware).
- DARK surface, soft raised cards, ONE light (cream) primary button per screen, gold used
  only for the active tab, links and small accents. OUR brand (not Luma's navy). Layout
  PATTERN borrowed from a create-event page (cover with round change button, borderless big
  title, summary rows that show the current value and open ONE small editor, one big
  button); only our own components, code, icons, wording. No third-party assets.
- Motion: one timing everywhere, 0.3s ease-in-out, no bounce; bottom sheets slide up;
  removal fades AND collapses height to 0; short shake on failed save; skeleton shimmer
  instead of spinners in lists; prefers-reduced-motion respected everywhere. Three radii
  only: 16 (cards), 12 (controls), 8 (chips) plus full-round. (The mockup's cover uses 20
  and the icon tile 7; those two are reproduced as drawn.)
- Live edits to published events: a PREVIEW card of the public card + one primary button
  in a sticky bottom bar, and the plain note 'Guests see changes to live events straight away.'
  (`PreviewBar`, `LIVE_NOTE`).

## DOMAIN (final; supersedes anything older)

- There is NO price, NO capacity, NO approval toggle, NO start-time field, NO duration, NO
  timezone control (London, fixed, never shown), NO event-type, NO level (at event level),
  NO group chat, NO public/private pill, NO calendar pill, NO 'look/theme' row, NO
  instagram on the event (instagram belongs to the ORGANISER profile on the Profile tab).
- The event editor shows ONLY these owner-ticked fields: name (borderless big title),
  description, music-style chips (tap chips), venue (city is automatic), organisers, ticket
  URL (a 'More' card), shape (single / repeating etc.), 'Starts on' (date), 'Repeats'
  (pattern), 'Runs until' shown as 'Listed until <date> - Extend' (the series lists up to
  30 UPCOMING dates; the UI enforces the limit itself and offers only end choices that stay
  within 30; show 'Up to 30 upcoming dates'), cover + gallery, video.
- A DATE has a SCHEDULE of sessions. Session editor: type (class, masterclass, party,
  performance), free-text name, start + end, levels (multi-select: beginner, improver,
  intermediate, advanced, open_level), people. People belong to SESSIONS and show on the
  session row ('Ana Ruiz, Cleo Park'). PEOPLE BY TYPE: class and masterclass = TEACHERS
  only; party = DJs only; performance = NO add control (performers/MC are read-only 'added
  by the team'). The organiser picker only ever offers teachers and DJs. A date's time
  FOLLOWS its sessions (first start to last end).
- Per-date edits are only: venue, sessions on this date, add a session / remove a session
  from this date, break week (skip), cancel with a public reason.
- Home: 'Next dates' list, big New event button, no stats, and strips only when needed:
  team requests, 'dates listed until <date> - Extend' (when under ~8 weeks of runway
  remain), 'N dates have no teacher or DJ yet' (opens the first). A lapsed series just has
  no upcoming dates. Reminders are IN-APP only.
- Backend: EXISTING RPCs ONLY. `src/modules/organiser/shared/selfServeApi.ts` wrappers
  and `selfServeErrors.ts` are reused as-is and are NOT anyone's to change. The 'Starts on'
  + 'Repeats' + 'Runs until' + 'Listed until' wording, and the SCHEDULE card (session rows)
  are what the Date card in the event editor holds.

## Hard rules for every worker

- The old UI is gone (W5a). Its reused LOGIC lives in `src/modules/organiser/shared/` (api,
  errors, commands, models, a few hooks, plus the public claim card + email-code proof that
  the public organiser page renders). Import it; do not copy it. It is shared, so a change
  there is a change for every page (and the public organiser page): keep it rare, tested.
  `src/modules/organiser-self-serve/selfServeApi.ts` is only a re-export shim for
  `src/pages/AuthCallback.tsx` (a login file this arc may not edit); new code never imports it.
- Never touch login (`src/pages/Auth.tsx`, `AuthCallback.tsx`, `src/components/auth/*`,
  `useAuth`, AuthGuard internals) or any public-site page.
- No prod writes. No migrations (this repo owns none). No admin repo changes.
- Commit and push as the bot; never `--no-verify`; never merge or approve.
- No nested dialogs, no floating popovers: one `SheetView` per editor, swap views inside it.
- One `PrimaryButton` per screen.
- Lists: skeleton rows while loading (`SkeletonRows`), never a spinner. Removal uses
  `Collapse`. Failed save: `useShake` + a visible message.
- Colours only from `.org-theme` tokens (`var(--fg)` etc). New colour pairs must be
  measured and added to the contrast table below.
- HTML entities in JSX for punctuation (`&mdash;`, `&rsquo;`), per CLAUDE.md.
- Website PR #654 (branch `claude/lineup-rebuild-2026-10-07`) is a PARKED Line-up rebuild
  that W3 will reuse. Nobody merges it.

## Route map (all under `/account/o`, lazy, behind the same AuthGuard as Account.tsx)

| URL | Page file | Owner |
|---|---|---|
| `/account/o` | `src/modules/organiser/home/index.tsx` | W1 |
| `/account/o/events` | `src/modules/organiser/events/index.tsx` | W2 |
| `/account/o/events/new` | `src/modules/organiser/events/NewEventPage.tsx` | W2 |
| `/account/o/events/:seriesId` | `src/modules/organiser/events/EventEditorPage.tsx` | W2 |
| `/account/o/events/:seriesId/dates/:occurrenceId` | `src/modules/organiser/dates/index.tsx` | W3 |
| `/account/o/team` | `src/modules/organiser/team/index.tsx` | W4 |
| `/account/o/profile` | `src/modules/organiser/profile/index.tsx` | W4 |
| anything else under `/account/o/` | redirects to `/account/o` | W0 |
| `/account` (old) | redirects (replace) to `/account/o` | W5a |
| `/account/new` (old) | redirects to `/account/o/events/new` | W5a |
| `/account/series/:seriesId` (old) | redirects to `/account/o/events/:seriesId` | W5a |
| `/account/team/:organiserId?` (old) | redirects to `/account/o/team?o=:organiserId` | W5a |

The old-URL redirects keep the query string and hash, sit behind the same flag, and live in
`src/modules/organiser/shell/LegacyRedirect.tsx` (eager, tiny; imported by AnimatedRoutes).

Wiring: one route `/account/o/*` in `src/components/AnimatedRoutes.tsx` lazy-loads
`src/modules/organiser/shell/OrganiserRoutes.tsx`, which wraps `AuthGuard` (signed-out
visitors go to the same `/auth` sign-in with a return path) and `useNoindexMeta(true)`, and
lazy-loads one page per folder. It is NOT wrapped in `PageTransition` (its transform +
filter would break the shell's `position: fixed` frame). Build links with
`ORG_PATHS` from `src/modules/organiser/shell/paths.ts`, never by hand.

The shell is a fixed full-viewport layer (z 60) over the public header and bottom nav, so
no public chrome changes. Sheets render at z 70/71.

## File ownership (no worker edits another's folder)

| Path | Owner |
|---|---|
| `src/modules/organiser/home/**` + Account onboarding/claim screens | W1 |
| `src/modules/organiser/events/**` | W2 |
| `src/modules/organiser/dates/**` (sessions, programme, Line-up, cover upload) | W3 |
| `src/modules/organiser/team/**`, `src/modules/organiser/profile/**` | W4 |
| `src/modules/organiser/shell/**`, `ui/**`, `theme.css`, `motion.ts`, router wiring, deletions of old code | W0 / W5 |
| `src/modules/organiser/shared/**` (old logic, moved by W5a) | W5 (shared: change only with its tests) |
| `docs/organiser-rebuild/HANDOVER.md` | everyone (append your checkpoint) |

Need a new primitive or a change to one? Write it in your own folder first and say so in
HANDOVER.md; W5 promotes it. Do not edit `ui/` or `shell/`.

## Shell API (`src/modules/organiser/shell`)

`<OrganiserShell>` props: `title`, `back={{ to, label? }}`, `topBarEnd`, `topBar` (replaces
the simple bar), `children` (single column, max 640px), `list` + `detail` +
`detailPlaceholder` (two columns >= 900px; on phone `detail` wins when present, else
`list`), `actionBar` (sticky, above the tab bar, above the keyboard), `hideTabs`, `testId`.
Layout is a flex column (header / scrolling `main` / action bar / tab bar), so the tab bar
can never overlap the action bar. When the keyboard is up the frame shrinks above it and
the tab bar hides. testids: `org-shell`, `org-content`, `org-actionbar`, `org-tabbar`,
`org-tab-home|events|team|profile`, `org-list`, `org-detail`, `org-back`.

## Primitive APIs (`src/modules/organiser/ui`, usage in `ui/README.md`)

Every primitive takes `testId` (rendered as `data-testid`).

| Primitive | Key props |
|---|---|
| `Card` | `label?` (section label + region), `variant: 'rows' \| 'padded'` (rows = 1px dividers) |
| `SummaryRow` | `icon`, `label`, `sublabel?`, `value?`, `affordance: 'chevron' \| 'pencil' \| 'none'`, `onPress?`, `disabled?` |
| `SectionLabel` | `as: 'h2' \| 'h3' \| 'p'` |
| `StatusTag` | `tone: 'live' \| 'draft' \| 'party' \| 'neutral'` |
| `Pill` | `icon?` (read-only) |
| `Chip` | `selected`, `onToggle`, `disabled?` (aria-pressed, check mark, 44px) |
| `PrimaryButton` / `GhostButton` | `loading`, `loadingLabel`, `size: 'md' (52) \| 'sm' (44)`, `block`; forwardRef |
| `AttentionStrip` | `actionLabel?`, `onPress?`, `icon?` |
| `DateChip` | `date` ('YYYY-MM-DD' London date or ISO); `londonDateParts()` |
| `Cover` | `src?`, `alt`, `onChange?`, `changeLabel`, `emptyLabel` |
| `TitleInput` | `value`, `onChange`, `aria-label`, `placeholder`, `maxLength` |
| `SheetView` | `open`, `onOpenChange`, `title`, `viewKey`, `onBack?`, `fullHeight`, `footer`, `returnFocusRef?`, `description?` |
| `SearchField` | `value`, `onChange`, `aria-label`, `autoFocusInSheet` |
| `PersonRow` | `name`, `role?`, `sublabel?`, `onRemove?`, `removed?`, `onUndo?`, `onPress?`, `trailing?` |
| `Collapse` | `show`, `onExited?` |
| `Skeleton` / `SkeletonRows` | `count`, `label` |
| `useShake()` | `{ shake, shaking, shakeProps }` |
| `PreviewBar` | `preview`, `actionLabel`, `onAction`, `loading`, `disabled`, `live`, `shakeProps` |
| `EmptyState` / `ErrorState` | `title`, `body`, `action` / `onRetry`, `retrying` |
| `AnnounceRegion` + `useAnnounce()` | aria-live polite |
| `useKeyboardInset()` | `{ inset, height }` from visualViewport |
| `usePrefersReducedMotion`, `MOTION_MS` | re-exported from `shared/usePrefersReducedMotion.ts` (not copied) |

## Theme tokens and contrast (measured, WCAG 2.x relative luminance)

All tokens are CSS variables under `.org-theme` (`src/modules/organiser/theme.css`). Global
`:root` is untouched. Changed from mockup v12 to pass AA: `--ph` (#6f665a -> #8f8678),
new `--line-strong` #776e60 for borders that carry meaning, and muted text inside a faded
(removed) row switches to `--fg`.

| Pair | Ratio | Need | Result |
|---|---|---|---|
| fg #f6f1e7 on bg #0f0d0b | 17.23 | 4.5 | pass |
| fg on card #1a1713 | 15.86 | 4.5 | pass |
| fg on card2 #231f19 | 14.56 | 4.5 | pass |
| fg on sheet #1d1a15 | 15.41 | 4.5 | pass |
| fg on tab bar #0c0a08 | 17.56 | 4.5 | pass |
| mut #a39a8b on bg | 6.98 | 4.5 | pass |
| mut on card | 6.42 | 4.5 | pass |
| mut on card2 | 5.89 | 4.5 | pass |
| mut on sheet | 6.24 | 4.5 | pass |
| mut on tab bar (inactive tab) | 7.11 | 4.5 | pass |
| gold #ffa600 on bg | 9.89 | 4.5 | pass |
| gold on card | 9.11 | 4.5 | pass |
| gold on card2 (selected chip) | 8.35 | 4.5 | pass |
| gold on sheet (Back link) | 8.84 | 4.5 | pass |
| gold on tab bar (active tab) | 10.08 | 4.5 | pass |
| btnfg #15120e on btn #f6f1e7 | 16.59 | 4.5 | pass |
| Live tag #8fe0b0 on #1f3a2a | 7.93 | 4.5 | pass |
| Draft/Party tag #ffd58a on #3a2d10 | 9.69 | 4.5 | pass |
| strip text #ffd58a on #3a2a10 (gradient start) | 9.97 | 4.5 | pass |
| strip text on #2a1f10 (gradient end) | 11.63 | 4.5 | pass |
| danger #ff8a7a on card / sheet | 7.80 / 7.57 | 4.5 | pass |
| placeholder mockup #6f665a on bg / card2 | 3.44 / 2.91 | 4.5 | FAIL -> replaced |
| placeholder --ph #8f8678 on bg / sheet / card2 | 5.40 / 4.83 / 4.56 | 4.5 | pass |
| removed row (opacity .72): fg -> #b8b4ac on card | 8.64 | 4.5 | pass |
| removed row: mut at .72 -> #7d7569 on card | 3.96 | 4.5 | FAIL -> uses fg |
| --line-strong #776e60 vs card / sheet / card2 (field, chip borders) | 3.56 / 3.46 / 3.26 | 3 | pass |
| cream button edge vs bg | 17.23 | 3 | pass |
| focus ring gold vs bg | 9.89 | 3 | pass |
| --line #2e2922 vs card / bg | 1.24 / 1.35 | 3 | decorative only (dividers, card edges; never the sole cue) |
| strip border #5a4118 | 1.69 | 3 | decorative only (text carries the meaning) |

Re-measure with the snippet in HANDOVER.md before adding a colour.
