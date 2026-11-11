# Handover: seo-event-jsonld-rogue

## Diagnosis (read-only, prod project stsdtacfauprzrdebmzg)
event_series_p5.lifecycle_status counts: draft 13, archived 654, paused 3, ended 24, live 72.
rogue-bachata and rogue-bachata-wednesday are `paused`. Owner SEO decision (a) in
src/lib/seo/eventPageSeoPolicy.ts: paused pages are 200, indexable, in the sitemap, show
"On hiatus", and emit NO Event node (their only date already ran). The code is right; the
guard (scripts/check-seo.mjs) demanded an Event node on every sampled /event/ page, so a
correct paused page went red. bailando-sundays (ended) and ritmo-de-bachata-festival (live) pass.

## Fix
check-seo.mjs: a page showing the hiatus banner with no Event node passes (and counts as
asserted); a hiatus page WITH an Event node fails; no banner and no node still fails.
Three new self-test cases (shape x page). Self-test: 76 cases PASS.

## Not verified
- Live preview / SEO Guard run (sandbox has no outbound access to the site).
- That the "On hiatus" text is in the SERVER HTML on prod: not curl-checked. If SSR omits it, the guard still reds those two pages.
- Red-first on a PR run; tsc not run (no TS touched).
