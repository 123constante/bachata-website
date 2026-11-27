# Fix: photo-order flag not visible in the preview build (PR #1599, branch claude/organiser-photo-order)

Lane: normal. One small change on the SAME branch, same PR. No DB, no migration.

Owner words: "still old" (the Pictures sheet on the flagged preview om32c27ae showed the old X-remove grid, not Make cover / move / Remove).

Facts: `src/lib/featureFlags.ts` reads `import.meta.env.VITE_ENABLE_ORGANISER_PHOTO_ORDER === 'true'`. The preview tool deploys with `--build-env VITE_ENABLE_ORGANISER_PHOTO_ORDER=true`. `vite.config.ts` already inlines the other per-build preview flags through `define` (see VITE_ENABLE_GOING_PREVIEW). The flag may not be reaching the client/SSR build.

Do:
1. Work out whether the flag really is dropped from the build (read how Vite and `react-router build` expose process.env VITE_* to `import.meta.env`; check the other flags that work in previews). Say what you found in the PR.
2. If it is dropped: add `import.meta.env.VITE_ENABLE_ORGANISER_PHOTO_ORDER` to the `define` block in `vite.config.ts`, same pattern as VITE_ENABLE_GOING_PREVIEW. Add or extend a test/guard so the flag cannot be silently dropped again.
3. If it is NOT dropped: do not change config; walk the Pictures sheet at 390x844 with the flag on and report why the old UI showed.
4. Keep the PR body's Verified / Phone QA blocks accurate. Do not touch the photo-order UI itself.

Done = pushed to the branch with a `[worker-done <ticket>]` commit; reply states which case (2 or 3).
