# Brief: independent review admin PR #2012 at 60c78ad19

Hard-tier (new RPC + ACL + edge function, ticketing/money-adjacent). ONE round. Diff: `git fetch origin claude/free-orders-daily-cap; git diff origin/main...origin/claude/free-orders-daily-cap`. Handover: docs/handover/free-orders-daily-cap.md.

Owner rule: 5 FREE orders (total 0) per email per London calendar day; replaces the old 5/email/hour on all attempts. Message is one plain sentence, no reset time. IP 30/h and unpaid 20/type unchanged.

Check: (1) migration `ticket_checkout_rate_check_v2` + `_ticket_london_day_start_v1`: additive, v1 untouched, ACL/grants match v1 (no anon/authenticated execute unless v1 has it), search_path set, SECURITY DEFINER sane; (2) London midnight correct across BST/GMT and DST switch days; (3) p_expected_total_pence=0 cannot be spoofed to dodge or trigger the cap (reserve_v5 mismatch check really exists and runs on the same path); paid orders never counted or blocked by the daily cap; (4) both email hash keys counted, failed/expired excluded; (5) edge function maps `limit:'free_daily'` to the sentence with 429 and a deploy-order hazard is documented (apply migration, then deploy edge); (6) tests really assert the 4th/5th/6th boundary, and census 120->122 matches the real count. Ignore pre-existing reds.

Output: doc docs/review/review-pr-2012-60c78ad.md on your branch with `## Verdict: PASS | PASS WITH NITS | BLOCK`, naming "PR #2012" and head 60c78ad19. Findings as file:line.
