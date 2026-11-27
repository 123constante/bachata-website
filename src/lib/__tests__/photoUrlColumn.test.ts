import { describe, expect, it } from "vitest";
import { toPhotoUrlColumn } from "../photoUrlColumn";

describe("toPhotoUrlColumn (vendors/videographers photo_url is TEXT)", () => {
  it.each([
    [["https://a/x.jpg"], "https://a/x.jpg"],
    [["  https://a/x.jpg  ", "https://a/y.jpg"], "https://a/x.jpg"],
    [["", "  ", "https://a/y.jpg"], "https://a/y.jpg"],
    [[null, undefined], null],
    [[], null],
  ])("%j -> %j", (input, expected) => {
    const out = toPhotoUrlColumn(input);
    expect(out).toBe(expected);
    expect(Array.isArray(out)).toBe(false);
  });
});
