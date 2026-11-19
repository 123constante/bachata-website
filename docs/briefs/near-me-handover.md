# nearMe handover

Done: flag `nearMe` (OFF); `GeolocationProvider` (mounted in AppShell only when ON); 30-min `localStorage` fix, restored only when permission is already granted; tap-only requests; "Near me" chip label; "Not now" for a Chrome-dismissed prompt; denial copy split browser/PWA/iOS; capped retries (3) + loading guard; `~` distances; "Rough location" hint (>5 km); zero-measurable message; shared permission-change listener with visibilitychange fallback; `geo_error` reason-only count.
Existing homePolish already had the 8 s "Still looking... Cancel" and 60 mi "far" + Clear, so those are reused.
Left: the chip lives in HomeChipRow, so it needs homePolish ON too. Tonight/CityMap/useMapList share state automatically via `useGeolocation()` when the provider is mounted. No 390x844 browser walk done.
Next: owner walks it on a phone with both flags on in a preview.
