import { describe, expect, it } from "vitest";
import { DECORATIVE_FONTS_HREF, scheduleDecorativeFonts } from "./decorativeFonts";

// Node environment: a minimal fake document/window is enough to pin the
// readyState contract without jsdom.
function fakes(readyState: DocumentReadyState) {
  const appended: { rel: string; href: string }[] = [];
  const listeners: { type: string; fn: () => void; opts: unknown }[] = [];
  const doc = {
    readyState,
    createElement: () => ({ rel: "", href: "" }),
    head: { appendChild: (el: { rel: string; href: string }) => appended.push(el) },
    querySelector: (sel: string) => appended.find((l) => sel.includes(l.href)) ?? null,
  };
  const win = {
    addEventListener: (type: string, fn: () => void, opts: unknown) => listeners.push({ type, fn, opts }),
  };
  const run = () => scheduleDecorativeFonts(doc as unknown as Document, win as unknown as Window);
  return { appended, listeners, run };
}

describe("scheduleDecorativeFonts", () => {
  it("injects immediately when load has already fired (the prod /parties race)", () => {
    const f = fakes("complete");
    f.run();
    expect(f.appended).toEqual([{ rel: "stylesheet", href: DECORATIVE_FONTS_HREF }]);
    expect(f.listeners).toHaveLength(0);
  });

  it.each(["loading", "interactive"] as const)("defers to the load event at readyState %s", (rs) => {
    const f = fakes(rs);
    f.run();
    expect(f.appended).toHaveLength(0);
    expect(f.listeners.map((l) => l.type)).toEqual(["load"]);
    f.listeners[0].fn();
    expect(f.appended).toEqual([{ rel: "stylesheet", href: DECORATIVE_FONTS_HREF }]);
  });

  it("does not inject a second stylesheet if run twice", () => {
    const f = fakes("complete");
    f.run();
    f.run();
    expect(f.appended).toHaveLength(1);
  });

  it("requests the Cormorant and Manrope families", () => {
    expect(DECORATIVE_FONTS_HREF).toContain("family=Cormorant+Garamond");
    expect(DECORATIVE_FONTS_HREF).toContain("family=Manrope");
  });
});
