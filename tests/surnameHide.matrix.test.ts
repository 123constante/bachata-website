import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { DANCER_PUBLIC_COLS, mapDancerPublicProfile } from "@/modules/profile/dancerPublicProfile";
import { mergePublicNames, indexPublicNames, chunkIds, PUBLIC_NAMES_BATCH } from "@/lib/publicDancerNames";
import { renderPublicName } from "@/lib/publicName";
import { personName } from "@/lib/searchRpc";
import { buildFullName } from "@/lib/name-utils";
import { buildSeoForRoute } from "@/lib/seo/buildSeoForRoute";
import { buildDancerProfilePayload } from "@/lib/saveMyDancerProfile";
import { hideSurnameDisabledReason, hideSurnameHelper } from "@/components/profile/HideSurnameSwitch";

/**
 * Surname switch x screens x name shapes. The fake `maskedRpc` mirrors the SQL
 * helpers in admin PR #794 (_public_surname_v1 / _public_display_name_v1 /
 * get_public_dancer_names_v1). It is a MIRROR, not the live function: real DB
 * responses before #794 is applied are NOT verified.
 */
type Raw = { id: string; first_name: string; surname: string | null; display_name: string | null };

const SHAPES: Record<string, Raw> = {
  "with surname (display_name holds the full name)": { id: "a", first_name: "Ana", surname: "Lopez", display_name: "Ana Lopez" },
  "surname but no display_name": { id: "b", first_name: "Ana", surname: "Lopez", display_name: null },
  "no surname": { id: "c", first_name: "Ana", surname: null, display_name: "Ana" },
};

const maskedRpc = (rows: Raw[], hide: boolean) =>
  rows.map((r) => {
    const surname = hide ? null : r.surname;
    const display_name = hide ? r.first_name : r.display_name;
    const public_name = display_name || [r.first_name, surname].filter(Boolean).join(" ") || null;
    return { id: r.id, first_name: r.first_name, surname, display_name, public_name };
  });

/** What every public surface does: merge the RPC names into a row that never carried the columns. */
const masked = (raw: Raw, hide: boolean) => {
  const names = indexPublicNames(maskedRpc([raw], hide));
  const { surname: _s, display_name: _d, ...bare } = raw;
  return mergePublicNames([bare], names)[0];
};

const SURFACES: Record<string, (raw: Raw, hide: boolean) => string> = {
  "person page heading": (raw, hide) => mapDancerPublicProfile(masked(raw, hide) as never).displayName ?? "",
  "line-up credit": (raw, hide) => renderPublicName(masked(raw, hide), "Dancer"),
  "search result": (raw, hide) => personName(masked(raw, hide) as never),
  "teacher/DJ card": (raw, hide) => {
    const r = maskedRpc([raw], hide)[0];
    return buildFullName(r.first_name, r.surname); // Teachers.tsx: hide_surname stays false on purpose
  },
  "og/meta title": (raw, hide) => {
    const name = mapDancerPublicProfile(masked(raw, hide) as never).displayName ?? undefined;
    return buildSeoForRoute("dancer.detail", { entityName: name }).title ?? "";
  },
  "JSON-LD performer name": (raw, hide) => {
    const name = renderPublicName(masked(raw, hide), "Dancer");
    return JSON.stringify({ "@type": "Person", name });
  },
};

describe("surname switch: switch x surface x name shape", () => {
  for (const hide of [false, true]) {
    for (const [shape, raw] of Object.entries(SHAPES)) {
      for (const [surface, render] of Object.entries(SURFACES)) {
        it(`${hide ? "ON " : "OFF"} | ${surface} | ${shape}`, () => {
          const out = render(raw, hide);
          expect(out).toContain("Ana");
          if (hide) expect(out).not.toContain("Lopez");
          else if (raw.surname) expect(out).toContain("Lopez");
        });
      }
    }
  }

  it("the same fact reads the same on every name screen (one shared mapping)", () => {
    for (const hide of [false, true]) {
      for (const raw of Object.values(SHAPES)) {
        const names = ["person page heading", "line-up credit", "search result", "teacher/DJ card"].map((s) =>
          SURFACES[s](raw, hide),
        );
        expect(new Set(names).size).toBe(1);
      }
    }
  });
});

describe("no public read can bypass the mask", () => {
  it("DANCER_PUBLIC_COLS selects neither surname nor display_name", () => {
    expect(DANCER_PUBLIC_COLS).not.toMatch(/\bsurname\b/);
    expect(DANCER_PUBLIC_COLS).not.toMatch(/\bdisplay_name\b/);
  });

  // Own-profile editors read their OWN row; every other file must go through the RPC.
  const PUBLIC_READERS = [
    "src/pages/Dancers.tsx",
    "src/pages/DancerProfile.tsx",
    "src/components/CommunitySpotlight.tsx",
    "src/pages/OrganiserProfile.tsx",
    "src/modules/organiser/dates/peoplePicker.ts",
    "app/routes/sitemap.tsx",
    "app/routes/dancers.tsx",
  ];
  for (const file of PUBLIC_READERS) {
    it(`${file}: no dancer_profiles select lists surname or display_name`, () => {
      const src = readFileSync(file, "utf8");
      const selects = [...src.matchAll(/\.select\(\s*(['"`])([^]*?)\1/g)].map((m) => m[2]);
      for (const sel of selects) {
        expect(sel, `${file} select: ${sel}`).not.toMatch(/\bsurname\b|\bdisplay_name\b/);
      }
    });
  }

  it("PracticePartners' public list does not select surname (its own-row read may)", () => {
    const src = readFileSync("src/pages/PracticePartners.tsx", "utf8");
    const listSelect = [...src.matchAll(/\.select\(\s*'([^']*)'\s*\)\s*\.eq\('dancing_role_details/g)].map((m) => m[1]);
    expect(listSelect.length).toBe(1);
    expect(listSelect[0]).not.toMatch(/\bsurname\b/);
  });

  it("an id the RPC did not return fails closed (no raw surname, no display_name)", () => {
    const out = mergePublicNames([{ id: "zzz", first_name: "Ana" }], new Map())[0];
    expect(out.surname).toBeNull();
    expect(out.display_name).toBeNull();
  });
});

describe("get_public_dancer_names_v1 batching", () => {
  it("dedupes, drops blanks and sends at most 500 ids per call", () => {
    const ids = Array.from({ length: 1201 }, (_, i) => `id-${i}`);
    const chunks = chunkIds([...ids, "id-0", "", null, undefined]);
    expect(chunks.map((c) => c.length)).toEqual([PUBLIC_NAMES_BATCH, PUBLIC_NAMES_BATCH, 201]);
    expect(chunkIds([])).toEqual([]);
  });
  it("tolerates a malformed RPC answer", () => {
    expect(indexPublicNames(null).size).toBe(0);
    expect(indexPublicNames([null, {}, { id: "x", surname: 5 }]).get("x")?.surname).toBeNull();
  });
});

describe("the switch on the own-profile form", () => {
  it("an untouched save sends nothing new; a change sends a JSON boolean", () => {
    expect(buildDancerProfilePayload({})).toEqual({});
    expect(buildDancerProfilePayload({ hide_surname_publicly: undefined })).not.toHaveProperty("hide_surname_publicly");
    expect(buildDancerProfilePayload({ hide_surname_publicly: true }).hide_surname_publicly).toBe(true);
    expect(buildDancerProfilePayload({ hide_surname_publicly: false }).hide_surname_publicly).toBe(false);
    expect(buildDancerProfilePayload({ hide_surname_publicly: null as never })).not.toHaveProperty("hide_surname_publicly");
  });

  const CASES: Array<[string, Parameters<typeof hideSurnameDisabledReason>[0], RegExp | null]> = [
    ["usable", { isSaving: false, firstName: "Ana", cityId: "c1", switchReadable: true }, null],
    ["saving", { isSaving: true, firstName: "Ana", cityId: "c1", switchReadable: true }, /Saving/],
    ["unfinished: no first name", { isSaving: false, firstName: " ", cityId: "c1", switchReadable: true }, /first name and city/],
    ["unfinished: no city", { isSaving: false, firstName: "Ana", cityId: "", switchReadable: true }, /first name and city/],
    ["setting unreadable", { isSaving: false, firstName: "Ana", cityId: "c1", switchReadable: false }, /could not load/],
  ];
  for (const [name, state, re] of CASES) {
    it(`disabled reason: ${name}`, () => {
      const reason = hideSurnameDisabledReason(state);
      if (re === null) expect(reason).toBeNull();
      else expect(reason).toMatch(re);
    });
  }

  it("helper text says what is shown", () => {
    expect(hideSurnameHelper(true)).toContain("sees only your first name");
    expect(hideSurnameHelper(false)).toContain("first name and surname");
  });
});
