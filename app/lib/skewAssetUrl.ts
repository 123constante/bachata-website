import { CHUNK_RELOAD_KEY } from "@/lib/staleChunk";

// First-visit skew pinning. A cookie-less first load during a Vercel alias swap
// can pair HTML from one deployment with /assets/* from the other. Appending
// ?dpl=<deployment id> to the STYLESHEET URLs in the RR manifest pins the
// render-blocking CSS to the deployment that rendered the HTML, so a first
// visit never paints unstyled. JS stays unpinned on purpose: chunks import each
// other by plain relative URL, so a pinned modulepreload would never match the
// real import (double download, no pin); a stale JS chunk is already handled by
// staleChunk's reload. Only when skew protection is on AND an id is known; local
// and preview builds keep plain URLs.

type AssetEntry = {
  module?: string;
  imports?: string[];
  css?: string[];
  clientActionModule?: string;
  clientLoaderModule?: string;
  clientMiddlewareModule?: string;
  hydrateFallbackModule?: string;
  [key: string]: unknown;
};

export type PinnableManifest = {
  entry: AssetEntry;
  routes: Record<string, AssetEntry>;
  [key: string]: unknown;
};

// React Router marks a stylesheet that is ALSO dynamically imported with a
// trailing "#" ("/assets/homeMap-x.css#") so its <link> href never matches
// Vite's preload-helper href. The pin must go BEFORE the fragment, or the
// query lands inside it ("css#?dpl=") and never reaches the server; the "#"
// stays so RR's marker still works.
export function pinAssetUrl(url: string, deploymentId: string): string {
  const hashAt = url.indexOf("#");
  const base = hashAt === -1 ? url : url.slice(0, hashAt);
  const hash = hashAt === -1 ? "" : url.slice(hashAt);
  if (!base.startsWith("/assets/") || /[?&]dpl=/.test(base)) return url;
  return `${base}${base.includes("?") ? "&" : "?"}dpl=${encodeURIComponent(deploymentId)}${hash}`;
}

// CSS only (see the header comment for why JS is left alone).
function pinEntry(entry: AssetEntry, id: string): AssetEntry {
  if (!entry.css) return entry;
  return { ...entry, css: entry.css.map((u) => pinAssetUrl(u, id)) };
}

const cache = new WeakMap<object, PinnableManifest>();

// Returns the manifest unchanged unless both gates are open. The build-wide
// manifest is shared across requests, so the pinned copy is built once.
export function pinManifest<T extends PinnableManifest>(
  manifest: T,
  opts: { enabled: boolean; deploymentId: string | undefined },
): T {
  if (!opts.enabled || !opts.deploymentId) return manifest;
  const hit = cache.get(manifest);
  if (hit) return hit as T;
  const id = opts.deploymentId;
  const routes: Record<string, AssetEntry> = {};
  for (const [rid, r] of Object.entries(manifest.routes)) routes[rid] = pinEntry(r, id);
  const pinned = { ...manifest, entry: pinEntry(manifest.entry, id), routes } as T;
  cache.set(manifest, pinned);
  return pinned;
}

// Inline script, first thing in <head>: a capturing error listener (link load
// errors do not bubble) that reloads ONCE per session when a built stylesheet
// 404s, sharing staleChunk's sessionStorage flag so the two never loop. Runs
// before hydration; the caller stamps it with the request nonce.
export const STYLESHEET_RELOAD_SCRIPT =
  `document.addEventListener("error",function(e){var t=e.target;` +
  `if(!t||t.tagName!=="LINK"||t.rel!=="stylesheet"||(t.getAttribute("href")||"").indexOf("/assets/")!==0)return;` +
  `try{if(sessionStorage.getItem("${CHUNK_RELOAD_KEY}")==="1")return;sessionStorage.setItem("${CHUNK_RELOAD_KEY}","1")}catch(_){}` +
  `location.reload()},true);`;
