# Handover: account-link walk (dt_9dacf9c20f50)

Walk was STATIC + unit-level, not a live 390x844 browser walk (see Not verified).

## Measured (from CSS/tokens)
- Taps under 44px: 0. `.dt-quiet-link` 44x44 min, `.dt-icon-btn` 44x44, code boxes 54px high, input 46px, `.dt-btn` full width.
- Contrast: muted text 5.84 on sheet; error red #ff6b6b 4.98 on sheet; white on inputs 11.97. Disabled quiet links 3.35 (disabled = exempt).
- Sideways scroll: none expected (email wraps with `overflow-wrap:anywhere`; boxes are flex-1 min-w-0). Not measured live.
- Copy: every refusal has a way forward; "Send a new code" / "Change email" exist on screen; British English; no pointer at a missing control.

## Fixed (1 file + 1 test)
- Email field: `aria-invalid` + `aria-describedby` to the error, `autoCapitalize="none"`, `spellCheck={false}`.

## Parked
- Code step does not repeat which email was used (SENT_LINE is deliberately neutral).
- `needsNew` "Send a new code" returns to the email step; user must press Send again.
- Initial list failure other than 'disabled' hides the panel silently (by design).

tsc run on HEAD: 0 errors in branch files.
