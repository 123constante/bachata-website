import { describe, expect, it, vi } from "vitest";

vi.mock("@/App", () => ({ createServerQueryClient: () => ({}) }));
vi.mock("@/modules/person-page/PersonPage", () => ({ default: () => null }));
vi.mock("../detailLoader", () => ({
  resolveEntityInLoader: vi.fn(), throwDetailNotFound: vi.fn(), cacheHeaders: () => ({}),
  taggedData: (d: unknown) => d, redirectUuidToSlug: vi.fn(), normalizeOgImage: () => "og",
}));

import { meta } from "./people";

const run = (person: object, slugOrId = "ana-g") =>
  (meta as unknown as (a: unknown) => Array<Record<string, string>>)({
    data: { person, slugOrId, ogImage: "https://x/og.jpg", dehydratedState: {} },
  });
const find = (tags: Array<Record<string, string>>, k: string, v: string) => tags.find((t) => t[k] === v);

// Owner rule: /people/:id is noindex, canonical points at the strongest role page.
describe("/people/:id meta", () => {
  it.each([
    [["teacher", "dj", "dancer"], "/teachers/ana-g"],
    [["dj", "dancer"], "/djs/ana-g"],
    [["dancer"], "/dancers/ana-g"],
  ])("roles %j -> canonical %s, noindex, named title", (roles, path) => {
    const tags = run({ name: "Ana G", roles });
    expect(find(tags, "rel", "canonical")?.href).toBe(`https://www.bachatacalendar.co.uk${path}`);
    expect(find(tags, "name", "robots")?.content).toBe("noindex,nofollow");
    expect(tags[0].title).toContain("Ana G");
    expect(find(tags, "name", "description")?.content).toContain("Ana G");
  });

  it("no data (not found) is noindex", () => {
    const tags = (meta as unknown as (a: unknown) => Array<Record<string, string>>)({ data: undefined });
    expect(find(tags, "name", "robots")?.content).toBe("noindex,nofollow");
  });
});
