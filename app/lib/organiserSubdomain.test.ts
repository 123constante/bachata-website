import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  organiserHostServable,
  organiserSubdomainLinksEnabled,
  organiserSubdomainOrigin,
} from "./organiserSubdomain";

const eventRef = vi.fn();
const orgRef = vi.fn();
const eventLoader = vi.fn();
const organiserLoader = vi.fn();
vi.mock("@/lib/seo/resolvePublicEventRef", () => ({ resolvePublicEventRef: (...a: unknown[]) => eventRef(...a) }));
vi.mock("@/lib/seo/resolvePublicOrganiserRef", () => ({ resolvePublicOrganiserRef: (...a: unknown[]) => orgRef(...a) }));
vi.mock("../routes/event", () => ({
  default: () => null,
  headers: () => ({}),
  meta: () => [],
  loader: (...a: unknown[]) => eventLoader(...a),
}));
vi.mock("../routes/organiser", () => ({
  default: () => null,
  headers: () => ({}),
  meta: () => [],
  loader: (...a: unknown[]) => organiserLoader(...a),
}));

const req = (host: string) => ({ request: new Request(`https://${host}/`, { headers: { host } }) });
const thrown = async (p: Promise<unknown>) => {
  try {
    await p;
  } catch (e) {
    return e as Response;
  }
  throw new Error("did not throw");
};

describe("organiser sub-address flags", () => {
  it("flag off by default, on only for 'true'", () => {
    expect(organiserSubdomainLinksEnabled({})).toBe(false);
    expect(organiserSubdomainLinksEnabled({ ORGANISER_SUBDOMAIN_LINKS: "true" })).toBe(true);
  });
  it("servable: flag or listed label; reserved labels never", () => {
    expect(organiserHostServable("kiki", {})).toBe(false);
    expect(organiserHostServable("kiki", { ORGANISER_SUBDOMAIN_TEST_LABELS: "a, KIKI" })).toBe(true);
    expect(organiserHostServable("kiki", { ORGANISER_SUBDOMAIN_LINKS: "true" })).toBe(true);
    expect(organiserHostServable("www", { ORGANISER_SUBDOMAIN_LINKS: "true" })).toBe(false);
    expect(organiserHostServable("admin", { ORGANISER_SUBDOMAIN_LINKS: "true" })).toBe(false);
  });
  it("origin", () => expect(organiserSubdomainOrigin("kiki")).toBe("https://kiki.bachatacalendar.co.uk"));
});

describe("index loader on an organiser sub-address", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.unstubAllEnvs();
    eventLoader.mockResolvedValue({ event: true });
    organiserLoader.mockResolvedValue({ locked: false, dehydratedState: {} });
  });

  it("flag off: today's path, no resolver called", async () => {
    const { loader } = await import("../routes/index");
    await loader(req("kiki.bachatacalendar.co.uk"));
    expect(eventRef).not.toHaveBeenCalled();
    expect(orgRef).not.toHaveBeenCalled();
    expect(eventLoader).toHaveBeenCalled();
  });

  it("event label wins over organiser", async () => {
    vi.stubEnv("ORGANISER_SUBDOMAIN_LINKS", "true");
    eventRef.mockResolvedValue({ id: "e1", slug: "kiki" });
    const { loader } = await import("../routes/index");
    await loader(req("kiki.bachatacalendar.co.uk"));
    expect(orgRef).not.toHaveBeenCalled();
    expect(eventLoader).toHaveBeenCalled();
    expect(organiserLoader).not.toHaveBeenCalled();
  });

  it("organiser label serves, tagged for the component", async () => {
    vi.stubEnv("ORGANISER_SUBDOMAIN_LINKS", "true");
    eventRef.mockResolvedValue(null);
    orgRef.mockResolvedValue({ id: "o1", slug: "kiki" });
    const { loader } = await import("../routes/index");
    const res = (await loader(req("kiki.bachatacalendar.co.uk"))) as { organiserLabel: string };
    expect(res.organiserLabel).toBe("kiki");
    expect(organiserLoader).toHaveBeenCalledWith(expect.objectContaining({ params: { id: "kiki" } }));
  });

  it("old organiser label 301s to the current sub-address", async () => {
    vi.stubEnv("ORGANISER_SUBDOMAIN_LINKS", "true");
    eventRef.mockResolvedValue(null);
    orgRef.mockResolvedValue({ id: "o1", slug: "newname" });
    const { loader } = await import("../routes/index");
    const r = await thrown(loader(req("oldname.bachatacalendar.co.uk")) as Promise<unknown>);
    expect(r.status).toBe(301);
    expect(r.headers.get("Location")).toBe("https://newname.bachatacalendar.co.uk/");
  });

  it("neither event nor organiser: today's event path", async () => {
    vi.stubEnv("ORGANISER_SUBDOMAIN_LINKS", "true");
    eventRef.mockResolvedValue(null);
    orgRef.mockResolvedValue(null);
    const { loader } = await import("../routes/index");
    await loader(req("nobody.bachatacalendar.co.uk"));
    expect(eventLoader).toHaveBeenCalled();
  });

  it("reserved labels never resolve", async () => {
    vi.stubEnv("ORGANISER_SUBDOMAIN_LINKS", "true");
    const { loader } = await import("../routes/index");
    await thrown(loader(req("www.bachatacalendar.co.uk")) as Promise<unknown>);
    expect(orgRef).not.toHaveBeenCalled();
    expect(eventRef).not.toHaveBeenCalled();
  });
});
