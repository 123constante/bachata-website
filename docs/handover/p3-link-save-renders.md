# Handover: p3-link-save-renders
Done: `linkRenders` + ticket/video rule in linkRules.ts; matrix test (RED first: 33 failures on unchanged code, 0 after for ticket/video); design record.
Left: website/facebook/chat gaps (see docs/design/p3-link-save-renders.md), pinned as KNOWN_GAPS.
Verified: vitest src/modules/organiser 221 files pass; check:mojibake clean; tsc: 0 errors in linkRules files.
Not verified: the real public page after a save; 390x844 browser walk of the P3 Details ticket sheet; full CI jobs; /code-review not run.
