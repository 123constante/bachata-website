import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { skewCookieScript } from "./skewCookie";

describe("skewCookieScript", () => {
  it("writes the __vdpl cookie for the rendering deployment", () => {
    expect(skewCookieScript({ enabled: true, deploymentId: "dpl_7Xdk" })).toBe(
      'document.cookie="__vdpl=dpl_7Xdk; Path=/; SameSite=Lax; Secure";',
    );
  });

  it("is empty when skew protection is off, the id is missing, or the kill switch is set", () => {
    expect(skewCookieScript({ enabled: false, deploymentId: "dpl_1" })).toBe("");
    expect(skewCookieScript({ enabled: true, deploymentId: undefined })).toBe("");
    expect(skewCookieScript({ enabled: true, deploymentId: "" })).toBe("");
    expect(skewCookieScript({ enabled: true, deploymentId: "dpl_1", killSwitch: "off" })).toBe("");
  });

  it("refuses an id that could break out of the script string", () => {
    expect(skewCookieScript({ enabled: true, deploymentId: 'x";alert(1)//' })).toBe("");
  });
});

describe("root <head> order", () => {
  it("runs the skew cookie script before any <Links/> modulepreload or <Scripts/>", () => {
    const src = readFileSync(new URL("./root.tsx", import.meta.url), "utf8");
    const head = src.slice(src.indexOf("<head>"), src.indexOf("</head>"));
    const cookieAt = head.indexOf("__html: skewScript + STYLESHEET_RELOAD_SCRIPT");
    expect(cookieAt).toBeGreaterThan(-1);
    expect(cookieAt).toBeLessThan(head.indexOf("<Links />"));
    expect(cookieAt).toBeLessThan(head.indexOf("<link "));
  });
});
