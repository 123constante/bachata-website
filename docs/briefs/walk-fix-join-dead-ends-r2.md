# Brief: walk-fix-join-dead-ends-r2 (WEBSITE, NORMAL lane, Sonnet). Retake three walk pictures. Branch claude/walk-fix-join-dead-ends (continue it)

Context: stay under 50% of your context; push ONCE, then stop. Never merge/approve/--no-verify. Plain git only. No product code under src/. Do not add run-ci.

Problem: in docs/walk/fix-join-dead-ends-r1/ the pictures 01-unknown.png and 02-used-signed-out.png are BLANK pages (both exactly 35501 bytes, no heading, no buttons) and 03-expired.png was taken mid fade-in (blurred). The earlier RESULTS.md says PASS from the DOM measurements, but the pictures do not show it.

DO: `git fetch origin claude/walk-fix-join-dead-ends main`, continue on that branch. In tests/e2e/walk-fix-join-dead-ends.spec.ts, before each screenshot: wait for the screen's own heading text to be visible (for example getByRole('heading', { name: /This link does not work/ })), then wait for the entry animation to finish (wait for the main content's computed opacity to be 1 and no running animation: `page.evaluate(() => document.getAnimations().every(a => a.playState !== 'running'))` polled, or `page.emulateMedia({ reducedMotion: 'reduce' })` before navigating) and `page.waitForTimeout(300)` last. Retake 01, 02, 03 (and 04 the same way for consistency). Then OPEN each picture yourself and check it actually shows the heading and the buttons; if one still looks blank, find out why (unmocked route? error boundary?) and say so in RESULTS.md instead of reporting PASS. Update RESULTS.md: for each picture add a column "Picture shows heading and controls: yes/no". Keep sizes: no picture may be byte-identical to another.

Deliverable: one push; final commit subject ends [worker-done <ticket>].
