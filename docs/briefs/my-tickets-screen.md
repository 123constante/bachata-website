# my-tickets-screen (Website, BUILD-visual)

Brief-version: 2
Lane: Website. Model: Opus, high (new screen, auth, QR, bundle budget). Queue: B (my tickets). Branch: `claude/my-tickets-screen`.
Serves: `docs/scoping/queue-organiser-ticketing-2026-11-04.md` Q1.

## What main lacks
- A screen where a signed-in buyer sees their paid tickets and a QR to show at the door. `my_tickets_v1()` is live on prod (authenticated only, no args) and returns `{tickets: [{order_id, event_series_id, event_title, occurrence_date, start_time ("HH24:MI"), ticket_type_name, ticket_id, qr_token, checked_in, checked_in_at}], truncated, total_count}`, ordered upcoming first then past. `grep -rn my_tickets_v1 src` finds nothing. -- `src/modules/tickets/MyTicketsPage.tsx`
- A QR renderer: `package.json` has `jsqr` (a scanner) only. The door scanner accepts a bare 64-hex token or a URL carrying it (`p3/door/model.ts:153` `parseCode`), so encode the bare `qr_token`. -- `src/modules/tickets/qr.ts`
- A route, a catch-all entry and a breadcrumb for it. -- `src/components/AnimatedRoutes.tsx`

## Files
- NEW `src/modules/tickets/MyTicketsPage.tsx`, `myTicketsModel.ts` (pure: group Upcoming / Past, date and time words, state), `myTicketsApi.ts` (one RPC wrapper, parse defensively), `qr.ts`, tests under `src/modules/tickets/__tests__/`.
- EDIT `src/components/AnimatedRoutes.tsx` (route `/account/my-tickets`, lazy, signed-in guard like `/account/attendance` at line 225, mounted only while `flags.publicTicketing`; else `<Navigate to="/" replace />`), `src/components/catchallClientPaths.ts` (add the path, with the flag comment style of line 43), `src/lib/breadcrumbs/siteIa.ts` (route id; every GlobalLayout page passes `buildBreadcrumbs`).
- QR generator: add ONE small pinned dependency (e.g. `qrcode-generator`) imported ONLY inside the lazy page chunk. Do not touch `vite.config.ts` manual chunks unless a budget fails; if `perf-budgets.json` or the request-count pin goes red, stop and report PARTIAL (owner call).
- Do NOT edit: calendar density-exempt files (CLAUDE.md), `src/lib/featureFlags.ts` (use the existing `publicTicketing`).

## Rules
- No migration, no prod write. Flag `publicTicketing` (OFF on prod): flag-off must render nothing new and add zero first-load bytes (see `src/modules/tickets/__tests__/flagOff.test.ts` for the pattern; extend it).
- HTML entities for punctuation in JSX; explicit px tap targets (44px min); COMPACT density (`.claude/rules/design-density.md`).
- Never show a QR for a `checked_in` ticket as if usable: show "Checked in at <time>" and keep the QR collapsed behind "Show anyway".
- The token is a secret: never log it, never put it in a URL, never send it to analytics.

## Tests red first
Write the matrix test first and run it against main (it fails: no page). Table: shape x screen state.
Shapes (survey prod counts first, SELECT only; do not read personal data): 0 tickets; 1 ticket upcoming; several in one order; past + upcoming mix; checked_in true; `occurrence_date` null (series-wide type); `truncated` true with `total_count` 600; signed out (RPC 42501); RPC error; slow. Each state names what the person can do (empty state: "Find an event"; error: Try again; signed out: sign in link). A control that cannot work is disabled with a reason.

## Phone QA
Sizes: 390x844 and 320x568. Shapes to walk with mocked RPC at prod shapes: empty, 1 upcoming, mixed past/upcoming, checked-in, truncated, signed out, error. Check QR is scannable by the real door parser (`jsqr` round trip in a vitest: render QR to canvas data, decode, `parseCode` returns the token).

## Done
Handover `docs/handovers/my-tickets-screen.md` (what is built, flag, Not verified: a real camera scan at the door, a real purchase). PR body per the two checker scripts. Model/lane: Opus, high.
