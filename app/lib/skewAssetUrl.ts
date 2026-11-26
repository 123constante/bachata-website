import { CHUNK_RELOAD_KEY } from "@/lib/staleChunk";

// First-visit skew pinning. A cookie-less first load during a Vercel alias swap
// can pair HTML from one deployment with /assets/* from the other. Appending
// ?dpl=<deployment id> to every built asset URL in the RR manifest pins each
// request (stylesheet, modulepreload, script, and the manifest the client
// carries) to the deployment that rendered the HTML. Only when skew protection
// is on AND an id is known; local and preview builds keep plain URLs.

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

export function pinAssetUrl(url: string, deploymentId: string): string {
  if (!url.startsWith("/assets/") || /[?&]dpl=/.test(url)) return url;
  return `${url}${url.includes("?") ? "&" : "?"}dpl=${encodeURIComponent(deploymentId)}`;
}

const SINGLE_KEYS = [
  "module",
  "clientActionModule",
  "clientLoaderModule",
  "clientMiddlewareModule",
  "hydrateFallbackModule",
] as const;

function pinEntry(entry: AssetEntry, id: string): AssetEntry {
  const out: AssetEntry = { ...entry };
  for (const k of SINGLE_KEYS) {
    const v = entry[k];
    if (typeof v === "string") out[k] = pinAssetUrl(v, id);
  }
  if (entry.imports) out.imports = entry.imports.map((u) => pinAssetUrl(u, id));
  if (entry.css) out.css = entry.css.map((u) => pinAssetUrl(u, id));
  return out;
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
