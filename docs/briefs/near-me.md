# N7 nearMe: shared location provider + "Near me" chip (flag nearMe, default OFF)

Owner "Build this" 2026-11-19. Binding registry rows: "Public homepage first screen" incl. LOCATION SPEC (read ~/.claude/plans/DESIGN-REGISTRY.md row; if you cannot, the facts below are the contract).

## Build (smallest working version, one PR, flag OFF = every screen exactly as before)
1. New flag `nearMe` in src/lib/featureFlags.ts: `import.meta.env.VITE_ENABLE_NEAR_ME === 'true'`, comment like homePolish.
2. One shared `GeolocationProvider` (lift src/hooks/useGeolocation.ts state; useMapList, CityMap, Tonight each currently have their own). Mount only when nearMe ON; OFF keeps today's per-hook behaviour.
3. Location is asked ONLY on tap of the "Near me"/Nearest chip (HomeChipRow). Never auto-prompt.
4. Remember the fix 30 min: store {lat,lng,accuracy,ts} in localStorage; drop restored fixes older than 30 min. Restore only if permissions.query already says granted. Persist the Nearest preference only.
5. Cards/rows show distance on the right as "~2 mi" (tilde always). Existing row layout otherwise unchanged. Date order kept when not located.
6. States: loading over ~8s -> "Still looking... Cancel" (retry capped, loading guard on Try again); denial copy split by browser/PWA, Chrome dismissed prompt = "Not now" not red error; accuracy over ~5 km shows "Rough location" hint; nearest event over ~60 mi -> "These events are far from you" + Clear, keep date order; zero nearby -> message, chip stays usable; one shared permissions change listener with Safari fallback; fill the empty onError branch (useGeolocation.ts ~110) with a per-reason count only, no coordinates leave the device.
7. Tap targets 44px (explicit px; phone html font is ~13.5px). British English copy, full weekday names.

## Checks
Unit tests for provider (30-min expiry, no auto-prompt, denial split, tilde format). Add to explicit lists if needed. Real-data check on prod shapes (read-only counts, project stsdtacfauprzrdebmzg). 390x844 walk with screenshot in PR. No density changes to files in CLAUDE.md exclusions. Do not flip any flag. Open PR as bot with real body at once.
