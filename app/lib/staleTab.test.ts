// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { checkStaleTab, idsDiffer, isStaleTab, resetStaleTab, staleReloadTarget, startStaleTabChecker } from "./staleTab";

const ok = (id: unknown) => vi.fn().mockResolvedValue({ json: async () => ({ id }) }) as unknown as typeof fetch;
afterEach(() => resetStaleTab());

describe("staleTab", () => {
  it("differing id -> stale", async () => {
    await checkStaleTab("dpl_old", ok("dpl_new"));
    expect(isStaleTab()).toBe(true);
  });
  it("same id -> not stale", async () => {
    await checkStaleTab("dpl_a", ok("dpl_a"));
    expect(isStaleTab()).toBe(false);
  });
  it("empty id either side -> not stale", async () => {
    await checkStaleTab("dpl_a", ok(""));
    await checkStaleTab("", ok("dpl_b"));
    expect(isStaleTab()).toBe(false);
    expect(idsDiffer(undefined, "x")).toBe(false);
  });
  it("fetch error -> not stale", async () => {
    await checkStaleTab("dpl_a", vi.fn().mockRejectedValue(new Error("x")) as unknown as typeof fetch);
    expect(isStaleTab()).toBe(false);
  });
  it("fetch uses credentials omit", async () => {
    const f = ok("dpl_a");
    await checkStaleTab("dpl_a", f);
    expect(f).toHaveBeenCalledWith("/api/version", { credentials: "omit", cache: "no-store" });
  });
  it("flag off -> no fetch", () => {
    const f = ok("dpl_b");
    const stop = startStaleTabChecker({ flagOn: false, deploymentId: "dpl_a", fetchFn: f });
    document.dispatchEvent(new Event("visibilitychange"));
    stop();
    expect(f).not.toHaveBeenCalled();
  });
  it("flag on -> fetches when tab becomes visible", () => {
    const f = ok("dpl_a");
    const stop = startStaleTabChecker({ flagOn: true, deploymentId: "dpl_a", fetchFn: f });
    document.dispatchEvent(new Event("visibilitychange"));
    stop();
    expect(f).toHaveBeenCalledTimes(1);
  });
  it("loading nav while stale -> reload target; form submission -> never", () => {
    const location = { pathname: "/a", search: "?b=1", hash: "#c" };
    expect(staleReloadTarget({ state: "loading", location }, true)).toBe("/a?b=1#c");
    expect(staleReloadTarget({ state: "loading", location }, false)).toBeNull();
    expect(staleReloadTarget({ state: "loading", formMethod: "POST", location }, true)).toBeNull();
    expect(staleReloadTarget({ state: "idle" }, true)).toBeNull();
  });
});
