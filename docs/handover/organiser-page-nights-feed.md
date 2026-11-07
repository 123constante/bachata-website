# Handover: organiser page nights feed swap

Done: both feeds on `get_organiser_nights_v2`; city on each night; "+N city" on series; 20-cap wording and quiet line; matrix, window, loader and wording tests; types entry; design record and inventory.

Verified: vitest src/modules/profile + loader test pass; `npx tsc --noEmit -p .` 0 errors; check:rpc-typing and check:mojibake pass. Prod shape survey (live organisers, upcoming via v2 limit 1000): 0 = 24, 1-20 = 10, 21-100 = 16, 100+ = 0.

Not verified: `npm run gen:types` failed in the sandbox (network), so the `get_organiser_nights_v2` entry in src/integrations/supabase/types.ts was added BY HAND (args/Returns Json[] matching the prod signature) -- regenerate with `npm run gen:types` on a networked machine. check:bundle-budget, full lint chain, browser walk at 390x844, CI per-job table, other-city and cancelled survey counts. `p_past_limit: 5000` is my addition (server default 50 would cap nights hosted); confirm the server accepts it. eslint on OrganiserProfile.tsx reports pre-existing errors not from this change.
