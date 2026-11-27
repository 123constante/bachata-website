# Handover: red main pins B (P45)

Done:
1. secrets-register.json: seo-recheck-2026-12-25.yml added to GSC_SERVICE_ACCOUNT_KEY readers_allowed (workflow from #2489).
2. REAL BUG fixed: /classes, /parties, /tonight stamp seo-landing but SEO_LANDING_PATHS omitted them, so a purge would skip them on Cloudflare. Added them (app/cloudflarePurge.ts); test counts 8->11, 32->38 URLs follow.
3. Fixture drift: home.meta now reads params.slug (matrix passed only data -> 500); fixture passes params. Canonical /city/london-gb is intended (source comment: "/" 307-looped); literal pinned.

Verified: the 3 target files green (164 tests); check:mojibake clean; tsc -p tsconfig.app.json: 0 errors in branch files.
Not verified: other full-suite reds are not in my files: catchallGate/catchallClientPaths/entryPointCoverage (Part A), embedded.test.tsx, venuesLondon.bytes, eventViewCompat.contract (needs DB). Not checked against main. Browser walk n/a (no UI change).
