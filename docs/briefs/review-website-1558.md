# Independent review: website PR #1558 (money class)
Review PR 123constante/bachata-website#1558 at its current head (in-site Buy on festival pages, Ritmo first). Read-only: do not push code.
Check: (1) ticketCheckoutApi.ts: amounts/currency/ticket ids come from the server, never trusted from the client; no price computed client-side that is then charged; (2) the in-site Buy is gated (flag / probe) and falls back to the external link when not enabled; (3) no change lets a non-buyer or wrong event reach checkout; (4) tests assert these.
Output: post ONE PR comment starting "REVIEW PASS" or "REVIEW FAIL" at head <sha>, <=10 lines. No new PR.
