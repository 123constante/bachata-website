# Handover: buyer onboarding slice A (Website, branch claude/onboard-a)

Brief: `brief/onboard-a:docs/briefs/onboard-a-slice-a.md`. Flag: `VITE_ENABLE_BUYER_ONBOARDING` (`src/lib/buyerOnboardingFlag.ts`), OFF by default. Rollback = flag off.

## Done
- Item 2: `fetchMyDancerEdit` (api/rpc.ts) on `no_profile` with the flag ON calls `ensure_my_dancer_profile_v1` once, then reads again. Every reader (shell on sign-in, onboarding, Me, Options) goes through it. If the create fails (rate_limited / not_signed_in / offline) the original `no_profile` stands, so the existing "Message us" card is the fallback and the next visit retries. Never touches sign-in or payment. RPC name cast via rpcLoose (types.ts untouched).
- Item 3: no new strings; the RPC's `not_signed_in` / `rate_limited` / permission-denied / network paths map through `codeFromMessage` to the existing COPY list. Table test: `src/modules/dancer-app/__tests__/ensureProfile.matrix.test.ts` (7 shapes + 5 error paths). Fake backend gained `ensureMyDancerProfile` (5/day limit like the server).
- Item 5: `TicketPickerB1.tsx` shows "Tickets go to {email}. Not you?" above Continue for a signed-in buyer (flag ON). Not you? = `signOut()` (this device), basket kept (storage), email + code card opens empty. Test: `src/modules/tickets/__tests__/pickerNotYou.test.tsx`.

## Left / next steps
- Item 4 (checkout return lands on teaser Home with the QR): NOT built. `TicketThanksPage` still redirects a signed-in buyer to `/app/tickets?o=`, which polls the order. Teaser Home (`TeaserScreens.tsx` TeaserHome) reads tickets via `useTicketCard()` and has no `?o=` polling, so a straight redirect would show no QR until the webhook lands. Next: behind the flag, redirect to `/app/home?o=` and give TeaserHome the same order poll the Tickets tab uses (or show the Tickets-tab order block on Home while pending).
- Owner clicks not yet built: passed/cancelled/refunded ticket card states, "Your ticket is under another email" note, daily funnel status line.
- 390x844 browser walk with the flag ON and a signed-in no-profile account (none done here).
