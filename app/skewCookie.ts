import { createContext, useContext } from "react";

// Head skew pin (2026-11-27 blank-page fix). Cloudflare caches the HTML, so a
// visitor can get a document whose /assets/entry.client-<hash>.js belongs to an
// older deployment; unpinned, that URL 404s, no JS runs, the page stays blank.
// Vercel serves the old deployment's assets when the request carries the
// __vdpl cookie, and every JS fetch (modulepreload, entry, manifest, relative
// chunk imports) sends it. Edge-cached documents cannot carry Set-Cookie, and
// entry.client is too late (it is the file that 404s), so an inline script,
// first in <head>, writes the cookie for the deployment that RENDERED this
// HTML before the browser requests any script.
//
// Kill switch: env HEAD_SKEW_COOKIE=off (server runtime).
export function skewCookieScript(opts: {
  enabled: boolean;
  deploymentId: string | undefined;
  killSwitch?: string | undefined;
}): string {
  if (!opts.enabled || !opts.deploymentId || opts.killSwitch === "off") return "";
  if (!/^[A-Za-z0-9_-]+$/.test(opts.deploymentId)) return "";
  return `document.cookie="__vdpl=${opts.deploymentId}; Path=/; SameSite=Lax; Secure";`;
}

// Server sets the script per process; absent on the client (the browser keeps
// the SSR script text, React does not re-emit it).
const SkewCookieContext = createContext<string>("");
export const SkewCookieProvider = SkewCookieContext.Provider;
export const useSkewCookieScript = (): string => useContext(SkewCookieContext);
