# Brief: round 2 independent review of the whole-flyer link-card contract (READ-ONLY, different model from the author)

Branch: `claude/review-whole-flyer-og-contract-r2` (review branch, no PR, no code). Author: website-50 (Sonnet). Round 1 (Opus) returned BLOCK with 2 blockers and 16 further findings: `docs/reviews/whole-flyer-og-contract-r1.md` on branch `claude/review-whole-flyer-og-contract` (read it first). This is the ONE allowed second round (user-facing public route, two rounds).

## What to review
`docs/design/whatsapp-whole-flyer.CONTRACT.md` (DRAFT 2) and `docs/design/whatsapp-event-preview.INVENTORY.md`, both on `brief/review-whole-flyer-og-contract-r2`. Owner decisions W1 to W4 (section 1) are binding.

## Method (read-only; Supabase read-only on prod project stsdtacfauprzrdebmzg, counts and function bodies only; no writes)
1. For EACH round 1 finding (1 to 18) say FIXED / PARTLY / NOT FIXED with the DRAFT 2 section that answers it, and judge whether the fix is correct, not only present. Special attention:
   - Findings 1 and 2 (D4 read rule, version only in key and etag): walk the full mode x baked-key-segment matrix on the real code (`resolveOgCardImage` in `app/detailLoader.ts`, `get_og_image_v1`, `set_og_image_v1`, `app/routes/api.og.bake.tsx` key at about line 214, `app/routes/event.tsx` declared size). Find any state (mid-backfill, a re-bake that fails half way, an occurrence vs its series cover, a cover change during a mode switch, two deploys at once) where a page can declare a size that does not match the pixels it points to, or serve a card of the wrong layout.
   - Finding 3 (size in the key): is the key length, character set and the existing `HEALTHY_BAKED_KEY_RE` compatible? Does anything else parse that key (grep the repo and the admin-facing scripts you can see)?
   - Finding 5 (Cloudflare): state what you can and cannot verify; check the repo for any Cloudflare rule or header override.
   - Finding 7 and 8 (backfill, scrape trigger): is `--ids` and `--limit` enough to make a batch safe? What does `trg_og_scrape_on_ready` do on prod now (read the body) and can a batch of 25 hit a rate limit?
2. Tally 8a and 8b yourself, cell by cell (the contract claims 78 cells and 247 cells; GAP 0). Check every code is TRUE for its cell, especially R5, R6 and R7 and the fixture-only yeses.
3. Look for what DRAFT 2 introduced: contradictions between D2, D3, D4, D6, D9 and section 6 (B1 scope, rollback table); a B1 file that is not listed; a D10 violation.
4. If you cannot read the admin repo, say so once and verify against prod function bodies.

## Output
Write `docs/reviews/whole-flyer-og-contract-r2.md` on your branch: a table of the r1 findings with FIXED / PARTLY / NOT FIXED, a numbered table of NEW findings (BLOCK / FIX / NOTE, where, what is wrong, the exact change to the contract), then `VERDICT: PASS | PASS WITH FIXES | BLOCK`, then your matrix tallies and a Not-verified list. Do not edit the contract. Do not open a PR. Push once; last commit subject ends with the done marker from the ticket.
