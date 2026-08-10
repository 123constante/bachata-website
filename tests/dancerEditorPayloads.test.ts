import { describe, expect, it, vi } from "vitest";

// Every export under test here is pure, but the module graph reaches
// `@/lib/saveMyDancerProfile`, which constructs the REAL Supabase client at
// import time -- a live client, with its own timers, in an extra worker. That
// was enough to tip three timing-sensitive edge-TTL tests over in parallel runs
// while this file passed happily on its own. A pure-function test has no
// business opening a network client.
vi.mock("@/integrations/supabase/client", () => ({ supabase: { rpc: vi.fn() } }));

import {
  buildCreateProfilePayload,
  buildDashboardSectionPayload,
  dancerRoleFromStored,
  danceStartedYearFromExperienceLevel,
  EXPERIENCE_LEVEL_OPTIONS,
  EXPERIENCE_LEVEL_YEARS,
  mergeStoredDancerIntoWizardForm,
  normalizeSocialUrl,
  type DancerEditorForm,
} from "@/lib/dancerEditorPayloads";
import { buildDancerProfilePayload } from "@/lib/saveMyDancerProfile";

/**
 * These cover the mapping defects three review rounds found in exactly this code.
 * Each case names the failure it exists to stop -- a case whose author believes
 * the bug cannot catch it.
 */

const form = (overrides: Partial<DancerEditorForm> = {}): DancerEditorForm => ({
  first_name: "Ana",
  surname: "Diaz",
  city: "city-uuid",
  instagram: "",
  facebook: "",
  whatsapp: "",
  website: "",
  dancing_start_date: "",
  partner_role: "",
  achievements: [],
  favorite_songs: [],
  partner_search_role: "",
  partner_search_level: [],
  partner_practice_goals: [],
  partner_details: "",
  favorite_styles: [],
  looking_for_partner: false,
  photo_url: "",
  ...overrides,
});

describe("dancerRoleFromStored", () => {
  it("maps the canonical stored spelling of Both back to the badge", () => {
    // The bug this replaces: no `lead and follow` case, so the stored form of
    // "Both" read back as "no role selected", the badge rendered unselected, and
    // the next save wrote null over a role the user had actually set.
    expect(dancerRoleFromStored("Lead and Follow")).toBe("Both");
  });

  it("accepts every spelling normalize_dance_role accepts, so the trip is total", () => {
    for (const stored of ["Leader", "leader", "lead", "Follower", "follow", "both", "lead & follow", "lead/follow", "Either leader or follower"]) {
      expect(dancerRoleFromStored(stored)).not.toBe("");
    }
  });

  it("collapses the whitespace the DB helper collapses", () => {
    expect(dancerRoleFromStored("  Lead   and  Follow ")).toBe("Both");
  });

  it("collapses tabs and newlines too, because normalize_dance_role collapses the CLASS", () => {
    // Splitting on a literal space left these unmatched, so the codec returned ""
    // -- which the identity editor turns into `dance_role: null`, and the function
    // key-tests that and BLANKS the column. Failing to translate deleted the role.
    expect(dancerRoleFromStored("Lead\tand\tFollow")).toBe("Both");
    expect(dancerRoleFromStored("Lead\nand\nFollow")).toBe("Both");
  });

  it("does not resolve inherited keys as roles", () => {
    expect(dancerRoleFromStored("constructor")).toBe("");
    expect(dancerRoleFromStored("toString")).toBe("");
  });

  it("returns empty for null, empty and unknown values rather than guessing", () => {
    expect(dancerRoleFromStored(null)).toBe("");
    expect(dancerRoleFromStored("")).toBe("");
    expect(dancerRoleFromStored("Salsero")).toBe("");
  });
});

describe("danceStartedYearFromExperienceLevel", () => {
  it("converts a DURATION into a calendar year", () => {
    // The shipped bug assigned the duration itself, so "Intermediate" stored the
    // year 4 -- which `dancer_profiles_dance_started_year_check` (1950..now)
    // would have rejected outright had the write ever been permitted to run.
    expect(danceStartedYearFromExperienceLevel("Intermediate", 2026)).toBe(2022);
  });

  it("stays inside the CHECK for every level the picker offers", () => {
    for (const level of Object.keys(EXPERIENCE_LEVEL_YEARS)) {
      const year = danceStartedYearFromExperienceLevel(level, 2026) as number;
      expect(year).toBeGreaterThanOrEqual(1950);
      expect(year).toBeLessThanOrEqual(2026);
    }
  });

  it("converts every level the picker actually offers", () => {
    // The list and the durations used to live in different files. A level with no
    // duration converts to null and the user's answer vanishes without an error.
    for (const level of EXPERIENCE_LEVEL_OPTIONS) {
      expect(danceStartedYearFromExperienceLevel(level, 2026)).not.toBeNull();
    }
    expect(EXPERIENCE_LEVEL_OPTIONS.length).toBeGreaterThan(0);
  });

  it("returns null for an absent or unknown level", () => {
    expect(danceStartedYearFromExperienceLevel("", 2026)).toBeNull();
    expect(danceStartedYearFromExperienceLevel(undefined, 2026)).toBeNull();
    expect(danceStartedYearFromExperienceLevel("Godlike", 2026)).toBeNull();
  });

  it("does not resolve inherited keys, which make the year NaN rather than null", () => {
    // A bare index reaches Object.prototype, so 'constructor' is a Function, slips
    // past `=== undefined` and yields NaN -- JSON.stringify writes that as null and
    // the answer vanishes with no error. experience_level comes from UNVALIDATED
    // localStorage, so these keys are reachable without touching the picker.
    for (const key of ["constructor", "toString", "valueOf", "hasOwnProperty", "__proto__"]) {
      expect(danceStartedYearFromExperienceLevel(key, 2026)).toBeNull();
    }
  });
});

describe("normalizeSocialUrl", () => {
  it("expands a bare instagram handle", () => {
    expect(normalizeSocialUrl("instagram", "@ana")).toBe("https://instagram.com/ana");
  });

  it("keeps a dotted handle as a handle, not a domain", () => {
    // Instagram usernames legally contain "." and "_", and the old `includes(".")`
    // test sent "@ana.dance" to https://ana.dance -- a dead domain saved as the
    // user's profile link.
    expect(normalizeSocialUrl("instagram", "@ana.dance")).toBe("https://instagram.com/ana.dance");
    expect(normalizeSocialUrl("instagram", "ana_b.dance")).toBe("https://instagram.com/ana_b.dance");
  });

  it("still recognises a real instagram URL or path as a URL", () => {
    expect(normalizeSocialUrl("instagram", "instagram.com/ana")).toBe("https://instagram.com/ana");
    expect(normalizeSocialUrl("instagram", "https://instagram.com/ana")).toBe("https://instagram.com/ana");
    expect(normalizeSocialUrl("instagram", "some/path")).toBe("https://some/path");
  });

  it("leaves an empty value empty rather than inventing https://", () => {
    expect(normalizeSocialUrl("website", "   ")).toBe("");
  });
});

/** Every sidecar list the function reads with `jsonb_array_elements_text`. */
const SIDECAR_ARRAY_KEYS = [
  "partner_search_level",
  "partner_practice_goals",
  "favorite_styles",
  "favorite_songs",
  "achievements",
] as const;

const expectNoNullArrays = (payload: Record<string, unknown>) => {
  const details = (payload.dancer_details || {}) as Record<string, unknown>;
  for (const key of SIDECAR_ARRAY_KEYS) {
    if (!(key in details)) continue;
    expect(Array.isArray(details[key])).toBe(true);
  }
};

describe("buildDashboardSectionPayload", () => {
  it("never sends a sidecar list as null, which is a HARD ERROR in the function", () => {
    // `CASE WHEN details ? 'k' THEN ARRAY(SELECT jsonb_array_elements_text(...))`
    // -- a key present with a JSON null reaches that call with a scalar and the
    // whole save raises. Both screens used to send `x.length ? x : null`.
    for (const section of ["identity", "career", "partner", "social"] as const) {
      expectNoNullArrays(buildDashboardSectionPayload(section, form(), { cityId: "c" }));
    }
  });

  it("sends partner_details as TEXT, never the serialised object", () => {
    // serializePartnerDetails returns { text: ... }; `->>` would store its literal
    // JSON and the reader hands that straight back to the textarea, gaining a
    // wrapper on every save.
    const payload = buildDashboardSectionPayload("partner", form({ partner_details: "Tuesdays, Angel" }));
    expect((payload.dancer_details as Record<string, unknown>).partner_details).toBe("Tuesdays, Angel");
  });

  it("clears a deleted blurb with an empty string rather than null", () => {
    // The sidecar arm has no NULLIF, so "" is a real value there. null would read
    // as "leave unchanged" and the deleted text would return on reload.
    const payload = buildDashboardSectionPayload("partner", form({ partner_details: "" }));
    expect((payload.dancer_details as Record<string, unknown>).partner_details).toBe("");
  });

  it("sends avatar_url as TEXT, not the string[] the photo helper returns", () => {
    const payload = buildDashboardSectionPayload("identity", form({ photo_url: "https://cdn/a.jpg" }), { cityId: "c" });
    expect(payload.avatar_url).toBe("https://cdn/a.jpg");
  });

  it("writes no column that does not exist", () => {
    // The direct UPDATE this replaces set city_id, dancing_start_date,
    // partner_role and photo_url. Only the last exists, and only as a mirror.
    const payload = buildDashboardSectionPayload("identity", form({ dancing_start_date: "2018-06-01", partner_role: "Both" }), {
      cityId: "city-uuid",
    });
    for (const phantom of ["city_id", "city", "dancing_start_date", "partner_role", "photo_url", "website", "created_by", "years_dancing", "verified"]) {
      expect(payload).not.toHaveProperty(phantom);
    }
    expect(payload.based_city_id).toBe("city-uuid");
    expect((payload.dancer_details as Record<string, unknown>).dance_started_year).toBe(2018);
  });

  it("keeps each section narrow, so a save cannot carry an unhydrated field", () => {
    const career = buildDashboardSectionPayload("career", form());
    expect(Object.keys(career)).toEqual(["dancer_details"]);

    const partner = buildDashboardSectionPayload("partner", form());
    expect(Object.keys(partner)).toEqual(["dancer_details"]);

    const social = buildDashboardSectionPayload("social", form({ instagram: "@ana" }));
    expect(social).not.toHaveProperty("dancer_details");
    expect(social.instagram).toBe("https://instagram.com/ana");
    // `website` is a mirror the function maintains; `website_url` is the column.
    expect(social).not.toHaveProperty("website");
  });

  it("blanks the role with null when no badge is selected", () => {
    expect(buildDashboardSectionPayload("identity", form({ partner_role: "" }), { cityId: "c" }).dance_role).toBeNull();
  });

  it("throws rather than falling through to the social payload for an unknown section", () => {
    // As an unguarded fall-through, a fifth section with no arm shipped the SOCIAL
    // payload built from that editor's form -- silently overwriting four contact
    // columns under a green "Profile updated". TypeScript cannot catch it.
    expect(() =>
      buildDashboardSectionPayload("media" as never, form())
    ).toThrow(/no arm for section/);
  });

  it("survives the seam's own payload builder with its lists intact", () => {
    const built = buildDancerProfilePayload(buildDashboardSectionPayload("career", form({ favorite_styles: [] })));
    expect((built.dancer_details as Record<string, unknown>).favorite_styles).toEqual([]);
  });
});

describe("buildCreateProfilePayload", () => {
  const ctx = { firstName: "Ana", surname: "Diaz", cityId: "city-uuid", currentYear: 2026 };

  it("never sends a sidecar list as null", () => {
    expectNoNullArrays(buildCreateProfilePayload({}, ctx));
  });

  it("prefers an explicit start date over the experience level", () => {
    const payload = buildCreateProfilePayload({ dancing_start_date: "2015-03-01", experience_level: "Beginner" }, ctx);
    expect((payload.dancer_details as Record<string, unknown>).dance_started_year).toBe(2015);
  });

  it("falls back to the level, converted from a DURATION to a year", () => {
    const payload = buildCreateProfilePayload({ experience_level: "Advanced" }, ctx);
    expect((payload.dancer_details as Record<string, unknown>).dance_started_year).toBe(2019);
  });

  it("reads the year off the STRING, not through a Date", () => {
    // `new Date('2015-01-01')` parses as UTC while getFullYear() reads local, so
    // west of UTC the year decremented on every save with no edit at all.
    const payload = buildCreateProfilePayload({ dancing_start_date: "2015-01-01" }, ctx);
    expect((payload.dancer_details as Record<string, unknown>).dance_started_year).toBe(2015);
  });

  it("splits the textareas into trimmed, non-empty lines", () => {
    const payload = buildCreateProfilePayload({ achievements_text: " Champion 2024 \n\n  Runner-up  \n" }, ctx);
    expect((payload.dancer_details as Record<string, unknown>).achievements).toEqual(["Champion 2024", "Runner-up"]);
  });

  it("sends partner_details as TEXT and avatar_url as a single string", () => {
    const payload = buildCreateProfilePayload({ partner_details: "Weeknights", photo_url: "https://cdn/a.jpg" }, ctx);
    expect((payload.dancer_details as Record<string, unknown>).partner_details).toBe("Weeknights");
    expect(payload.avatar_url).toBe("https://cdn/a.jpg");
  });

  it("writes no column that does not exist, and no created_by", () => {
    const payload = buildCreateProfilePayload({ favorite_styles: ["Bachata Sensual"], website: "ana.example" }, ctx);
    for (const phantom of ["created_by", "dancing_start_date", "partner_role", "website", "photo_url", "favorite_styles"]) {
      expect(payload).not.toHaveProperty(phantom);
    }
    // favorite_styles belongs to the sidecar; a top-level copy is a silent no-op.
    expect((payload.dancer_details as Record<string, unknown>).favorite_styles).toEqual(["Bachata Sensual"]);
    expect(payload.website_url).toBe("https://ana.example");
  });

  it("passes the badge value through for the search role instead of narrowing it", () => {
    // Narrowing to Leader/Follower would have wiped a stored "Both" on every save.
    const payload = buildCreateProfilePayload({ partner_search_role: "Both" }, ctx);
    expect((payload.dancer_details as Record<string, unknown>).partner_search_role).toBe("Both");
  });

  it("keeps looking_for_partner false rather than dropping it", () => {
    const built = buildDancerProfilePayload(buildCreateProfilePayload({ looking_for_partner: false }, ctx));
    expect((built.dancer_details as Record<string, unknown>).looking_for_partner).toBe(false);
  });
});

describe("mergeStoredDancerIntoWizardForm", () => {
  const NOTHING_TOUCHED: ReadonlySet<string> = new Set();
  /** Stands in for react-hook-form's dirtyFields on the second case below. */
  const TOUCHED_BY_USER: Record<string, true> = {
    city: true,
    nationality: true,
    favorite_styles: true,
    partner_details: true,
    partner_search_level: true,
    favorite_songs_text: true,
    looking_for_partner: true,
  };
  const stored = {
    based_city_id: "city-uuid",
    nationality: "Colombian",
    dance_started_year: 2018,
    favorite_styles: ["Bachata Sensual"],
    favorite_songs: ["Song A", "Song B"],
    achievements: ["Champion 2024"],
    dance_role: "Lead and Follow",
    looking_for_partner: true,
    partner_search_role: "Any",
    partner_search_level: ["Improver"],
    partner_practice_goals: ["Socials"],
    partner_details: "Weeknights in Angel",
    instagram: "https://instagram.com/maya",
    website_url: "https://maya.example",
    avatar_url: "dancers/maya.jpg",
  };

  const blankWizard = {
    photo_url: "",
    city: "",
    nationality: "",
    experience_level: "",
    dancing_start_date: "",
    favorite_styles: [] as string[],
    partner_role: "",
    favorite_songs_text: "",
    achievements_text: "",
    looking_for_partner: false,
    partner_search_role: "",
    partner_search_level: [] as string[],
    partner_practice_goals: [] as string[],
    partner_details: "",
    instagram: "",
    facebook: "",
    whatsapp: "",
    website: "",
  };

  it("fills an untouched wizard from the stored row, so the user can SEE what a submit would clear", () => {
    // The blanket reset this replaces was gated on completeness, so a row with
    // sidecar content but no basics stayed unhydrated -- the wizard showed empty
    // lists and submitting DELETED them, because [] is a real value to the
    // sidecar arm. One live row was in that state when this was written.
    const merged = mergeStoredDancerIntoWizardForm(blankWizard, stored, NOTHING_TOUCHED);
    expect(merged.favorite_styles).toEqual(["Bachata Sensual"]);
    expect(merged.favorite_songs_text).toBe("Song A\nSong B");
    expect(merged.achievements_text).toBe("Champion 2024");
    expect(merged.partner_details).toBe("Weeknights in Angel");
    expect(merged.partner_search_level).toEqual(["Improver"]);
    expect(merged.partner_practice_goals).toEqual(["Socials"]);
    expect(merged.city).toBe("city-uuid");
  });

  it("never overwrites an answer the user has already given", () => {
    // This is why the gate existed: a blanket reset discarded the pre-auth draft
    // restored from localStorage, and the user watched their answers vanish on
    // sign-in. The merge keeps both properties at once.
    const typed = {
      ...blankWizard,
      city: "typed-city",
      nationality: "British",
      favorite_styles: ["Salsa On2"],
      partner_details: "Only Sundays",
      partner_search_level: ["Advanced"],
      favorite_songs_text: "My Song",
    };
    const merged = mergeStoredDancerIntoWizardForm(typed, stored, new Set(Object.keys(typed).filter((k) => k in TOUCHED_BY_USER)));
    expect(merged.city).toBe("typed-city");
    expect(merged.nationality).toBe("British");
    expect(merged.favorite_styles).toEqual(["Salsa On2"]);
    expect(merged.partner_details).toBe("Only Sundays");
    expect(merged.partner_search_level).toEqual(["Advanced"]);
    expect(merged.favorite_songs_text).toBe("My Song");
  });

  it("lets a deliberately-OFF switch stay off, rather than restoring the stored true", () => {
    // `current || stored` could not tell "unanswered" from "answered no": a user
    // who turned partner mode OFF had it forced back on and re-persisted.
    const merged = mergeStoredDancerIntoWizardForm(
      { ...blankWizard, looking_for_partner: false },
      stored,
      new Set(["looking_for_partner"]),
    );
    expect(merged.looking_for_partner).toBe(false);
  });

  it("lets a deliberately-EMPTIED list stay empty", () => {
    // Same defect on the list side: emptiness was read as absence, so a returning
    // user could never remove a style or a goal through the wizard.
    const merged = mergeStoredDancerIntoWizardForm(
      { ...blankWizard, favorite_styles: [] },
      stored,
      new Set(["favorite_styles"]),
    );
    expect(merged.favorite_styles).toEqual([]);
  });

  it("still fills an untouched field even when the stored value is falsy-empty", () => {
    const merged = mergeStoredDancerIntoWizardForm(blankWizard, {}, NOTHING_TOUCHED);
    expect(merged.favorite_styles).toEqual([]);
    expect(merged.city).toBe("");
  });

  it("translates the stored role and the stored year on the way in", () => {
    const merged = mergeStoredDancerIntoWizardForm(blankWizard, stored, NOTHING_TOUCHED);
    expect(merged.partner_role).toBe("Both");
    expect(merged.dancing_start_date).toBe("2018-01-01");
  });

  it("hydrates partner_search_role RAW, so an unrecognised value is not turned into a clear", () => {
    expect(mergeStoredDancerIntoWizardForm(blankWizard, stored, NOTHING_TOUCHED).partner_search_role).toBe("Any");
  });

  it("takes avatar_url as the writable column and unwraps a legacy array", () => {
    expect(mergeStoredDancerIntoWizardForm(blankWizard, stored, NOTHING_TOUCHED).photo_url).toBe("dancers/maya.jpg");
    expect(
      mergeStoredDancerIntoWizardForm(blankWizard, { avatar_url: ["a.jpg", "b.jpg"] }, NOTHING_TOUCHED).photo_url,
    ).toBe("a.jpg");
  });

  it("round-trips a merged blank wizard into a payload that clears nothing", () => {
    // The end-to-end property that matters: hydrate, submit untouched, and every
    // stored value comes back out unchanged.
    const merged = mergeStoredDancerIntoWizardForm(blankWizard, stored, NOTHING_TOUCHED);
    const payload = buildCreateProfilePayload(merged, {
      firstName: "Maya",
      surname: "Flow",
      cityId: "city-uuid",
      currentYear: 2026,
    });
    const details = payload.dancer_details as Record<string, unknown>;
    expect(details.favorite_styles).toEqual(["Bachata Sensual"]);
    expect(details.favorite_songs).toEqual(["Song A", "Song B"]);
    expect(details.achievements).toEqual(["Champion 2024"]);
    expect(details.partner_details).toBe("Weeknights in Angel");
    expect(details.partner_search_level).toEqual(["Improver"]);
    expect(details.dance_started_year).toBe(2018);
  });
});
