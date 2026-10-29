# Brief: ticket promo codes, Website half (BUILD-visual, careful lane)

Admin PR #1125 (DB + edge) is applied and `ticket-checkout` redeployed BEFORE this runs. Read its handover first: `git fetch origin claude/ticket-promo-codes-db` (admin repo, ask the orchestrator for the text if you cannot reach it). RPCs: `ticket_promo_preview_v1(p_series,p_ticket_type,p_quantity,p_code)` (anon), `ticket_promo_create_v1`, `ticket_promo_update_v1`, `ticket_promo_list_v1` (authenticated). `ticket-checkout` accepts optional `promo_code`; refusals are HTTP 409 `{ok:false,reason}`; free = `{ok:true,order_id,free:true}`.

## Owner decisions (2026-10-29, binding)
- Percent AND fixed amount off. Percent rounds DOWN per ticket. Fixed is pounds off EACH ticket, never below 0; zero total = free order.
- Limits: max uses (counts ORDERS) and expiry date. Code applies to every ticket of that organiser in the order.
- A code for a different event answers "That code isn't valid for this event." Keep the code hint in the field.
- Specific buyer reasons: unknown_code, inactive, expired, used_up, not_for_this_event, no_discount, below_minimum (under 30p), rate_limited. Copy table is in the admin handover; British English, no jargon.
- A `?code=` link pre-fills the code field on the event ticket panel.

## Build
1. Organiser: on the P3 Tickets screen a "Promo codes" section: list (code, discount, used x of max, expiry, active), create sheet (code, percent or fixed, max uses, expiry), turn off/on, edit rules until first use (then locked: say why). Behind `flags.organiserTicketing`. Only owner/manager see it (server decides; do not copy permission logic).
2. Buyer: "Promo code" field on the ticket checkout panel: Apply calls preview, shows new total with the saving; invalid shows the specific reason; checkout sends `promo_code`; free result goes to the free-order end state.
3. `?code=` pre-fill.

## State table (REQUIRED in the PR body and tests, table-driven, one shared mapping)
Screen x state: buyer (no code, valid percent, valid fixed, free result, each refusal reason, rate_limited, offline, slow/double-tap) and organiser (empty list, 1 code, many codes, used/locked, expired, used up, create errors: code_taken invalid_code invalid_value invalid_max_uses invalid_expiry not_authorised). Every state names what the person CAN do next; every disabled control says why; untouched save sends nothing.

## Checks
Real-data shapes read read-only on prod (counts only). Walk 390x844 AND 320x568 dark+light. Design record docs/design/<pr>.md. Every applicable CI step run (on the Dell: `node ~/.claude/bin/dell-run.mjs website <sha> -- <cmd>`). Flags stay as they are; nothing turned on.

## Output
Handover docs/handovers/ticket-promo-codes-web.md with Verified / Not verified. One push at the end, subject ending `[worker-done <ticket>]`. Opus, careful lane, context under 30%.
