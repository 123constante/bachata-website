# Independent re-review: website PR #1541 at head cbf89da (money class)
A previous review FAILED (see PR comment). A fix was pushed. Read-only: push nothing but the done signal.
Verify each prior finding is fixed: (1) every gate is `moneyVisible === true`, missing/null = counts-only, matrix row for missing flag expects no pence; (2) orders read with ORDER_SELECT_MONEY does not fire until summary resolves true, no pence in cache while loading; (3) Refund button, RefundSheet and counts-only note gate on showMoney as well as role; (4) table rows exist for missing flag, loading, manager/contributor x flag, Refund when false.
Output: ONE PR comment starting "REVIEW PASS" or "REVIEW FAIL" at head <sha>, <=10 lines. No new PR.
