#!/usr/bin/env node
// Prints the ready Vercel preview URL for the current PR to stdout (logs go to
// stderr so `$(node scripts/resolve-preview-url.mjs)` captures only the URL).
// Shared by the preview-coverage workflow jobs (og/seo/synthetic) so each points
// its existing check at the PR preview instead of production. Throws (non-zero
// exit) if no preview becomes ready — fail-loud, never a silent empty base.
import { resolvePreviewUrl } from './lib/previewProbe.mjs';

const url = await resolvePreviewUrl({ log: (m) => console.error(m) });
process.stdout.write(`${url}\n`);
