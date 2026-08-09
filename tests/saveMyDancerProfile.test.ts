import { describe, expect, it, vi, beforeEach } from "vitest";

const rpc = vi.fn();
vi.mock("@/integrations/supabase/client", () => ({ supabase: { rpc: (...args: unknown[]) => rpc(...args) } }));

import {
  buildDancerProfilePayload,
  saveMyDancerProfile,
  MissingDancerProfileError,
  UnresolvedPersonError,
  isUnresolvedPerson,
  danceStartedYearFromDateString,
  dateStringFromDanceStartedYear,
  type SaveMyDancerProfileInput,
} from "@/lib/saveMyDancerProfile";
import { hasDancerProfileBasics, inferOnboardingStatusFromDancer } from "@/lib/onboardingStatus";

beforeEach(() => rpc.mockReset());

describe("buildDancerProfilePayload", () => {
  it("drops keys the caller did not set", () => {
    expect(buildDancerProfilePayload({ first_name: "Ana" })).toEqual({ first_name: "Ana" });
  });

  it("keeps looking_for_partner false", () => {
    // The obvious `if (!value) continue` would silently drop this, and the
    // practice-partner toggle would then only ever be able to turn ON.
    const payload = buildDancerProfilePayload({ dancer_details: { looking_for_partner: false } });
    expect(payload.dancer_details).toEqual({ looking_for_partner: false });
  });

  it("keeps an explicit null dance_role, the one clearable scalar", () => {
    expect(buildDancerProfilePayload({ dance_role: null })).toEqual({ dance_role: null });
  });

  it("keeps empty arrays, which are what clear a sidecar list", () => {
    const payload = buildDancerProfilePayload({ dancer_details: { favorite_styles: [] } });
    expect(payload.dancer_details).toEqual({ favorite_styles: [] });
  });

  it("omits dancer_details entirely when no sidecar field was set", () => {
    expect(buildDancerProfilePayload({ first_name: "Ana", dancer_details: {} })).toEqual({ first_name: "Ana" });
  });

  it("is an allowlist: mirrored and unwritable columns never reach the function", () => {
    // `website` and `photo_url` are MIRRORED from website_url/avatar_url, and the
    // function has no meta_data arm at all. A caller that sends them (only
    // possible through a cast) gets a silent no-op server-side, so drop them here
    // where it is visible instead.
    const smuggled = {
      first_name: "Ana",
      website: "https://example.test",
      photo_url: "https://example.test/a.png",
      meta_data: { onboarding_status: "completed" },
      roles: ["dancing"],
      favorite_styles: ["bachata"],
    } as unknown as SaveMyDancerProfileInput;

    expect(buildDancerProfilePayload(smuggled)).toEqual({ first_name: "Ana" });
  });
});

describe("saveMyDancerProfile", () => {
  it("returns the canonical row", async () => {
    rpc.mockResolvedValue({ data: { id: "p1", first_name: "Ana" }, error: null });
    await expect(saveMyDancerProfile({ first_name: "Ana" })).resolves.toEqual({ id: "p1", first_name: "Ana" });
    expect(rpc).toHaveBeenCalledWith("save_my_dancer_profile_v1", { p_payload: { first_name: "Ana" } });
  });

  it("maps no_canonical_person onto UnresolvedPersonError", async () => {
    rpc.mockResolvedValue({ data: null, error: { message: 'record "no_canonical_person" ...' } });
    await expect(saveMyDancerProfile({ first_name: "Ana" })).rejects.toBeInstanceOf(UnresolvedPersonError);
  });

  it("throws rather than resolving when the function returns SQL NULL", async () => {
    // The signup trigger did not fire. The function reports no error for this,
    // so a caller that trusted the resolved value would show "saved" over a
    // write that never happened -- the failure mode that hid this whole bug.
    rpc.mockResolvedValue({ data: null, error: null });
    await expect(saveMyDancerProfile({ first_name: "Ana" })).rejects.toBeInstanceOf(MissingDancerProfileError);
  });

  it("rethrows any other database error untouched", async () => {
    const error = { message: "permission denied for table dancer_profiles", code: "42501" };
    rpc.mockResolvedValue({ data: null, error });
    await expect(saveMyDancerProfile({ first_name: "Ana" })).rejects.toBe(error);
  });
});

describe("dance_started_year conversion", () => {
  it("reads the year off the string rather than through Date", () => {
    expect(danceStartedYearFromDateString("2018-01-01")).toBe(2018);
  });

  it("reads the year LEXICALLY, provably without parsing the date", () => {
    // This case exists because the obvious one cannot see the bug it guards.
    // `new Date('2018-01-01').getFullYear()` is 2017 only WEST of UTC, and we
    // develop in London -- so a Date-based implementation passes the test above
    // on this machine and corrupts data for users in the Americas. A mutation
    // check proved that: swapping the slice back for `new Date(...)` left the
    // suite fully green.
    //
    // An unparseable date discriminates in EVERY timezone: slicing yields 2018,
    // while any Date-based implementation yields NaN and falls back to null.
    expect(danceStartedYearFromDateString("2018-99-99")).toBe(2018);
  });

  it("round-trips a year", () => {
    expect(danceStartedYearFromDateString(dateStringFromDanceStartedYear(2015))).toBe(2015);
  });

  it("treats an empty or unset value as no year", () => {
    expect(danceStartedYearFromDateString("")).toBeNull();
    expect(danceStartedYearFromDateString(null)).toBeNull();
    expect(dateStringFromDanceStartedYear(null)).toBe("");
  });
});

describe("isUnresolvedPerson", () => {
  it("finds the token in details, not just message", () => {
    expect(isUnresolvedPerson({ message: "unexpected", details: "no_canonical_person" })).toBe(true);
  });

  it("does not misclassify an unrelated error that merely mentions it", () => {
    expect(isUnresolvedPerson({ message: 'constraint "no_canonical_personx" violated' })).toBe(false);
  });
});

describe("hasDancerProfileBasics", () => {
  // The predicate the onboarding gate and the role-availability gate share. If
  // these two ever disagree the user gets a routing loop: one surface offers the
  // dancer dashboard, the other bounces them back to /onboarding.
  it("rejects the trigger-minted stub", () => {
    expect(hasDancerProfileBasics({ first_name: null, based_city_id: null, meta_data: {} })).toBe(false);
  });

  it("rejects a name with no city", () => {
    expect(hasDancerProfileBasics({ first_name: "Ana", based_city_id: null })).toBe(false);
  });

  it("rejects whitespace as a name", () => {
    expect(hasDancerProfileBasics({ first_name: "   ", based_city_id: "city-1" })).toBe(false);
  });

  it("accepts a name plus a city", () => {
    expect(hasDancerProfileBasics({ first_name: "Ana", based_city_id: "city-1" })).toBe(true);
  });

  it("treats a missing row as incomplete", () => {
    expect(hasDancerProfileBasics(null)).toBe(false);
  });
});

describe("inferOnboardingStatusFromDancer", () => {
  it("lets the data outrank a stale in_progress stamp", () => {
    // The latch. No client path can write meta_data any more and the RPC cannot
    // clear a field, so honouring the stamp ahead of the data would pin the user
    // on /onboarding forever: fill the form, save succeeds, stamp survives, gate
    // bounces, repeat. Unrecoverable from any screen.
    expect(
      inferOnboardingStatusFromDancer({
        first_name: "Ana",
        based_city_id: "city-1",
        meta_data: { onboarding_status: "in_progress" },
      }),
    ).toBe("completed");
  });

  it("still honours a stamp when the basics are absent", () => {
    expect(
      inferOnboardingStatusFromDancer({
        first_name: null,
        based_city_id: null,
        meta_data: { onboarding_status: "not_started" },
      }),
    ).toBe("not_started");
  });

  it("calls a bare stub in_progress", () => {
    expect(inferOnboardingStatusFromDancer({ first_name: null, based_city_id: null, meta_data: {} })).toBe(
      "in_progress",
    );
  });

  it("refuses to call a row completed on a stamp alone", () => {
    // The divergence the parity test below could not see: a 'completed' stamp on
    // a row with no basics made AuthGuard admit the user to /profile while
    // Profile found no roles and bounced them to /onboarding.
    expect(
      inferOnboardingStatusFromDancer({
        first_name: null,
        based_city_id: null,
        meta_data: { onboarding_status: "completed" },
      }),
    ).toBe("in_progress");
  });

  it("agrees with hasDancerProfileBasics on EVERY combination, not just the filled one", () => {
    const rows = [
      { first_name: "Ana", based_city_id: "c1", meta_data: {} },
      { first_name: "Ana", based_city_id: null, meta_data: { onboarding_status: "completed" } },
      { first_name: null, based_city_id: "c1", meta_data: { onboarding_status: "completed" } },
      { first_name: null, based_city_id: null, meta_data: { onboarding_status: "completed" } },
      { first_name: "   ", based_city_id: "c1", meta_data: { onboarding_status: "completed" } },
    ];
    for (const row of rows) {
      expect(inferOnboardingStatusFromDancer(row) === "completed").toBe(hasDancerProfileBasics(row));
    }
  });

  it("agrees with hasDancerProfileBasics on every filled row", () => {
    // The two gates must never disagree: AuthGuard routes on this function while
    // useUserIds/Profile route on the predicate.
    const filled = { first_name: "Ana", based_city_id: "city-1", meta_data: {} };
    expect(inferOnboardingStatusFromDancer(filled) === "completed").toBe(hasDancerProfileBasics(filled));
  });
});
