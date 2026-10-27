# Handover: F1 hidden organiser ids (Website)

Brief: `brief/f1-hidden-ids:docs/briefs/f1-hidden-ids.md`. Branch `claude/f1-hidden-ids`. Status: DONE (not merged).

## Done
- `src/lib/organiserDirectoryHiddenIds.ts`: the ONE helper. `fetchOrganiserDirectoryHiddenIds(client)` calls
  `organiser_directory_hidden_ids_v1()` once; an error throws, null data from a successful call = `[]`, a
  non-array throws. Also `hiddenIdsNotFilter(ids)` (null when empty) and `withoutHiddenOrganisers(rows, ids)`.
  The only cast of the untyped RPC is here.
- `/organisers` list: queryFn moved verbatim to `src/lib/organiserDirectoryList.ts` (`fetchDirectoryOrganisers`),
  RPC runs in parallel with the select, rows filtered in JS. Same queryKey `entities-organisers`.
- `useDirectoryCounts.fetchOrganiserCount`: still head-only; adds `.not('id','in','(...)')` only when ids exist.
- `app/routes/sitemap.tsx` `fetchOrganiserProfiles`: RPC in parallel, rows filtered in JS, limit 500 unchanged.
- Tests: `src/lib/__tests__/organiserDirectoryHiddenIds.test.ts` (22). Red on unfixed code (14 call-site tests
  failed); sitemap fail-open mutant caught.

## Found, NOT done (outside the brief -- owner decision)
1. `useDirectoryCounts` has NO importers in `src/` or `app/` -- the "homepage count" is dead code today.
2. Site search (`search_public_v2`, `src/lib/searchRpc.ts`) still returns organisers the directory hides.
3. `/organisers/:id` (app/routes/organiser.tsx) still serves hidden pages 200 + indexable (brief forbade touching it).
4. No `db-contract-check.yml` step guards the new RPC; a rename/revoke would 500 the sitemap and error /organisers.
5. Sitemap filters AFTER `.limit(500)` (as the brief specified); harmless at 48 rows, worth `.not()` past ~500.
6. Count's `.not('id','in',...)` URL grows ~37 chars per hidden id; fine until hundreds.

## Next steps
Owner review of the PR; decide on items 2-4 as follow-up briefs.
