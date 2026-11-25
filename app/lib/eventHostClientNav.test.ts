// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it, vi } from "vitest";
import { eventHostLinkTarget, installEventHostLinkForward } from "./eventHostClientNav";

const EV = "unidosflow.bachatacalendar.co.uk";
const WWW = "https://www.bachatacalendar.co.uk";

describe("eventHostLinkTarget", () => {
  it("is null on non-event hosts", () => {
    for (const h of ["www.bachatacalendar.co.uk", "bachatacalendar.co.uk", "x.vercel.app", "localhost:3000"]) {
      expect(eventHostLinkTarget(h, "/")).toBeNull();
      expect(eventHostLinkTarget(h, "/city/london-gb")).toBeNull();
    }
  });
  it("forwards site links to www", () => {
    expect(eventHostLinkTarget(EV, "/")).toBe(`${WWW}/`);
    expect(eventHostLinkTarget(EV, "/parties")).toBe(`${WWW}/parties`);
    expect(eventHostLinkTarget(EV, "/organisers/x")).toBe(`${WWW}/organisers/x`);
    expect(eventHostLinkTarget(EV, "/event/cocoloco?occurrenceId=1a")).toBe(`${WWW}/event/cocoloco?occurrenceId=1a`);
    expect(eventHostLinkTarget(EV, "/venue-entity/9?from=event:2&occ=3")).toBe(
      `${WWW}/venue-entity/9?from=event:2&occ=3`,
    );
    expect(eventHostLinkTarget(EV, `https://${EV}/search?q=bachata`)).toBe(`${WWW}/search?q=bachata`);
  });
  it("leaves the event's own and external links alone", () => {
    for (const href of [
      "/27-nov",
      `https://${EV}/`,
      `https://${EV}/27-nov`,
      "#main-content",
      `${WWW}/parties`,
      "https://bachatalounge.bachatacalendar.co.uk/",
      "https://wa.me/447",
      "",
      null,
    ]) {
      expect(eventHostLinkTarget(EV, href)).toBeNull();
    }
  });
});

describe("installEventHostLinkForward", () => {
  let off: (() => void) | undefined;
  afterEach(() => {
    off?.();
    document.body.innerHTML = "";
    vi.restoreAllMocks();
  });
  const setup = (attrs: string) => {
    const assign = vi.fn();
    vi.spyOn(window, "location", "get").mockReturnValue({ assign } as unknown as Location);
    document.body.innerHTML = `<a href="${attrs}" id="a"><span id="s">x</span></a>`;
    off = installEventHostLinkForward(EV);
    return assign;
  };
  const click = (init: MouseEventInit = {}) => {
    const ev = new MouseEvent("click", { bubbles: true, cancelable: true, button: 0, ...init });
    document.getElementById("s")!.dispatchEvent(ev);
    return ev;
  };
  it("forwards a click on a child of a site link", () => {
    const assign = setup("/parties");
    const ev = click();
    expect(ev.defaultPrevented).toBe(true);
    expect(assign).toHaveBeenCalledWith(`${WWW}/parties`);
  });
  it("ignores night links, target=_blank and modifier clicks", () => {
    let assign = setup("/27-nov");
    expect(click().defaultPrevented).toBe(false);
    expect(assign).not.toHaveBeenCalled();
    off?.();
    assign = setup("/parties");
    document.getElementById("a")!.setAttribute("target", "_blank");
    click();
    expect(assign).not.toHaveBeenCalled();
    document.getElementById("a")!.removeAttribute("target");
    click({ metaKey: true });
    expect(assign).not.toHaveBeenCalled();
  });
});

describe("root.tsx wiring", () => {
  const src = readFileSync("app/root.tsx", "utf8");
  it("installs the forwarder and the programmatic fallback", () => {
    expect(src).toContain("installEventHostLinkForward(");
    expect(src).toContain('parseEventHost(window.location.host).kind === "none"');
    expect(src).toContain("eventHostForwardUrl(window.location.host, pathname, search)");
  });
});
