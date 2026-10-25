# Brief: independent critique of PR #1049 (teachers directory per city). READ-ONLY review worker, opus.

You did NOT build this. Review branch `claude/teachers-directory-city` (PR #1049, head ef644af6) against main. Do not edit the PR branch. Push ONLY your report, to your own branch `claude/teachers-directory-city-critique`, at `docs/reviews/teachers-directory-city-critique.md`, then end the commit subject with the done marker from your dispatch prompt.

Read: `brief/teachers-directory-city.md` (the original brief and owner decisions), `docs/design/teachers-directory-city.md`, `docs/handover/teachers-directory-city.md`, the diff. Supabase is read-only.

## Owner decisions to check the build against
- One directory page per ACTIVE city at `/city/<slug>/teachers`; London (`london-gb`) is the only active city today. Switcher lists active cities. `/teachers` redirects to the visitor's city else London.
- A city with no teachers, or an unknown/inactive slug: London plus the note "No teachers listed in <city> yet. Know one? Tell us." with the real ListingRequestForm.
- Flag `teachersDirectory` stays OFF; nothing may become public with the flag off (gate, sitemap, redirect, 308).
- Compact density, 44 px taps with explicit px, no sideways scroll at 390x844, every empty/loading/error state actionable, HTML entities not raw Unicode punctuation.

## What to look for (correctness first, then design)
1. Flag-off leaks: does ANY path expose or index the new route, the sitemap entry, or the redirect while the flag is off? Does `vercel.json` 308 loop or change behaviour for existing `/<slug>-xx/teachers` URLs?
2. Data: RPC args (`p_city_slug`), the cities read for the switcher (`is_active = true`), the 46/5/0/inactive/unknown shapes in the matrix test. Run `npx vitest run src/modules/teachers-directory tests/sitemapTeachersCities.test.ts tests/sitemapEdgeTtl.test.ts` and report counts. Is any test vacuous (would it still pass if you deleted the behaviour)? Mutate two behaviours to check.
3. Redirect logic: visitor city with no teachers, stored `activeCitySlug` invalid, SSR vs client, redirect loops, back-button trap.
4. Title/canonical/heading: one h1, city name in title, canonical per city, loading-state canonical.
5. Design vs the record: copy points at controls that exist, switcher sheet states, disabled-with-reason, the "Tell us" form behaviour when the city changes (known gap in the handover: judge whether it must be fixed before merge).
6. Perf: `perf-budgets.json` bump of 1 KB, is it justified.
7. Anything in the diff outside the brief's scope.

## Output
Ordered list: BLOCKER / SHOULD / NIT, each with file:line, failing scenario, and the minimal fix. End with a one-line verdict: MERGE-READY / FIX-THEN-MERGE / REWORK. Be honest about what you could not run.
