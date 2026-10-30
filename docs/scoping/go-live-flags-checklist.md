# Go-live flags checklist: organiserP3, organiserTicketing, publicTicketing (T11)

Scoping only, 2026-10-30. No source edited, no Vercel or database change made. Sources read:
`src/lib/featureFlags.ts` (main a1d0fa6), `docs/handovers/p3-golive-wiring.md`,
`docs/handover/ticketing-checkout.md`, `docs/handovers/ticket-fee-zero-web.md`,
`docs/handovers/ticket-qr-door-screen.md`, and items T4 / T5 / T11 of
`docs/scoping/ticket-followups-2026-10-30.md` (branch `claude/scope-ticket-followups`, cited
below as `followups.md`). Every flag call site was found with a grep of `src/` on main.

## How every flag works (applies to all three)

- Each flag is `import.meta.env.VITE_ENABLE_... === 'true'` (`src/lib/featureFlags.ts:67,71,75`).
  Only the exact string `true` turns it on; unset or anything else is off.
- The value is baked in **at build time**; Vercel production env vars override the
  `.env.production` fallback (`featureFlags.ts:6-9`). So a change in Vercel does nothing until a
  **new production build/deploy** runs. Rollback is the same: set the var back (or delete it) and
  redeploy.
- Each flag's own comment says "Vercel env -- no code change" (`featureFlags.ts:66,70,74`).
- Two of the three also need `organiserSelfServe` (`VITE_ENABLE_ORGANISER_SELF_SERVE`), whose comment
  says it is "OFF in production until launch" (`featureFlags.ts:59-62`):
  - `/account/p3/*` exists only if `flags.organiserP3 && flags.organiserSelfServe`
    (`src/components/AnimatedRoutes.tsx:266-268`).
  - `/account/tickets/*` exists only if `flags.organiserTicketing && flags.organiserSelfServe`
    (`AnimatedRoutes.tsx:271-273`).
  - `publicTicketing` does NOT depend on self-serve (`AnimatedRoutes.tsx:235-237`,
    `src/modules/event-page/bento/BentoPage.tsx:760`; `ticketing-checkout.md:69-71` "no dependency on S3").

| Flag | Vercel env var | Where it is read |
|---|---|---|
| `organiserP3` | `VITE_ENABLE_ORGANISER_P3` | `featureFlags.ts:67`; route `AnimatedRoutes.tsx:266`; `/account/continue` `AnimatedRoutes.tsx:224`; new-organiser landing after sign-in `src/pages/AuthCallback.tsx:318` + `src/lib/auth-otp-routing.ts:173,186`; accepted-invite landing `src/modules/organiser/p3/shell/paths.ts:51-52` |
| `organiserTicketing` | `VITE_ENABLE_ORGANISER_TICKETING` | `featureFlags.ts:71`; route `/account/tickets/*` `AnimatedRoutes.tsx:271`; INSIDE P3: door scanner route `src/modules/organiser/p3/shell/P3Routes.tsx:51`, Get paid row + route `src/modules/organiser/p3/shell/youTickets.tsx:11,15`, Home prompt + sold tile `src/modules/organiser/p3/screens/HomeScreen.tsx:111,152`, event page Tickets entry + "Scan tickets" `src/modules/organiser/p3/screens/EventPage.tsx:221-222` |
| `publicTicketing` | `VITE_ENABLE_PUBLIC_TICKETING` | `featureFlags.ts:75`; Tickets block on `/event/:id` `BentoPage.tsx:760` (lazy chunk `BentoPage.tsx:106`); `/tickets/thanks` route `AnimatedRoutes.tsx:235-237` |
| (prereq) `organiserSelfServe` | `VITE_ENABLE_ORGANISER_SELF_SERVE` | `featureFlags.ts:62`; gates both organiser routes above |
| (prereq) `organiserDetail` | `VITE_ENABLE_ORGANISER_DETAIL` | `featureFlags.ts:15`; decides P3 Live "View / Share" (`p3-golive-wiring.md:33,56`) |

## Step 0: what must be true and verified before ANY flip

1. **Booking fee secret is 0 on the server (T5).** The website shows no fee (`BOOKING_FEE_PENCE = 0`,
   `ticket-fee-zero-web.md:8-10`), but the `ticket-checkout` edge function secret
   `TICKET_BOOKING_FEE_PENCE` defaults to 50: "unset means 50 today" (`ticket-fee-zero-web.md:9-10`).
   If it is not 0, "Stripe would charge 50p more per ticket" than the page shows
   (`ticket-fee-zero-web.md:36-38`). Whether it was flipped is not verified (`followups.md:69-73`).
   Owner sets it in the admin/Supabase edge-function secrets; Claude cannot read secrets.
2. **Phone walk on a preview (T4).** Real camera scan and a real Stripe checkout + issued email are NOT
   verified (`followups.md:60-64`; `ticket-qr-door-screen.md:57-58`; `ticketing-checkout.md:129-132`).
   It needs the edge-function secret `TICKET_PREVIEW_ORIGIN`; while unset, previews show Buy disabled
   with "Checkout only works on bachatacalendar.co.uk" (`ticketing-checkout.md:103-104`), and checkout
   itself only completes on the production origin (`ticketing-checkout.md:109-110`). The preview
   build must carry the three flags = `true` (Preview env in Vercel) for the walk.
3. **`organiserSelfServe` value in Production is known.** Both organiser flags do nothing without it
   (`AnimatedRoutes.tsx:266,271`). If it is off, turning it on is its own launch (it also exposes
   `/account/o/*`, `/account/new`, etc., `AnimatedRoutes.tsx:241-262`).
4. **`organiserDetail` value in Production is confirmed** before P3 goes on
   (`p3-golive-wiring.md:56`). With it off, Live's "View" opens the P3 You page and "Share" is hidden
   (`p3-golive-wiring.md:33-34`). A code comment says it is true in prod as of 2026-09-01
   (`middleware.ts:53-55`); not re-checked against Vercel.
5. **Legal copy approved.** `src/modules/tickets/legalCopy.ts:2-6` records owner approval 2026-10-27
   and the fee-removal wording confirmed 2026-10-29 (closed per `followups.md:23`).
6. **Main is green and the deploy is current** (standard; not a flag-specific file fact).

## The ordered sequence

### 1. `organiserP3` = `true` (with `organiserSelfServe` already `true`)

- Why first: the organiser-ticketing surfaces that matter for the door and getting paid live INSIDE
  P3 (`P3Routes.tsx:51`, `youTickets.tsx:11,15`, `HomeScreen.tsx:111,152`, `EventPage.tsx:221-222`).
  They render only when P3 is mounted.
- Effect: `/account/p3/*` exists; a brand-new organiser lands on P3 Welcome after sign-in
  (`auth-otp-routing.ts:173,186`); an accepted invite lands on P3 Welcome (`paths.ts:47-52`);
  Go live calls the real `complete_organiser_onboarding_v1` (`p3-golive-wiring.md:26-28`).
- Check it worked: `/account/p3` renders the P3 Home (not NotFound; while off the client renders
  NotFound, `src/components/catchallClientPaths.ts:50`). Owner phone test "with both flags on" is the
  named next step (`p3-golive-wiring.md:64`). A real Go live has never been run
  (`p3-golive-wiring.md:74`).
- Rollback: set `VITE_ENABLE_ORGANISER_P3` to `false` or delete it, redeploy. `/account/p3/*` becomes
  NotFound (`catchallClientPaths.ts:50`), landings fall back to R1's Welcome (`paths.ts:51-52`).
  Pages already put live stay live (the RPC changed the DB lifecycle; the flag does not undo it,
  `p3-golive-wiring.md:8-19`).

### 2. `organiserTicketing` = `true`

- Prereq: Step 0 items 1-2 done; Stripe Connect onboarding available. The scoping read says
  `stripe-connect-onboard` is ACTIVE on prod (`followups.md:10-11`); an older journey doc says
  "NOT deployed yet" (`docs/organiser-ticketing-journey.md:19`) -- the newer prod read wins, but
  re-check.
- Effect: `/account/tickets/*` (Get paid, ticket types, sales, refunds; `featureFlags.ts:68-71`) and,
  in P3, Get paid row, Home prompt + Tickets sold tile, event Tickets entry, "Scan tickets" door
  screen at `/account/p3/events/:seriesId/door`.
- Check it worked: `/account/tickets` renders (not NotFound, `catchallClientPaths.ts:51`); in P3 Home
  the Get paid prompt shows; an event page shows "Scan tickets" (`data-testid="p3-open-door"`,
  `EventPage.tsx:223`).
- Rollback: var to `false`/delete, redeploy. All the above disappear; existing ticket types, orders
  and Stripe accounts in the DB are untouched (the flag only gates routes/components). Door
  check-in becomes unreachable on the night -- do not roll back during an event with sold tickets.

### 3. `publicTicketing` = `true` (last)

- Prereq: Step 0 items 1-2 (money), step 2 done so organisers can manage what buyers buy.
- Effect: the Tickets block on a bookable night of `/event/:id` (not past, cancelled or paused,
  `BentoPage.tsx:758-760`) and the `/tickets/thanks` return page. The block "renders nothing until
  the series has a type on sale" (`BentoPage.tsx:758-759`). Prod has 2 `ticket_types`, 4 orders
  (`followups.md:9`): **those events show a Buy block the moment this deploy lands.**
- Check it worked: an event with a ticket type on sale shows the block; `/tickets/thanks` renders
  "Thanks for your order" (`ticketing-checkout.md:60-62`); one real low-value purchase on the
  production origin and the email arriving (never verified so far, `ticketing-checkout.md:129-132`);
  the Stripe charge equals the page total (proves T5).
- Rollback: var to `false`/delete, redeploy. The block and `/tickets/thanks` vanish
  (`AnimatedRoutes.tsx:234-237`); a buyer mid-checkout returning from Stripe gets the client NotFound
  (`catchallClientPaths.ts:43`, `ticketing-checkout.md:32-33`), though their order is still
  processed server-side. Paid orders remain; refunds go through the organiser side (step 2's flag).

## What breaks if the order is wrong

| Wrong move | What happens (source) |
|---|---|
| Any public flip before `TICKET_BOOKING_FEE_PENCE` = 0 | Buyer is charged 50p/ticket more than the page total (`ticket-fee-zero-web.md:36-38`) |
| `organiserTicketing` on, `organiserP3` off | Only the old `/account/tickets/*` area works; the door scanner, Get paid row, Home prompt and event Tickets entry are unreachable (they are inside P3: `P3Routes.tsx:51`, `youTickets.tsx`, `HomeScreen.tsx:111,152`, `EventPage.tsx:221-222`). T6 plans to retire the old screens (`followups.md` T6). |
| Either organiser flag on, `organiserSelfServe` off | No route at all; flag has no effect (`AnimatedRoutes.tsx:266,271`) |
| `publicTicketing` before `organiserTicketing` | Buyers can buy on the 2 existing ticket types (`followups.md:9`) while organisers have no Sales/Refunds screen and no door scanner to check them in |
| `organiserP3` on with `organiserDetail` off | Live's View goes to the P3 You page and Share is hidden instead of the public page (`p3-golive-wiring.md:33-34`) |
| Rolling back `publicTicketing` while checkouts are open | Returning buyers land on NotFound (`catchallClientPaths.ts:43`) |
| Flipping in Vercel without a redeploy | Nothing changes: values are build-time (`featureFlags.ts:6-9`) |

## Owner-only vs what Claude can do

| Step | Owner only | Claude can do |
|---|---|---|
| Set `TICKET_BOOKING_FEE_PENCE` = 0 on `ticket-checkout` (T5) | Yes (secrets; Claude cannot read them, `followups.md:72`) | Nothing besides reminding; cannot verify |
| Set `TICKET_PREVIEW_ORIGIN` for the preview walk (T4) | Yes (edge-function secret) | -- |
| Set Vercel Preview env flags for the walk | Yes (Vercel dashboard) | -- (sandbox proxy refuses api.vercel.com, `ticketing-checkout.md:143-144`) |
| Real phone walk: camera scan, Stripe checkout, email | Yes (needs a phone, card, inbox) | Write the walk script / check list; read-only SELECTs on prod to confirm the order and tickets rows afterwards |
| Confirm Production values of `organiserSelfServe`, `organiserDetail` | Yes (Vercel) | Read code to say what each value does (this doc) |
| Flip `VITE_ENABLE_ORGANISER_P3` / `_ORGANISER_TICKETING` / `_PUBLIC_TICKETING` in Production + redeploy | Yes | -- |
| Check each flip worked in the browser | Yes on a phone (final) | Playwright walk against the production URL (read-only pages: `/account/p3`, `/account/tickets` sign-in gate, `/event/:id` block, `/tickets/thanks`) |
| Real Go live, real purchase | Yes (Claude never calls Go live, `p3-golive-wiring.md:74`) | -- |
| Rollback (unset + redeploy) | Yes | Say which var, and what the user sees after (this doc) |
| Re-check DB facts (`ticket_types` count, edge functions ACTIVE) | -- | Yes, read-only SELECT / list on `stsdtacfauprzrdebmzg` |

## Not found / Not verified

- **Not verified:** the current Vercel Production (and Preview) values of all five vars; no file in
  the repo records them, and Vercel was not reachable. `followups.md:129-130` says prod has the two
  ticketing flags off -- not re-checked here.
- **Not verified:** whether `TICKET_BOOKING_FEE_PENCE` is 0 and whether `TICKET_PREVIEW_ORIGIN` is set.
- **Not verified:** `organiserSelfServe` is on in Production. Only the code comment "OFF in production
  until launch" was found (`featureFlags.ts:59-61`), which may be stale.
- **Not verified:** `organiserDetail` = true in Production beyond the 2026-09-01 code comment
  (`middleware.ts:53-55`).
- **Not found:** any `.env.production` or `.env.development` in the repo (only `.env.example`, which
  does not list the three flags, `.env.example:34-43`).
- **Not found:** a documented Vercel "instant rollback" procedure for flags in the files read; the
  rollback above is set-and-redeploy only.
- **Not verified:** that the 2 existing prod ticket types are on sale on a bookable night (they would
  show the block on flip); counts only, from `followups.md:9`.
- No prod query was run for this doc; all DB facts are quoted from `followups.md`.
