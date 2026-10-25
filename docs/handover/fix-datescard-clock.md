# Handover: fix-datescard-clock

**Root cause (test-only).** `flows/add/__tests__/fixtures.tsx` defined `today = () => londonTodayKey()`, which reads the
ambient clock. `datesCard.consistency.test.tsx` builds its `rows` table (`coming('c1', 3)`, `past('p1', 3)`, ...) at
describe-collection time, before `beforeEach` calls `vi.setSystemTime(FROZEN)`, so those fixture dates were computed from the
REAL date, while the product rendered against the frozen 20 Oct 2026. It passed while real "today" was within the
window (22 Oct) and failed once London reached 23 Oct (past date `day(-3)` fell on the wrong side of frozen today, giving 3 rows
instead of 2). The product code is fine: it reads one clock (`londonTodayKey()` / Home's `today`).

**Fix.** `today()` in the fixtures now derives from `FROZEN` (`londonTodayKey(FROZEN)`), so every sibling that imports the
fixtures (same collection-time pattern: consistency.render.matrix, fpar.review, s5.fixpass, ...) is clock-independent. No
assertion, expected number, or skip changed.

**Not done / left.** Nothing. Tests that import these fixtures must still freeze Date (they all do).
