import { describe, it, expect } from "vitest";
import { meta } from "../raffle-win";

const TOKEN = "s3cr3t-token-123";
const entries = () =>
  (meta as unknown as (a: unknown) => Array<Record<string, string>>)({
    params: { token: TOKEN },
  });
const get = (k: string) =>
  entries().find((e) => e.name === k || e.property === k)?.content;

describe("raffle-win meta", () => {
  it("carries the golden preview values", () => {
    expect(entries().find((e) => "title" in e)?.title).toBe("You won a free night!");
    const d = "Pick your free night at a bachata event. From Ricky at Bachata Calendar.";
    expect(get("description")).toBe(d);
    expect(get("og:description")).toBe(d);
    expect(get("og:title")).toBe("You won a free night!");
    expect(get("og:image:width")).toBe("1200");
    expect(get("og:image:height")).toBe("630");
    expect(get("og:type")).toBe("website");
    expect(get("twitter:card")).toBe("summary_large_image");
  });
  it("og:image is absolute, robots noindex, no token anywhere", () => {
    const img = get("og:image") ?? "";
    expect(img).toMatch(/^https:\/\//);
    expect(img.endsWith("/og-raffle-win.jpg")).toBe(true);
    expect(get("robots")).toContain("noindex");
    expect(entries().some((e) => e.rel === "canonical")).toBe(false);
    expect(JSON.stringify(entries())).not.toContain(TOKEN);
  });
});
