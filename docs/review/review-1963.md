# Review of PR #1963 (head 21eda4401)
## Verdict: PASS WITH NITS

Read the diff only; no build or test run. No blocking findings.

## Checked, OK
- Flag off: `PARTY_CHAT_ENABLED()` gates the render; the card is a `lazyWithRetry` chunk, so it is not mounted or fetched. Queries and `useMyDancerEdit` live inside the card, so zero RPC calls. Test asserts no `/party/` calls.
- RPCs match the brief: `get_party_card_v1` (no args); `register_party_interest_v1` with `{ p_city_id, p_party_date: null }`. Cities query: `cities` `select('id, name').eq('is_active', true).order('name')`; `is_active` exists in types.ts. Profile city `based_city_id`/`city_name` exist in dancer-app api.
- Join is one tap, final: no confirm, no undo copy, no Leave. Buttons disabled while busy.
- `not_today` is treated as success and refetches the card, as the brief says. Other failures show "Couldn't join. Try again." inside the card.
- States: none/in/open copy matches the brief. closed, loading, error and signed-out render null. `in` is a violet card with no button and no count.
- Taps: every button uses `min-h-[44px]`. No secrets. Nights change is 1 import, 1 lazy const, 1 gated block above the loading/error/list, so existing behaviour is untouched. The flag is read at render and defaults off.

## Nits (non-blocking)
1. `open` with null `chat_id` renders a disabled "Open chat": a dead control. Prefer hiding the card or the button. The handover already lists this.
2. `in` shows "You're in" without the city until the cities query resolves (flash). The handover lists this. Fallback to the profile city only applies when ids match.
3. `fetchActiveCities` returns `[]` on error, so "Other city" can open an empty list with no message or way back. Add an empty/error line, or a Back control.
4. "Other city" has no way to close the list once opened (no Back or Cancel).
5. `open` navigates to `/account/party-chat/<id>`, which may 404 until S2. This is acceptable behind the flag but must not ship the flag on before S2.
6. The handover .md sits inside `src/.../nights/`; docs normally live under `docs/`. Also, `fetchPartyCard` has no try/catch, though react-query turns a throw into "no card", so the outcome is fine.
7. The tests do not cover the `open` state with a null `chat_id`, a `not_today` result, or the `in` state when cities fail. The handover admits there is no 390x844 walk and no real-data check: required before the flag goes on.
8. `PartyCard` type: the two union arms are identical, so the union is redundant. Cosmetic.
