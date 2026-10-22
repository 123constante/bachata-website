# Handover: W2-C build slice 1 &mdash; Back row + role switcher + DJ page (behind flags.personHub)

Ticket dt_9d0660a4fbb9. Branch `claude/w2c-build` off `main` at 3a21361. Brief:
`brief/w2c-role-pages:docs/briefs/W2C-build-brief.md`. Design Gate: [`docs/design/w2c-build.md`](../design/w2c-build.md).

## Done

- **N-A bar** (`src/modules/person-page/roleSwitch.ts` pure model, `RoleSwitchBar.tsx` view + hook wrapper):
  "Back to &lt;name&gt;" (44 px, ellipsis) to `/people/:slug`, then one pill per role page that exists, current
  filled in its `CHIP` colour, others with a `CHIP` dot. Roles/labels/links from `roleTagsFor` (the ONE mapping
  the wall and hub read); colours from `wall/tokens.ts`. One role = back row only. Hidden until the person read
  answers, and hidden when the hub would 404.
- **Old "Also:" row replaced only with the flag ON**: `AlsoRoles` returns the switcher when `flags.personHub`,
  else the old row (body unchanged). So the **dancer page gets the bar with NO dancer file edited**
  (`DancerProfile.tsx` / `PublicDancerPageV2` untouched; isolation check: rule c, OK). The bar bleeds to the
  page edge and fades in (12 px) and out (24 px) onto the teal ground: measured seam step 2/255.
- **DJ page D-C** (`src/components/dj/DjRolePage.tsx`, model `djRoleModel.ts`): rendered by `DJProfile` only when
  `flags.personHub && !embedded`. Turntable extracted from `DjHero` as `DjTurntable` (188 there, 152 here; same DOM).
  Name 36/30/26 px by length, wraps, no clip. Dates first (max 3 + "See N more dates" expands in place), About,
  Photos (all of them, 3-column), Listen &amp; book, then Pricing / FAQ when present, Share at the foot. Gig times are
  read exactly as stored (naive "local-as-UTC", the DjTiles rule; never Intl-converted). Before the dates read
  answers: a placeholder; if it fails: "Dates could not load"; never a false "No dates". Flag-ON loading skeleton
  paints the warm ground. Shared helpers moved to `djFormat.ts` (`parseDateParts`, `normalizeUrl`, new
  `instagramUrl` for bare handles, used on the new page only; today's contact panel is unchanged).
- Tests: `roleSwitch.test.tsx` (67) and `djRolePage.test.tsx` (45), red on main (modules missing), green here.
- Two `/code-review` rounds (high): round 1 (10 findings) and round 2 (10) fixed or listed below; fixes to round 2
  are unreviewed code.

## Left / owner calls

1. **Two Backs on the dancer page** with the flag ON: the warm bar's "Back to &lt;name&gt;" and the dancer page's own
   "Back" (to /dancers). Removing the dancer page's own Back is a dancer-area file: left for the dancer-area PR
   (mock `P-after-*` already drops it).
2. **DJ sections not on the D-C mock** are not on the flag-ON page: genres EQ, "Played at" (past gigs, no route to
   them on the flag-ON page), SoundCloud/Mixcloud embedded players (links stay), contact panel (phone is not
   exposed by the RPC yet; when it is, the flag-ON page needs a phone slot; Instagram/website/SoundCloud/Mixcloud/Facebook are in Listen &amp;
   book), guestbook stub. Pricing and FAQ are kept as plain cards. Owner: keep any of the dropped ones?
3. **Sub-name** (real name under the DJ name, as in the mock) is NOT shown: the DJ RPC's first/surname are not
   privacy-masked; the masked name comes from the person read. Could be added from that read.
4. Back-label name = the person's (masked) real name from the person read, as the brief says; the hub's h1 for a
   DJ-led person is the stage name, so the label and the hub heading can differ ("Back to Roger Mart&iacute;nez" &rarr;
   hub titled "DJ Roger").
5. **Requests**: the bar needs the person's name, so each flag-ON role page also runs the person read
   (`loadPersonSnapshot`: dancer row, roles RPC, DJ read shared with the page's cache, teacher read only while
   teacher pages are open) plus the badges RPC. A narrow name+roles read would be cheaper; flag OFF = no change.
6. **Back control changes once on the DJ page**: "Back to DJs" (fallback, to /djs) until the reads answer, then the
   bar ("Back to &lt;name&gt;" + pills, about 50 px taller). Other pages show nothing until then (like today's Also row).
7. Initials on a photo-less DJ read "DN" for "DJ Nadia" (today's `initials()`); the mock showed "N".

## Verified / Not verified

- Verified (final tree): e2e smoke `npm run test:e2e` 158 passed / 7 skipped, exit 0; unit suite 12166 passed,
  16 failed = the same 15 that fail on untouched main in this sandbox (live-DB contract suites +
  `integrityCouldNotRun`) + 1 `auth.today` snapshot that passes 3/3 alone (full-suite timing; no auth file touched), lint chain 19/20 (`check:integrity` exit 126 = script not
  executable in this checkout; `bash bin/check-integrity.sh` ok, 0 issues), `npm run build`, perf budgets,
  first-load requests, chunk cycles, `AUDIT_STRICT=1 check:images`, isolation check + self-test, typecheck job
  steps. Six screenshots at 390x844 looked at.
- **Not verified on prod data**: the sandbox's Supabase env is a non-prod project, the Supabase MCP connector is not
  authorised here, and the live site is blocked by the sandbox proxy, so no prod shape survey ran. The non-prod
  project has 4 DJs (all with no dates/photo/bio): useless as a survey. Pictures use the mock's fixtures in a
  harness, not the deployed app; no Vercel preview walk (one push only).

## Next steps

1. Owner phone test on the Vercel preview with `VITE_ENABLE_PERSON_HUB=true` (preview env), on a DJ with &ge;4 dates,
   a DJ with none, a dancer-only person and a DJ+dancer.
2. Prod shape survey (needs the Supabase connector): count DJs by upcoming-dates bucket (0 / 1&ndash;3 / 4+), name
   length bucket, Instagram present, role combos from `get_public_people_badges_v1`.
3. Dancer-area PR (P pick) removes the dancer page's own Back under the flag.
