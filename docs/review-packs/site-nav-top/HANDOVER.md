# Handover: site-nav-top (DONE)

Code change in 44e58c8 (see PR body). This pass: phone spec run (10/10 pass after), same spec on main (10/10 fail, as designed: main has the bottom bar), screenshots in after/ and before/, production build (prerendered page served statically) measured at 390x844 and 360x780 (prod-*.png).
Spec fix: Raffles is flag-gated off in prod, so the row has 3 targets (Organisers, Venues, Community); the spec accepts 3 or 4.
Not verified: fixed full-height layers still reported touching the bottom on the prod page (likely background layers, not inspected); lighthouse, e2e-smoke, seo/og.
