# People arc S6 -- the dancer world without the socials filler (design record)

Brief: `briefs/PEOPLE-S6-dancer-socials-removal-brief.md` on `brief/people-arc` (sha 9eef7fa8). Behind
`flags.personWorlds` (`VITE_ENABLE_PERSON_WORLDS=true`); flag OFF = today's page, untouched.

## Brief (5 lines)

1. Owner phone test 2026-10-24: "Socials in London this week" looked like the dancer's own plans. Remove it.
2. No other dated world -> the lower half is just the invite ("Dance bachata too?" + "Get your own card").
3. No calendar filler, no extra link, no "Find a party" button; the calendar is never read from a dancer page.
4. Kept: D6 "Coming up" previews of the dancer's OWN dated teacher / DJ worlds; D8 invite (hidden when signed in).
5. Loading (owner decided): dancer-only reserves nothing; a teacher / DJ holder reserves ONE 64px preview row.

## Chosen outcome (owner already chose)

- `lowerHalf(previews)` returns `{ heading: 'Coming up', items }` or `null`. Nothing else. No heading without an item.
- `useDancerLower(id, slug)` returns `{ roles, half, reserve }`. `reserve` is true only while a person who holds
  teacher and/or DJ (and has a slug, which a preview needs) waits for those dates. Roles still unknown = no reserve
  (159 of 189 by the brief's count, 36 of 174 by mine below, hold no other role -- either way a reserve there is a
  box most pages would lose).
- A failed or empty date read = `half` null = just the invite (never a stuck box).
- The page-level loading skeleton (`DancerWorldSkeleton`) holds the card and the invite room only (no week of rows).
- Deleted (no importer left, grep-proved): `socialsThisWeek`, `CalendarLike`, `SocialRow`, `SocialsDay`,
  `SOCIALS_MAX`, `SOCIALS_COPY`, `ALL_SOCIALS_HREF`, `DEFAULT_CITY`, `PARTY_ACTION` (only the dancer world and
  its test used it; the DJ world reads `facts.FIND_A_PARTY` directly), `SocialsState`, `Socials`, `SkeletonWeek`,
  `PillLink`, and the `getCalendarEvents` / `resolveCanonicalCity` / `londonDayRangeUtc` reads.

## Found on the walk: the footer jump on every short world page (fixed here)

`GlobalLayout`'s `fitContent` rule (`.route-shell:has(> [data-fit-content]){min-height:0}`, S3b) was a JSX text
child of `<style>`, so the SERVED html carried `:has(&gt; ...)` -- an invalid selector. The route wrapper kept a
full screen of height until hydration re-rendered the rule, then the footer jumped up. With the socials gone the
dancer-only page is short, so the jump came into view: CLS 0.054-0.118 on dancer-only pages with the rule escaped,
0 with it fixed. Fix: `<style dangerouslySetInnerHTML={{ __html: FIT_CONTENT_CSS }} />` (a constant, no input),
pinned by a `renderToString` test that failed first. It helps every fitContent world page (DJ, teacher too).

## Checks (Design Gate; `docs/people-arc/s6/walk.mjs`, prod data, flag ON, signed out)

| Shape | Profile | Size | CLS before (main) | CLS after | Lower half after | Contrast | Taps <44 | Clipped | Sideways | Invite last | Filler before -> after |
|---|---|---|---|---|---|---|---|---|---|---|---|
| thin-teacher-past | `aitor-angelica-tbf` | 390x844 | 0.056 | 0 | none (just the invite) | 5.06 | 0 | 0 | no | yes | yes -> no |
| thin-teacher-past | `aitor-angelica-tbf` | 360x800 | 0.045 | 0 | none (just the invite) | 5.06 | 0 | 0 | no | yes | yes -> no |
| dancer-only-photo-city | `ben` | 390x844 | 0 | 0 | none (just the invite) | 5.06 | 0 | 0 | no | yes | yes -> no |
| dancer-only-photo-city | `ben` | 360x800 | 0 | 0 | none (just the invite) | 5.06 | 0 | 0 | no | yes | yes -> no |
| dancer-only-no-photo-no-city | `pao-pao-army` | 390x844 | 0 | 0 | none (just the invite) | 5.06 | 0 | 0 | no | yes | yes -> no |
| dancer-only-no-photo-no-city | `pao-pao-army` | 360x800 | 0 | 0 | none (just the invite) | 5.06 | 0 | 0 | no | yes | yes -> no |
| dancer-only-photo-no-city | `florian` | 390x844 | 0 | 0 | none (just the invite) | 5.06 | 0 | 0 | no | yes | yes -> no |
| dancer-only-photo-no-city | `florian` | 360x800 | 0 | 0 | none (just the invite) | 5.06 | 0 | 0 | no | yes | yes -> no |
| teacher-dated | `alex-boneva` | 390x844 | 0 | 0 | none (just the invite) | 5.06 | 0 | 0 | no | yes | yes -> no |
| teacher-dated | `alex-boneva` | 360x800 | 0 | 0 | none (just the invite) | 5.06 | 0 | 0 | no | yes | yes -> no |
| teacher-undated | `alexa-bzuk26` | 390x844 | 0 | 0 | none (just the invite) | 5.06 | 0 | 0 | no | yes | yes -> no |
| teacher-undated | `alexa-bzuk26` | 360x800 | 0 | 0 | none (just the invite) | 5.06 | 0 | 0 | no | yes | yes -> no |
| dj-dated | `bobby-blanco` | 390x844 | 0.135 | 0.141 | previews | 5.06 | 0 | 0 | no | yes | no -> no |
| dj-dated | `bobby-blanco` | 360x800 | 0.123 | 0.143 | previews | 5.06 | 0 | 0 | no | yes | no -> no |
| dj-undated | `brito` | 390x844 | 0.052 | 0.161 | none (just the invite) | 5.06 | 0 | 0 | no | yes | yes -> no |
| dj-undated | `brito` | 360x800 | 0.054 | 0.164 | none (just the invite) | 5.06 | 0 | 0 | no | yes | yes -> no |
| dj-past | `kal` | 390x844 | 0.052 | 0.161 | none (just the invite) | 5.06 | 0 | 0 | no | yes | yes -> no |
| dj-past | `kal` | 360x800 | 0.054 | 0.164 | none (just the invite) | 5.06 | 0 | 0 | no | yes | yes -> no |
| both-dated | `b` | 390x844 | 0.103 | 0.128 | previews | 5.06 | 0 | 0 | no | yes | no -> no |
| both-dated | `b` | 360x800 | 0.105 | 0.132 | previews | 5.06 | 0 | 0 | no | yes | no -> no |
| both-undated | `john-otaran` | 390x844 | 0.052 | 0.153 | none (just the invite) | 5.06 | 0 | 0 | no | yes | yes -> no |
| both-undated | `john-otaran` | 360x800 | 0.054 | 0.155 | none (just the invite) | 5.06 | 0 | 0 | no | yes | yes -> no |
| both-dj-dated-no-photo-no-city | `nickchata` | 390x844 | 0.135 | 0.141 | previews | 5.06 | 0 | 0 | no | yes | no -> no |
| both-dj-dated-no-photo-no-city | `nickchata` | 360x800 | 0.123 | 0.143 | previews | 5.06 | 0 | 0 | no | yes | no -> no |

- Contrast: lowest 5.06 on every render (>= 4.5). Taps: none under 44px (invite button `minHeight: TAP` = 44px
  explicit; preview rows 64px). Clipped: none. Sideways scroll: none. Invite is the last thing before the footer on
  every shape. The filler strings appear on no shape after (they did on 16 of 24 renders before).
- Every state actionable: previews link to the world; otherwise the invite button. No copy points at a missing control.
- Before = `main` at 33dddc8/f4d9a69 built the same way (flag ON, prod data), measured by the same script.

## Shift numbers, read honestly

- Dancer-only and teacher-only-on-prod (teacher pages are closed in this build -- `flags.teacherDetail` OFF -- so `snapshot.roles` drops teacher and
  those pages behave as dancer-only): 0 before, 0 after. The reserve never shows for them.
- DJ holders: 0.05-0.14 before, 0.13-0.16 after. Traced with layout-shift sources on `brito` at 390: 0.123 is the
  role-tab bar (52px) arriving when the roles answer and pushing the card and everything under it; ~0.037 is the
  64px reserve collapsing when the dates answer empty. Before, the same tab push happened but the footer sat below
  the fold behind a week of socials, so less of the moving area was on screen. The tab push is the frame's (S1), not
  this slice's; it is flagged for the Stage 5 critique, not changed here.

## Second walk: teacher pages OPEN (`VITE_ENABLE_TEACHER_DETAIL=true`, `checks-teacher.json`)

| Shape | Profile | Size | CLS | Lower half | Previews | Contrast | Taps <44 | Invite last | Filler |
|---|---|---|---|---|---|---|---|---|---|
| thin-teacher-past | `aitor-angelica-tbf` | 390x844 | 0.153 | none (just the invite) | 0 | 5.06 | 0 | yes | no |
| thin-teacher-past | `aitor-angelica-tbf` | 360x800 | 0.155 | none (just the invite) | 0 | 5.06 | 0 | yes | no |
| teacher-dated | `alex-boneva` | 390x844 | 0.139 | previews | 1 | 5.06 | 0 | yes | no |
| teacher-dated | `alex-boneva` | 360x800 | 0.143 | previews | 1 | 5.06 | 0 | yes | no |
| teacher-undated | `alexa-bzuk26` | 390x844 | 0.164 | none (just the invite) | 0 | 5.06 | 0 | yes | no |
| teacher-undated | `alexa-bzuk26` | 360x800 | 0.167 | none (just the invite) | 0 | 5.06 | 0 | yes | no |
| both-dated | `b` | 390x844 | 0.15 | previews | 2 | 5.06 | 0 | yes | no |
| both-dated | `b` | 360x800 | 0.156 | previews | 2 | 5.06 | 0 | yes | no |
| both-undated | `john-otaran` | 390x844 | 0.153 | none (just the invite) | 0 | 5.06 | 0 | yes | no |
| both-undated | `john-otaran` | 360x800 | 0.155 | none (just the invite) | 0 | 5.06 | 0 | yes | no |

Teacher previews render ("Next class ..."), two previews for a teacher + DJ with both dated, and teacher holders
with no upcoming class get just the invite. Their CLS (0.14-0.17) has the same make-up as the DJ holders': the
role-tab bar arriving (~0.12) plus the reserve settling.

## Not verified

- Signed-in renders in the browser (no test account in this worker): covered by the matrix (invite hidden, no filler).
- A teacher preview in the browser: teacher pages are closed in this build (`flags.teacherDetail` OFF), so no teacher holder gets one
  (same on `main`); covered by the matrix with roles open.
- Stage 5 critique is a separate worker; this record does not self-certify.

## Review round (code-review, high) -- what changed, what stays

- Fixed: a date read paused offline (`fetchStatus: 'paused'`) left the reserve pulsing; it now counts as settled
  (matrix row "date reads paused offline"). Fixed: `facts.FIND_A_PARTY`'s comment still named the dancer world.
- Stays (owner decision, recorded): the reserve is inserted only once the roles answer and is one 64px row with no
  heading, so it can itself shift (~0.037 when it collapses; a dated preview adds the 31px heading on top). The owner
  chose this over holding room for every dancer; the critique can weigh it against the numbers above.
- Stays (outside this slice): other `<style>{text}</style>` call sites may carry the same server-escaping bug (e.g.
  `src/pages/AccountSettings.tsx` CRUMB_TAP_CSS with `"`); a shared inline-style helper or a guard would close the class.
- Stays (owner D8''): a signed-in viewer on a dancer-only page with no contacts sees the card alone (no invite, no
  lower half). Flagged for the owner/critique; no copy added here.
