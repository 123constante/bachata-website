# People arc S1 -- shared foundation -- handover

- Branch: `claude/people-foundation` (from `main` d4bff82). Brief: `briefs/PEOPLE-S1-foundation-brief.md` on
  `brief/people-arc` (sha b8df17f3).
- Content commit: `2421617`; the head is the handover commit right after it
  (`git log -1 origin/claude/people-foundation`). PR: #980.
- No page uses the new modules yet. `flags.personWorlds` (`VITE_ENABLE_PERSON_WORLDS=true`) is added, default OFF,
  and read by nothing yet: S2-S4 wire the worlds behind it.
- `src/modules/person-page/wall/**` is untouched (S0 owns it).

## What each new module owns

| Module | Owns |
|---|---|
| `src/lib/featureFlags.ts` | `flags.personWorlds`, default OFF |
| `src/lib/languageNames.ts` | stored language value -> English name (`languageName`, `languageNames`, `FALLBACK_LANGUAGE_NAMES`) |
| `src/lib/londonDate.ts` | new `formatKeyDayLabel(key)` -> "Friday 23 October" (beside `formatKeyRange`, same UTC-noon anchor) |
| `src/modules/person-page/facts/` | every fact shown on more than one world (API below) |
| `src/modules/person-page/frame/` | `PersonFrame` (Back + Share bar, then `RoleTabs`), `Avatar`, `usePhotoFallback`, `sharePage` |
| `src/modules/person-page/worlds/tokens.ts` | `WORLD[role]` grounds/cards/sections/accents/avatar/name font, `ROLE_COLOUR`, `FRAME`, `FONT` |
| `src/lib/seo/useSeo.ts` | the removeChild crash fix (below) |

## Public API

`facts/` (pure, no React):

| Function | Rule |
|---|---|
| `publicName(raw)` | trim, every whitespace run -> one space; `null` = no name |
| `stageName(raw)` | `publicName` with every leading "DJ " cut ("DJ  DJ Ana" -> "Ana") |
| `worldNames({ name, djName }, role)` -> `{ big, small }` | DJ world: DJ name big + public name small, only when they differ; no DJ name -> public name only; other worlds: public name; no name -> role label ("Dancer"); never a "DJ " prefix |
| `languageLine(raw[])` | "Spanish, English"; unknown codes dropped; `null` = hide |
| `londonDayOf(keyOrIso)` | London calendar day of a date key or a UTC RPC timestamp |
| `dateLabel(keyOrIso)` | "Friday 23 October" via `formatKeyDayLabel` (no second copy) |
| `countLabel(n, noun)` | "3 gigs coming up"; 0/1 -> `null` (owner rule: only from 2) |
| `cityLabel(raw)` | city without a UK postcode or outward code |
| `flagCode(raw)` | `normaliseNationalityCode` (NationalityFlag's own rule): alpha-2 or `null`. Never printed: pass it to `NationalityFlag` |
| `initials(name)` | first + last initial (same rule as the wall's `initialsOf`), "?" when no name |
| `WorldNames` | type |

`frame/`:

| Export | Contract |
|---|---|
| `PersonFrame({ backHref, backLabel?, shareTitle, roles, current, slug, children })` | Back left, Share right (both >= 44px), then `RoleTabs`, then the world (`children`). Identical boxes on every world, so the tabs sit at the same y |
| `RoleTabs({ roles, current, slug })` | all roles, Teacher, DJ, Dancer; current filled in `ROLE_COLOUR[role]`, others with a dot; real `<Link>`s to `/teachers|/djs|/dancers/<slug>`; 44px min height; nothing for one role or no slug |
| `roleTabs(roles, current, slug)` | the same as data (`RoleTab[]` or `null`), in `frame/roleTabsModel.ts` |
| `Avatar({ name, photo, world, size, ring? })` | photo in a circle, else initials in Inter 800 coloured by `WORLD[world].avatar`; a failing photo (also failed before hydration) falls back to initials |
| `usePhotoFallback(photo)` | copy of #963's `wall/usePhotoFallback.ts` |
| `sharePage(title)` | `navigator.share` (a cancel is silent), else copy the link + toast |

## The removeChild crash (brief step 6)

Walked on main (production build, prod data, 390x844, `personHub` + `peopleWall` ON):

| Journey | Before the fix | After |
|---|---|---|
| `/dancers/ramiro-zapata` -> DJ pill -> Teacher pill -> Dancer pill | ok | ok |
| `/djs/papacito` -> Dancer pill -> DJ pill | ok | ok |
| `/people/ramiro-zapata` opened directly -> DJ card | ok | ok |
| `/dancers` -> Ramiro tile -> `/people/ramiro-zapata` -> DJ card | **CRASH** `NotFoundError: removeChild` | ok |
| `/dancers` -> Ramiro tile -> hub -> Dancer card | **CRASH** | ok |

So role page -> role page is fine on main; the crash is **not** hub-only code but shared: `useSeo` (used by the
client-rendered wall) removed *every* `<meta name="robots">` in its cleanup, including the one React Router's `<Meta />`
renders for `/people/:id` (its `meta()` is noindex). The wall unmounts after the hub's head has rendered, deletes
React's node, and React's next commit throws removing it again. The instrumented `removeChild` showed exactly that
node. Fix: `useSeo` marks the robots meta it adds (`data-use-seo`); each noindex page adds its own node and removes only that node, and an indexable page clears only marked nodes, never a route's own.
Test: `src/lib/seo/__tests__/useSeoRobots.test.tsx` (red on the unfixed code: `NotFoundError`).
Any framework route with a robots meta (`/teachers`, `/organiser`, `/venue`, a 404) reached from a `useSeo` page had
the same exposure.

## Old copies S2-S4 must switch to the new functions (from the P0 audit, `docs/people-arc/audit/REPORT.md` section 2)

`H:` = the #963 file. Line numbers are the audit's.

| Fact | Old copy | Switch to |
|---|---|---|
| Name | `modules/profile/dancerPublicProfile.ts` `attachPublicDancerName`; `pages/DJProfile.tsx:164`; `pages/TeacherProfile.tsx:251` (`hide_surname: false` at `:159`); `H: hub/model.ts:147`; `wall/model.ts:64,76` `bareStage`; `person-page/badges.ts` `nameFor` | `worldNames`, `publicName`, `stageName` (the name READ stays the RPC's; only the display rule moves) |
| Next date / date label | `pages/DJProfile.tsx:180-204` and `H: hub/model.ts:54-60` (upcoming split); `H: wall/model.ts:30` and `components/dj/djFormat.ts:7` (month names); `wall/model.ts` `wallDateLabel` | `dateLabel`, `londonDayOf` |
| Gig count | `H: hub/model.ts:140`, `components/dj/djRoleModel.ts:93`, `components/dj/DjTiles.tsx:220` | `countLabel` |
| Languages | `H: hub/model.ts:77-83` (raw codes); `modules/dancer-app/public-page/model.ts:110-118` (`languageName(s)`, ~line 45-118 on main); `pages/TeacherProfile.tsx:449-465` (raw) | `languageLine` / `@/lib/languageNames` |
| Nationality | `pages/TeacherProfile.tsx:270` (prints the code as text) | `flagCode` + `NationalityFlag` |
| Photo / initials | `wall/model.ts:40` `initialsOf`; `components/dj/DjTiles.tsx:68`; `PersonAvatar`; `hub/HubFace.tsx` (own fallback); `H: wall/usePhotoFallback.ts` | `Avatar`, `initials`, `frame/usePhotoFallback` |
| City | `modules/dancer-app/public-page/model.ts:177` `cityOnly`; the hub (no postcode strip) | `cityLabel` |
| Role tabs | `person-page/RoleSwitchBar.tsx` + `roleSwitch.ts` (pills), hub chips | `RoleTabs` / `roleTabs` |

**dancer-app:** the brief asked to move the language map out of `modules/dancer-app/public-page/model.ts`. Changing a
file under `src/modules/dancer-app/` makes a PR a dancer-area PR for `scripts/check-dancer-area-isolation.mjs` (rule a:
every other changed file must then be a seam), and rule c forbids importing from dancer-app outside the seams. So
dancer-app is untouched; `src/lib/languageNames.ts` holds the logic, and **S2 must switch dancer-app's
`languageName(s)` and `cityOnly` to `@/lib/languageNames` and `facts.cityLabel` in a dancer-area PR** (check the seam
list in `scripts/dancer-area-isolation-allowlist.json`), deleting the old copies.

## What S2-S4 must do

1. Wire each world behind `flags.personWorlds` inside `PersonFrame`; no world formats a fact itself.
2. Back rule: `PersonFrame` takes `backHref`; the audit (section 4.3) still needs one Back rule decided.
3. DJ world calls `useDjPageFonts()` for DM Serif Display; Fraunces 700 already loads site-wide
   (`DECORATIVE_FONTS_HREF`). No font request was added.
4. Delete the old copies above as each screen switches; dedupe `wall/usePhotoFallback.ts` to `frame/`.
5. Time labels ("19:30") and "played at" month labels are not in `facts/` yet (not in the S1 list): add them there,
   not in a world.

## Review (`/code-review` medium, before commit) -- what was done with each finding

| Finding | Outcome |
|---|---|
| `useSeo` removed whichever marked robots meta, so a late cleanup could drop the next page's noindex | fixed: per-instance node + test |
| `sharePage` copied + toasted after a user cancel | fixed: `AbortError` returns silently + test |
| `flagCode` its own 2-letter rule | fixed: delegates to `normaliseNationalityCode` |
| `fmtKeyPart` cache comment said three shapes | fixed |
| `usePhotoFallback` comment named a file not on main | fixed (names the PR #963 branch, and HubFace's inline copy for S2) |
| `initials` differs from wall `initialsOf` on leading punctuation ("(Papi) Juan" -> "(P" on the wall) | kept: the facts rule is the correct one; the wall is S0's file; S2 switches the wall to `facts.initials` |
| second copies of language names / city rule | kept: forced by the dancer-area isolation guard (above); S2 deletes the dancer-app copies |
| language reverse index covers 2-letter codes only | kept: byte-equal to the live dancer-app logic; change it once, after S2 dedupes |
| date label has no year | kept: the owner-approved format is "Friday 23 October"; S3/S4 decide a year rule for far dates |
| `flags.personWorlds` has no reader | by design (brief): S2-S4 wire it |

## Not verified

- No page renders `PersonFrame`/`Avatar`/`RoleTabs` yet, so no browser walk of the new components (unit-rendered only,
  jsdom: no real layout, so "same y" is proven as identical boxes, not measured pixels; tap size is the 44px min-height).
- Real photos: the image host is unreachable from the sandbox, so the photo path in the browser walk was the failure path.
- Initials rule: first + last (the live wall's rule); the worlds reference drew first + second. Owner may pick.
- Vercel preview not checked (not needed per brief).
- Local CI runs (PR #980 body has the per-job table): `test:unit` 12555 passed, 15 failed, the same 15 as clean main in
  this sandbox (live-DB contract suites + `integrityCouldNotRun`). `test:e2e` 154 passed, 4 failed; 3 passed on rerun, and
  `organiser-home.spec.ts:55` also fails with main's `useSeo.ts`. The pre-push hook is not executable in the container, so
  git did not run it; run by hand, it failed only on `integrityCouldNotRun`. No `--no-verify` used.
