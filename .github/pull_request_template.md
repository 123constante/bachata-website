## Summary
- What changed?
- Why was it needed?
- Any notable implementation decisions?

## Scope
- [ ] Changes only touch dancer public profile contract/template and required supporting paths.
- [ ] No unrelated redesign or unrelated feature additions.

## Supabase Source of Truth
- [ ] Public profile reads from Supabase-backed canonical mapper (no dashboard-local fallback rendering logic).
- [ ] Dashboard remains authoring surface only; persisted values drive public output.

## Privacy Gates (Hard Requirement)
- [ ] No public rendering of `phone` or `whatsapp`.
- [ ] No public query/select includes `phone` or `whatsapp` for dancer directory/detail render paths.
- [ ] Contact section exposes only approved public channels (`instagram`, `facebook`, `website`).

## Visibility & Access
- [ ] `is_public` behavior is consistent for directory and detail routes.
- [ ] Non-public fallback states do not leak private contact fields.

## UX & System Consistency
- [ ] Layout follows existing dark theme + spacing rhythm + interaction patterns.
- [ ] Mobile-first readability and CTA hierarchy verified.
- [ ] Section rendering uses registry/canonical data path (no duplicated ad-hoc logic).

## Validation Evidence
- [ ] Grep checks attached (`phone|whatsapp`, `select\(.*phone|select\(.*whatsapp`, `tel:|wa\.me`).
- [ ] Build/lint status attached for touched files.
- [ ] Manual QA notes attached for must-fail/must-pass examples.

## QA Examples (Must Fail / Must Pass)
### Must fail examples
- Public profile page contains a `tel:` link, a `wa.me` link, or any visible label/button containing “phone” or “whatsapp”.
- Public dancer query selects `phone` or `whatsapp` in directory/detail rendering path.

### Must pass examples
- Public profile contact area only shows allowed channels (`instagram`, `facebook`, `website`) when present.
- Dashboard/private editing views can still store/update `whatsapp` without leaking it to public routes.
- Non-public dancer remains excluded from directory and does not expose private contact fields via detail route fallback states.

## Reviewer Sign-off
- [ ] Explicit reviewer approval recorded: “No public phone/whatsapp exposure.”

## Verified on real data
- Shapes surveyed (read-only, counts):
- Checks run (matrix tests, every CI job step, browser walk at 390x844):
- NOT verified (be honest):

## Phone QA
<!-- Required when the PR changes a UI path (scripts/check-pr-phone-qa.mjs UI_PATH_RE; phone-qa-section.yml). Otherwise write "N/A: no UI change".
     Sizes checked needs a WxH such as 390x844 and 360x640; Walked = pages and flows, phone suite and/or browser walk; Not verified = be honest. -->
- Sizes checked:
- Walked:
- Not verified:
