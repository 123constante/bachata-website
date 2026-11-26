// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { setClientSkewCookie } from "./clientSkewCookie";

describe("setClientSkewCookie", () => {
  let writes: string[] = [];
  const spy = () => {
    writes = [];
    vi.spyOn(document, "cookie", "set").mockImplementation((v) => {
      writes.push(v);
    });
  };
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("writes __vdpl with the right attributes when all three are true", () => {
    spy();
    setClientSkewCookie({ enabled: true, deploymentId: "dpl_abc", flagOn: true });
    expect(writes).toEqual(["__vdpl=dpl_abc; Path=/; SameSite=Strict; Secure"]);
  });
  it("writes nothing when the flag is off", () => {
    spy();
    setClientSkewCookie({ enabled: true, deploymentId: "dpl_abc", flagOn: false });
    expect(writes).toEqual([]);
  });
  it("writes nothing when skew protection is disabled", () => {
    spy();
    setClientSkewCookie({ enabled: false, deploymentId: "dpl_abc", flagOn: true });
    expect(writes).toEqual([]);
  });
  it("writes nothing when the deployment id is missing", () => {
    spy();
    setClientSkewCookie({ enabled: true, deploymentId: "", flagOn: true });
    setClientSkewCookie({ enabled: true, deploymentId: undefined, flagOn: true });
    expect(writes).toEqual([]);
  });
});
