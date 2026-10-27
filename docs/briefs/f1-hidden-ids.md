# Brief: F1 hide self-started organiser pages that are not yet visible (Website)

Lane: normal (no database change). Branch: claude/f1-hidden-ids. One slice = one branch = one push.
Context cap 50%; push + handover before stopping.

## Why
Admin RPC `public.organiser_directory_hidden_ids_v1()` returns `uuid[]` (never NULL; `{}` when none) of LIVE organiser
pages that are self-started and not yet visible (D3: hidden until a published event or Trusted). It is APPLIED to prod
(20270304210000), anon may execute it. Prod returns `{}` today (0 self-started pages). Three Website reads of
`organiser_profiles` must subtract it, calling it ONCE per read (never per id):

1. `src/pages/Organisers.tsx` - the directory list query (queryKey `entities-organisers`).
2. `src/hooks/useDirectoryCounts.ts` - `fetchOrganiserCount` (head-only exact count; keep it head-only, exclude the ids in the query: `.not('id','in','(...)')`, and skip the filter when the array is empty).
3. `app/routes/sitemap.tsx` - `fetchOrganiserProfiles` (filter the returned rows in JS; the limit stays 500).

## Build
- ONE shared helper (new file, e.g. `src/lib/organiserDirectoryHiddenIds.ts`) that calls `supabase.rpc('organiser_directory_hidden_ids_v1')` and returns `string[]`. The sitemap runs server-side with its own client (`db`): the helper takes the client as an argument. Do not copy the rule into three places.
- On an RPC error THROW (same as the neighbouring queries' `if (error) throw error`). Never fail open silently.
- Do not touch `src/modules/organiser/p3/**`, the organiser profile page route, or any calendar density file.
- Types: the RPC is not in the generated types; cast narrowly at the helper, nowhere else.

## Tests (table-driven, red first)
- Helper: `{}`, one id, several ids, null data (treated as error? decide and test: null from a successful call = empty), RPC error throws.
- Directory list, home count, sitemap: each with hidden = none / one / all rows; the count excludes exactly the hidden ids; the sitemap never lists a hidden slug; an empty array adds no `.not` filter.
- A consistency test that all three call sites import the SAME helper (grep-style or import assertion).
- Run the new tests against the unfixed code first and state they were red.

## Definition of done (Website CLAUDE.md)
Run every applicable CI job step locally in your sandbox and put the per-job table in the PR body, with a "Verified / Not verified" block. State plainly that prod has 0 hidden pages today, so the live behaviour is identical to before; the tests carry the hidden cases.
Use explicit px sizes if you add UI (you should not: no visible change expected). HTML entities, not raw Unicode punctuation, in JSX. Files over 2 KB go through scripts/safe-edit.py / safe-write.py.
