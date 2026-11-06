# Brief: a ticket or video link the organiser can save always shows on the public page

Brief-version: 2
Repo: Website. Branch: claude/p3-link-save-renders. Lane: normal, Sonnet. No database call added.

## What main lacks
- Two rules disagree. The organiser sheets accept a link by `linkProblem('ticket'|'video', v)` = server-mirror `publicUrlOk` (regex `^https?://[^\s\u0000-\u001f\u007f]+$`, src/modules/organiser/shared/linkRules.ts lines 22-35). The public page drops a link unless `safeExternalHref` can build a URL from it (src/lib/url.ts; used at src/modules/event-page/useEventPageQuery.ts line 265 for the ticket button). Proved in node on 2026-11-06: `https://example.com:99999`, `https://[abc`, `https://exa<mple.com`, `https://user@` and `https://example.com:80a` pass the first and return undefined from the second. The organiser sees "Saved", dancers get no ticket button and no message (walk D risk 4, docs/handover/walk-dancer-view-after-edit.md) -- grep: linkRenders
- No test compares the two rules (existing: events/__tests__/fixesBatch.matrix.test.ts line 108 checks `linkProblem` alone).

## Files
src/modules/organiser/shared/linkRules.ts, src/modules/organiser/shared/__tests__/linkRules.renders.matrix.test.ts (new), docs/design/p3-link-save-renders.md (copy only). Callers need no edit: EditorSheet.tsx lines 78-79 and the P3 Details sheet already call `linkProblem`. Leave alone: src/lib/url.ts behaviour (many readers), src/modules/event-page/**.

## What to build
1. In linkRules.ts add `linkRenders(value)`: true when `safeExternalHref(value.trim())` is defined. In `linkProblem`, for kinds `ticket` and `video` only, a value that passes `publicUrlOk` but fails `linkRenders` returns the existing `LINK_PROBLEM[kind]` text (no new wording, so the sheet, its Done button and Save already show and disable it).
2. Table test, RED FIRST (new rows fail on unchanged code): rows = blank, valid https, valid http, bare `ticket.example.com` (already refused by publicUrlOk: stays refused), the five shapes above, 2048-char link, link with a space, `httpx://`, uppercase scheme, trailing dot host. For each kind in {ticket, video}: `linkProblem(kind, v) === null` implies `safeExternalHref(v)` is defined (assert the implication over the WHOLE table), plus the exact expected verdict per row.
3. Make no change for instagram, website, facebook, chat kinds (they have their own normalisers); say in the PR body that they were checked by the same implication test and list any row that fails, without fixing it here.
4. Design record: no visible layout change; one chosen rule and why the server rule is left alone (a looser server rule is fine, the sheet is the first gate).

## Out of scope
No server change, no change to what the public page renders, no new copy. Walk the P3 Details ticket-link sheet at 390x844 with one rejected and one accepted link (Done disabled with the existing reason).
Hand-off: Verified / Not verified block; "Not verified: the real public page after a save".
