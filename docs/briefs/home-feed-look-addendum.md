# home-feed-look ADDENDUM (owner click 2026-11-19, supersedes anything older in the brief)

Near me goes INSIDE the poster-text category row, as one more poster word after All: All, Near me, Party, Class, Fest.
- Tap Near me: sort nearest first; ask for location ONLY on that tap; cards show tilde distances like "~2 mi".
- It replaces the separate Near me chip when homeFeedLook is ON. Flag OFF: the live homePolish chip row stays untouched.
- Data source: the nearMe flag/provider already in prod (#1813, VITE_ENABLE_NEAR_ME, ON). Reuse src/lib/geo and the shared GeolocationProvider. Do NOT rebuild geolocation.
- Tap sizes: no separate spec; use a 44px minimum for folder tabs, category words and map pins.
- Add the Near me word states to INVENTORY (default, selected, location denied, loading, zero nearby).
- Mockup: https://claude.ai/artifact/FF4kyEZdgfkDgwVU7LASd8
