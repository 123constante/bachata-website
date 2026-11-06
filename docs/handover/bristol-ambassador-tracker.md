# Handover -- bristol-ambassador-tracker

Branch `claude/bristol-ambassador-tracker`. Counts-only tracker card (owner change 2026-11-06).

Done: `link/trackerModel.ts`, `link/LinkCard.tsx`, `fetchLinkTracker` / `setLinkActive` in `ambassadorApi.ts`, card mounted in `AmbassadorQueuePage.tsx`, 26 table-driven tests in `link/__tests__/linkCard.test.tsx`, design record.

Prod shape re-checked read-only 2026-11-06 (function source): row keys link_id, code, city_name, city_slug, is_active, admin_locked, live, ambassador_first_name, joined, city_set; no `joiners`. 0 ambassador rows on prod.

Left: browser walk at 390x844 (not done by this worker); generated Supabase types lack the two RPCs, so `ambassadorApi.ts` calls them through an untyped wrapper -- drop it after a types regen. `/join/a/<code>` page is a separate brief.
