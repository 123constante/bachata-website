# Handover: S4 buyer checkout (Website)

Branch `claude/ticketing-checkout` (from main 143f9cc). Brief: branch
`brief/ticketing-checkout`, `briefs/ticketing-checkout.md`. Journey map, contract and
shape survey: [`docs/ticketing-buyer-journey.md`](../ticketing-buyer-journey.md).

## Review-fix round (2026-10-27, dispatch `dt_e144546657d5`)

Brief `brief/ticketing-checkout` `briefs/ticketing-checkout-fixes.md`; review
`claude/ticketing-checkout-review` `docs/review/ticketing-checkout-1063.md`. Per finding:
[`docs/design/1063.md`](../design/1063.md). **These fixes are unreviewed code** (no
`/code-review` round ran on them in this session).

Fixed: 2 (no "Payment received" heading without an order id), 3 (20 s timeout on both sends,
lands as `network`), 4 (preview-origin reason before any field), 5 (real `<form>`, Buy is
submit, Return works), 6 (rate-limit copy names the 30-minute hold), 7 + 11 (`?o=` must match
the function's UUID regex, else stored id or no order; `free=1` only believed with a valid
`?o=`), 8 (`invalid_quantity` / `invalid_email` -> fix_form), nits 9 (cancel return clears the
stored order id), 10 (redirect only to `https://checkout.stripe.com/`), 12 (`/privacy` is a
`<Link>`; the draft privacy sentence lost "at /privacy"), 17 (`useRef` double-submit guard).

Red first: `src/modules/tickets/__tests__/reviewFixes.test.tsx` ran against unfixed 52b2d15:
18 of 21 failed (the 3 passing were already-true guards, see the design record). After the
fixes the tickets suite is 220/220.

### Left to orchestrator (not changed, per the brief)

- **1 (DB / config):** the server's booking fee is env-driven (`TICKET_BOOKING_FEE_PENCE`,
  default 50); the client pins 50p in `ticketCheckoutModel.ts`, `TicketsBlock.tsx` and
  `legalCopy.ts`. Either keep that env unset / 50 (record it in the admin repo) or return
  `booking_fee_pence` from `ticket_types_public_v1` and render it.
- **13:** `/tickets/thanks` answers 200 + client NotFound while the flag is off (soft 404,
  S3 precedent).
- **14:** the DRAFT legal copy is in the built `TicketsBlock-*.js` chunk on the CDN while the
  flag is off (never requested or rendered).
- **15:** "not yet" / "closed" use the phone's clock; the server is the authority.
- **16:** after a refusal focus stays on the disabled Buy.
- **18:** the thanks route is not wrapped in `PageTransition` (`flagOff.test.ts` pins it).
- Server design point from finding 6: a cancelled Stripe session holds its tickets (and the
  buyer's rate allowance) for 32 minutes; consider closing the pending order on `cancel_url`.

### Fix-round checks (local, head of this round)

- `npx tsc --noEmit`: clean. `npx eslint src/modules/tickets`: clean.
- `npm run lint`: 21 of 22 links green; `check:integrity` exit 126 because
  `bin/check-integrity.sh` is mode 100644 in git (same on main; CI `chmod +x`es it first).
  Run with `bash`: ok, 0 issues.
- architecture-guard steps (integrity, legacy-tables, legacy-program-rpcs, lint:architecture,
  `AUDIT_STRICT=1 check:images`, image-widths, plan-hygiene, workflow-artifact-policy, mojibake,
  prove:entry-point), typecheck steps (rpc-typing, wallclock-brand), perf-budget steps (three
  self-tests, build, bundle-budget, first-load-requests, chunk-cycles): all exit 0.
- `test:unit:offline`: 15350 pass, 5 fail, all in `tests/integrityCouldNotRun.test.ts`, the same
  5 fail on origin/main (sandbox quirk). `test:unit:timing`: pass.
- `test:e2e`: 151 pass, 6 fail (account-settings, auth-magic-link-returnto, dancer-home,
  organiser-onboarding; none touch tickets, flag off). Those 4 specs re-run alone: 36/36 pass,
  so load timeouts in the full run.
- Not runnable here: `check-ci-budget` (needs `CI_BUDGET_GITHUB_TOKEN`), `check:doc-weight`
  (needs `GITHUB_REPOSITORY`; skips `claude/*` in CI anyway), lighthouse / og / seo / synthetic
  (skip `claude/*`), db-contract-check (no DB-facing path changed).
- Browser walk 390x844 (vite dev, flag on): `/tickets/thanks` bare -> "Thanks for your order";
  `?o=hello&free=1` -> "Thanks for your order", no reference, not the free copy; `?o=<uuid>` ->
  "Payment received..." with the reference; `?o=<uuid>&free=1` -> free copy. No sideways scroll.
  **Not walked:** the Tickets block itself: the sandbox browser could not load prod event data,
  so the event page showed Not found. The block's fixes (4, 5, 9, 12, 17) are covered by jsdom
  tests only.

## Done (S4 build, before the review)

- New flag `publicTicketing` (`VITE_ENABLE_PUBLIC_TICKETING === 'true'`), OFF by default,
  copied from the `organiserTicketing` mechanism (own entry, no dependency on S3). Flag off:
  no Tickets block (BentoPage's lazy import never fires) and no `/tickets/thanks` route.
  `src/modules/tickets/__tests__/flagOff.test.ts` pins it.
- `src/modules/tickets/`:
  - `ticketCheckoutModel.ts`: the ONE mapping: row availability (on sale / N left / sold
    out / not open yet / closed), stepper cap min(20, remaining), totals (subtotal, "+ 50p
    booking fee per ticket", total; free = no fee), Buy disabled reasons, request body,
    reply parser, plain-English copy + way forward for every server reason, thank-you copy.
  - `ticketCheckoutApi.ts`: `ticket_types_public_v1` read; `ticket-checkout` POST via fetch
    (anon key or session token; a gateway 401 on a stale token retries once as a guest).
  - `orderStorage.ts`: order-id hand-off across the Stripe redirect (success_url is passed
    to Stripe verbatim, so the id rides sessionStorage and the thank-you page moves it into
    `?o=`).
  - `TicketsBlock.tsx` (under the bento grid on a bookable night; hidden when past,
    cancelled, paused or ended; per-occurrence types only on their own night),
    `TicketThanksPage.tsx` (`/tickets/thanks?o=`), cancel state on the event page
    (`?tickets=cancelled`, stripped from the URL once read).
  - `legalCopy.ts`: DRAFT terms of sale + privacy paragraph. **Needs owner approval by click
    before the flag goes on anywhere real.**
- Contract read from the DEPLOYED `ticket-checkout` source (v3), not assumed.
- Code review: round 1 (high) 10 findings, 8 fixed, 2 answered (DB-side id note; catchall
  200 while the flag is off follows the S3 `/account/tickets/*` precedent). Round 2
  (medium) 9 findings, all fixed. The round-2 fixes are themselves unreviewed.

## Notes for the orchestrator (DB / admin side, not files here)

1. **`ticket_types_public_v1` must accept the public event id.** It is keyed on
   `event_series_p5.id`; the event page only has `COALESCE(legacy_event_id, id)` and
   `event_view_p5` does not return the series uuid. 59 of 69 live series differ, so the
   block stays hidden on them until the RPC also matches `public_event_id`.
2. Series-wide ticket types on a weekly series carry no date: an order is not tied to the
   night the buyer was looking at. Decide whether series-wide types are "any night" or
   should be per-occurrence only.
3. `TICKET_PREVIEW_ORIGIN` is unset, so previews show Buy disabled with "Checkout only works
   on bachatacalendar.co.uk". Not worked around, per the brief.

## Left / next steps

- Owner approves `legalCopy.ts` wording (PR body lists it).
- Fix note 1 on the DB side, then flip the flag on a preview for a phone test (checkout
  itself can only complete on the production origin).
- A link from the footer/terms page to the full terms of sale, if the owner wants one.

## Verified / Not verified

See the PR body for the per-job CI table. Summary:

Verified:
- Shape survey on prod (read-only, counts): 0 ticket_types / orders / stripe accounts;
  series lifecycle live 69, ended 21, paused 2, draft 4, archived 653; public id differs
  for 59 live series. RPC and edge-function source read live.
- Unit: tickets suite 193 tests (model matrix every status x window x free/paid x
  remaining; screen matrix every row state x free/paid, stepper caps, every disabled
  reason, every error reason x organiser known/unknown, cancel, thank-you, per-night).
- Browser walk at 390x844 against a local dev server (flag on, real prod event data, ticket
  RPC and checkout faked): block, capped form (7 left -> qty 7, total 91.00), sold_out
  error, cancelled state, thank-you, preview-origin disabled reason. No horizontal scroll,
  no tap target under 44px in the block.

Not verified:
- A real checkout (Stripe test mode) or a real free order: prod has no ticket types, and
  only the production origin may complete checkout.
- The webhook-issued email arriving.
- Desktop widths.

## PR and CI

PR #1063 (opened by the dispatcher; this worker filled the body). On head f1375f3 every
GitHub job was green or skipped by design (lighthouse / doc-weight / og / seo / synthetic
skip `claude/*`), except `real-data-verified` and `phone-qa-section`, which failed on the
empty body and re-ran after the body was filled (both pass locally on that body). Local
run of every job step: no failure caused by the branch (15 full-unit failures are the same
on origin/main: live-DB tests without a secret, integrityCouldNotRun sandbox quirk).
Vercel cap could not be checked: the sandbox proxy refuses api.vercel.com (403) even with
VERCEL_TOKEN set.

Local e2e / phone runs regenerate tracked review-pack PNGs as a side effect: never
`git add -A` after them (one such commit was reverted in 40435d3).
