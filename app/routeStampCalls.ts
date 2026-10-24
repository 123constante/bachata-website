// Test-only (imported by app/cacheTags.test.ts and app/cloudflarePurge.test.ts, never by the app):
// the cache-tag stamp calls each route module REALLY makes, read from its source, so the
// conformance tests check what routes stamp, not only the hand-kept ALL_ROUTE_STAMPS (People arc S7c).
import { readFileSync } from "node:fs";
import { join } from "node:path";
import routes from "./routes";
import * as cacheTags from "./cacheTags";

export type StampHelper = (id: string, withRoleTags?: boolean) => string;
export interface RouteStampCall {
  /** Route path as registered, e.g. "/dancers/:id". */
  path: string;
  /** Route module, relative to app/. */
  file: string;
  /** The stamp helper exported by ./cacheTags, e.g. "stampDancer". */
  helper: string;
  stamp: StampHelper;
  /** A second argument (a flag, e.g. stampDancer(id, flags.personWorlds)): both its values are possible. */
  flagged: boolean;
}

// An id-taking stamp call: stampX(<arg>) or stampX(<arg>, <flag>). Zero-argument stamps (static
// page sets) have their own rules (CF_URL_RULES static entries, re-derived in cloudflarePurge.test.ts).
const STAMP_CALL = /\bstamp[A-Z]\w*\(([^,)]+)(,[^)]*)?\)/g;

/** Every id-taking stamp call in every route module. Throws on a stamp-shaped name ./cacheTags does
 *  not export, so a local helper or a typo fails loudly instead of being skipped. */
export function routeStampCalls(): RouteStampCall[] {
  const helpers = cacheTags as unknown as Record<string, unknown>;
  return (routes as { path?: string; file: string }[]).flatMap(({ path, file }) =>
    [...readFileSync(join(__dirname, file), "utf8").matchAll(STAMP_CALL)].map((m) => {
      const helper = m[0].slice(0, m[0].indexOf("("));
      const stamp = helpers[helper];
      if (typeof stamp !== "function") throw new Error(`${file}: ${helper}() is not a stamp helper exported by ./cacheTags`);
      return { path: `/${path ?? ""}`, file, helper, stamp: stamp as StampHelper, flagged: !!m[2] };
    }),
  );
}
