import { describe, it, expect } from "vitest";
import { clientPageMeta } from "../app/clientPageMeta";
import { meta as catchallMeta } from "../app/routes/catchall";
import { meta as nightMeta } from "../app/routes/event-night";

const pick = (tags: Array<Record<string, string>> | null) => ({
  title: tags?.find((t) => "title" in t)?.title ?? null,
  canonical: tags?.find((t) => t.rel === "canonical")?.href ?? null,
  robots: tags?.find((t) => t.name === "robots")?.content ?? null,
});

const O = "https://www.bachatacalendar.co.uk";

describe("site structure S2b: server meta for client pages", () => {
  it.each([
    ["/tonight", "Bachata Tonight in London", `${O}/tonight`, null],
    ["/discounts", "Bachata Organisers With Upcoming Events in London", `${O}/discounts`, null],
    ["/search", "Search", `${O}/search`, "noindex,nofollow"],
    ["/city/bristol-gb/tonight", "Bachata Tonight in Bristol", `${O}/tonight`, null],
    ["/city/bristol-gb/parties", "Bachata Socials & Parties in Bristol", `${O}/parties`, null],
    ["/city/london-gb/classes", "Bachata Classes in London", `${O}/classes`, null],
    ["/city/new-york-us/map", "Bachata Map of New York", `${O}/city/new-york-us/map`, null],
    ["/city/london-gb/calendar", "Bachata London - Events, Classes & Parties Calendar", `${O}/city/london-gb`, null],
    ["/city/london-gb/search", "Search", `${O}/search`, "noindex,nofollow"],
  ])("%s", (path, title, canonical, robots) => {
    const got = pick(clientPageMeta(path));
    expect(got.title).toContain(title);
    expect(got.canonical).toBe(canonical);
    expect(got.robots).toBe(robots);
  });

  it("ignores a trailing slash", () => {
    expect(pick(clientPageMeta("/tonight/")).canonical).toBe(`${O}/tonight`);
  });

  it.each(["/", "/teachers", "/city/london-gb/nope", "/city/london-gb", "/profile", "/City/london-gb/map", "/cities"])(
    "returns null for %s",
    (path) => expect(clientPageMeta(path)).toBeNull(),
  );

  it("catchall falls back to the root defaults for an unknown path", () => {
    const rootMeta = [{ title: "root" }];
    const matches = [{ id: "root", meta: rootMeta }, { id: "routes/catchall", meta: [] }];
    expect(catchallMeta({ location: { pathname: "/profile" }, matches })).toBe(rootMeta);
    expect(pick(catchallMeta({ location: { pathname: "/city/x-gb/map" }, matches }) as never).canonical).toBe(`${O}/city/x-gb/map`);
  });

  it(":night route gives /tonight its own head and keeps [] for unknown paths", () => {
    expect(pick(nightMeta({ location: { pathname: "/tonight" } }) as never).title).toContain("Bachata Tonight in London");
    expect(nightMeta({ location: { pathname: "/whatever" } })).toEqual([]);
  });
});
