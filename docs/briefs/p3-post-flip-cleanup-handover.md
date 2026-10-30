# Handover: p3-post-flip-cleanup

Done
1. GraceBanner "Continue" (an `<a class="p3-btn">`, inline, so min-height was ignored and the label sat high): new rule `.p3-grace-acts .p3-btn` in p3.css (inline-flex, centred both ways, min-height 44px, px line-height, no vertical padding). Pinned by `graceButton.layout.test.ts` (CSS-text test; jsdom does no layout).
2. `join/__tests__/inviteNextAction.table.test.tsx`: dead links (used/revoked/expired/unknown/malformed) each show words + home link; open link per person (signed out, no dancer profile, complete); bind outcomes (bad shape, bad_email, rate_limited, bound).

Nits (not changed)
- "Hide for today" and Settings are `p3-link` text buttons; their tap height was not measured.
- The banner's pixel centring was NOT measured in a browser, only pinned in CSS.

Not verified: 390x844 browser walk, real-data shape survey (no code path changes data), CI jobs beyond the two new test files + eslint. Independent review round not run.
