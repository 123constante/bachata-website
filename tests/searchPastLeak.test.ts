/**
 * searchPastLeak.test.ts -- both-directions proof for the predicate behind
 * check-search-public-v5.mjs tests 5, 6b and 6c.
 *
 * Why fixtures and not the live corpus: the check runs against prod, and the
 * payload that reds it cannot be produced on demand. Measured 2026-09-04, the
 * query "bachata" matched exactly 50 non-ended series against the RPC's own
 * section cap of 50, leaving the single ended series clipped as the 51st -- so
 * the same code was RED in CI at 22:50 on 2026-09-03 and GREEN locally seven
 * hours later, on one row of slack. Every case below therefore drives the
 * predicate directly.
 *
 * The contract under test (arc P2): search_public_v5 exempts a series whose
 * lifecycle_status is 'ended' from the upcoming filter and returns it flagged
 * is_ended, anchored on its last night. A definitely-past row is a violation
 * only when it is NOT flagged.
 */
import { describe, it, expect } from "vitest";
import {
  partitionDefinitelyPast,
  assertEndedFlagPresent,
  classifyEndedRoundTrip,
  describeEvents,
} from "../scripts/lib/search-past-leak.mjs";

const CUTOFF = Date.parse("2026-09-01T00:00:00Z");

const row = (over: Record<string, unknown> = {}) => ({
  id: "00000000-0000-0000-0000-000000000001",
  name: "Some Night",
  start_time: "2026-09-20T19:00:00+00:00",
  is_ended: false,
  ...over,
});

describe("partitionDefinitelyPast", () => {
  it("reports a past LIVE row as leaked -- the defect the check exists to catch", () => {
    const leak = row({ id: "live-past", start_time: "2026-06-28T13:00:00+00:00" });
    const { leaked, endedPast } = partitionDefinitelyPast([leak], CUTOFF, "t");
    expect(leaked.map((e: { id: string }) => e.id)).toEqual(["live-past"]);
    expect(endedPast).toEqual([]);
  });

  it("exempts a past ENDED row -- the live payload that reddened main since 2026-09-02", () => {
    // June Styling Course, marked ended at 2026-09-02T00:28:41Z; the run that
    // caught it was 33814933900.
    const ended = row({
      id: "662b3ed3-1205-4d72-8b09-9f742a849af7",
      name: "June Styling Course",
      start_time: "2026-06-28T13:00:00+00:00",
      is_ended: true,
    });
    const { leaked, endedPast } = partitionDefinitelyPast([ended], CUTOFF, "t");
    expect(leaked).toEqual([]);
    // Returned, not discarded: test 6c reads this list, and a "fix" that simply
    // dropped every past row would leave the ended arm permanently unexercised
    // while looking identical from test 6b.
    expect(endedPast.map((e: { id: string }) => e.id)).toEqual([
      "662b3ed3-1205-4d72-8b09-9f742a849af7",
    ]);
  });

  it("separates the two in one payload", () => {
    const { leaked, endedPast } = partitionDefinitelyPast(
      [
        row({ id: "a", start_time: "2026-05-01T19:00:00+00:00" }),
        row({ id: "b", start_time: "2026-05-02T19:00:00+00:00", is_ended: true }),
        row({ id: "c" }),
      ],
      CUTOFF,
      "t",
    );
    expect(leaked.map((e: { id: string }) => e.id)).toEqual(["a"]);
    expect(endedPast.map((e: { id: string }) => e.id)).toEqual(["b"]);
  });

  it("leaves an upcoming row in neither bucket", () => {
    const { leaked, endedPast } = partitionDefinitelyPast([row()], CUTOFF, "t");
    expect(leaked).toEqual([]);
    expect(endedPast).toEqual([]);
  });

  it("an ALL-ENDED past payload leaks nothing, which is what must red test 6b(a)", () => {
    // The vacuity trap: if (a) counted ended rows, a corpus whose only past
    // matches were ended would report "rich enough to prove something" while
    // every subject of (b) was exempt.
    const { leaked, endedPast } = partitionDefinitelyPast(
      [
        row({ id: "x", start_time: "2026-01-01T19:00:00+00:00", is_ended: true }),
        row({ id: "y", start_time: "2026-02-01T19:00:00+00:00", is_ended: true }),
      ],
      CUTOFF,
      "t",
    );
    expect(leaked).toHaveLength(0);
    expect(endedPast).toHaveLength(2);
  });

  it("hands a null start_time on an ended row to the ended arm, not to nobody", () => {
    // The fully-cancelled ended series: every remaining night hand-cancelled,
    // so the RPC has no occurrence to anchor on and returns start_time null.
    // Review finding 2 -- the first cut `continue`d it into NEITHER bucket, so
    // the row arc P2 exists for could never reach the 6c round trip, and a
    // regression that re-silenced exactly that series would have passed green.
    const { leaked, endedPast } = partitionDefinitelyPast(
      [row({ id: "z", start_time: null, is_ended: true })],
      CUTOFF,
      "t",
    );
    expect(leaked).toEqual([]);
    expect(endedPast.map((e: { id: string }) => e.id)).toEqual(["z"]);
  });

  it("keeps an anchorless ended row out of the leaked bucket even so", () => {
    // The control for the case above: moving it into endedPast must not have
    // moved it into leaked by some other route -- an anchorless ended row is
    // never a violation of the upcoming filter.
    const { leaked } = partitionDefinitelyPast(
      [
        row({ id: "z", start_time: null, is_ended: true }),
        row({ id: "live", start_time: "2026-05-01T19:00:00+00:00" }),
      ],
      CUTOFF,
      "t",
    );
    expect(leaked.map((e: { id: string }) => e.id)).toEqual(["live"]);
  });

  it("still refuses a null start_time on a LIVE row", () => {
    expect(() =>
      partitionDefinitelyPast([row({ start_time: null })], CUTOFF, "probe"),
    ).toThrow(/probe: event .* has null start_time/);
  });

  it("refuses an unparseable start_time", () => {
    expect(() =>
      partitionDefinitelyPast([row({ start_time: "not-a-date" })], CUTOFF, "probe"),
    ).toThrow(/unparseable start_time not-a-date/);
  });
});

describe("assertEndedFlagPresent", () => {
  it("refuses a payload with no is_ended key rather than reading it as not-ended", () => {
    const { is_ended: _drop, ...noFlag } = row();
    expect(() => assertEndedFlagPresent([noFlag], "probe")).toThrow(
      /carries no boolean is_ended/,
    );
  });

  it("refuses a non-boolean is_ended", () => {
    expect(() => assertEndedFlagPresent([row({ is_ended: "true" })], "probe")).toThrow(
      /carries no boolean is_ended/,
    );
  });

  it("accepts both boolean values", () => {
    expect(() =>
      assertEndedFlagPresent([row(), row({ is_ended: true })], "probe"),
    ).not.toThrow();
  });

  it("is reached through partitionDefinitelyPast, not only when called directly", () => {
    const { is_ended: _drop, ...noFlag } = row();
    expect(() => partitionDefinitelyPast([noFlag], CUTOFF, "probe")).toThrow(
      /carries no boolean is_ended/,
    );
  });
});

describe("classifyEndedRoundTrip", () => {
  // Review finding 1: the first cut threw whenever the row was absent, which
  // rebuilt the cap-boundary red this branch exists to remove -- an ended
  // series sorts behind every live match, so a name drawing 50 live matches
  // would have reddened the guard for being popular.
  const ended = { id: "e1", name: "June Styling Course", is_ended: true };

  it("passes when the row comes back still flagged", () => {
    expect(
      classifyEndedRoundTrip({ echoed: ended, sectionLength: 1, probeLimit: 50 }),
    ).toBe("ok");
  });

  it("reds when the row comes back UNflagged -- the exemption's premise is gone", () => {
    expect(
      classifyEndedRoundTrip({
        echoed: { ...ended, is_ended: false },
        sectionLength: 1,
        probeLimit: 50,
      }),
    ).toBe("unflagged");
    // A missing flag is not a pass either.
    expect(
      classifyEndedRoundTrip({ echoed: { id: "e1" }, sectionLength: 1, probeLimit: 50 }),
    ).toBe("unflagged");
  });

  it("reds on absence when the section had room -- nothing was clipped", () => {
    expect(
      classifyEndedRoundTrip({ echoed: undefined, sectionLength: 49, probeLimit: 50 }),
    ).toBe("silent");
  });

  it("only WARNS on absence from a FULL section -- clipping is not silence", () => {
    expect(
      classifyEndedRoundTrip({ echoed: undefined, sectionLength: 50, probeLimit: 50 }),
    ).toBe("clipped");
    // and a section the RPC capped above the asked-for limit is still full
    expect(
      classifyEndedRoundTrip({ echoed: undefined, sectionLength: 51, probeLimit: 50 }),
    ).toBe("clipped");
  });

  it("pins the boundary: one row short of the cap is silence, not clipping", () => {
    const at = classifyEndedRoundTrip({ echoed: undefined, sectionLength: 50, probeLimit: 50 });
    const below = classifyEndedRoundTrip({ echoed: undefined, sectionLength: 49, probeLimit: 50 });
    expect([below, at]).toEqual(["silent", "clipped"]);
  });
});

describe("describeEvents", () => {
  it("names at most three rows", () => {
    const rows = ["a", "b", "c", "d"].map((id) => row({ id }));
    const text = describeEvents(rows);
    expect(text).toContain("a (Some Night)");
    expect(text).toContain("c (Some Night)");
    expect(text).not.toContain("d (");
  });
});
