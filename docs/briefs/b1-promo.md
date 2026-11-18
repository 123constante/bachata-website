# Build: B1 ticket picker promo box (BUILD-visual, normal lane)

Repo: bachata-website. Branch claude/b1-promo from main. One PR. Flag stays as is: ticketPickerB1 (VITE_ENABLE_TICKET_PICKER_B1) remains OFF in prod; do not touch Vercel env.

Owner pick (DESIGN-REGISTRY "Ticket picker page", 2026-11-17 "i like it"), promo part: always-open promo box. Valid code = ticket-stub row showing the code + the minus amount + Remove; keyboard closes; a "Checking" state while validating; old total shown crossed out beside the new total; one buzz (haptic) on success. Invalid code = red text + double buzz. Text only, white, no symbols.

Problem: src/modules/tickets/TicketPickerB1.tsx:203-209 is a stub: every code returns "Promo codes are not available yet." The classic checkout page already has working promo validation (same page, Apply button) and prod has ticket_promo_codes + promo RPCs. REUSE the classic page's validation call and the way the code is passed to ticket-checkout; do not invent a new RPC. Find them first (grep promo in src/modules/tickets). If the classic path needs a server change, STOP and write it under "NEEDS ADMIN" in the handover; do not add migrations (schema authority is the admin repo).

Do: wire real validation into B1 per the pick above; the discounted total must flow into the bar total and into the checkout payload exactly as the classic page does; free-after-discount orders follow the existing free path. Add unit tests (valid, invalid, remove, discount applied to total, code re-validated when quantities change). Run npx vitest run src/modules/tickets and npx tsc --noEmit -p .; npm run check:mojibake. Use HTML entity escapes for punctuation in JSX (no raw Unicode punctuation). Phone html font is ~13.5px: explicit px for tap targets (>=44px).
Phone QA: 390x844 screenshots in the PR of: empty, valid code, invalid code. If you cannot run a browser, say so under Not verified.
Handover: docs/handover/b1-promo.md (done / left / NEEDS ADMIN). Do NOT merge or approve. Do not flip any flag.
