# Handover: red main pins A
Done: 4 items. (1) catchallGate COOKIE pin updated to shipped `Path=/; SameSite=Lax; Secure` (app/documentCacheHeaders.ts, intended; test was stale). (2) `/og-raffle-win.jpg` pinned (public/ is served statically; used by app/routes/raffle-win.tsx). (3) Added `/claim/:token` and `/start-organiser` to CATCHALL_CLIENT_PATHS. (4) Added check-lazy-route-css.mjs to prove-entry-point-dispatch TARGETS.
Verified: vitest on the 3 files, 64/64 pass. tsc: 0 errors in touched files. Not verified: full unit suite, CI.
