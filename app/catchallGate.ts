import { matchPath } from "react-router";
import { CATCHALL_CLIENT_PATHS } from "@/components/catchallClientPaths";

// The HTTP status of a document served by the client-rendered catchall
// (routes/catchall.tsx renders null on the server, so before this gate every
// URL it received answered 200 -- the client NotFound included: a soft 404
// with an unbounded crawl space). Called from entry.server.tsx, NOT from a
// catchall loader: a loader would make every client navigation into a catchall
// page fetch a metered `.data` response (see the cost note in catchall.tsx).
//
//   client page              -> 200
//   /city/<slug>/<listing>   -> 200 if the city is real, else 404
//   /<slug-xx> (legacy city) -> 308 /city/<slug-xx> if the city is real, else 404
//                               (this used to be a BLIND vercel.json redirect,
//                               which sent any made-up path to a 200 city page)
//   anything else            -> 404
//   city lookup fails        -> 503, never a 404 guess about a real city

/** Same pattern the retired vercel.json `/:slug([a-z-]+-[a-z]{2})` redirect used. */
const LEGACY_TOP_LEVEL_CITY_RE = /^\/([a-z-]+-[a-z]{2})\/?$/;

export type CatchallVerdict =
  | { kind: "client" }
  | { kind: "city-subpath"; slug: string }
  | { kind: "legacy-city"; slug: string }
  | { kind: "unknown" };

export function classifyCatchallPath(pathname: string): CatchallVerdict {
  for (const pattern of CATCHALL_CLIENT_PATHS) {
    const m = matchPath({ path: pattern, end: true }, pathname);
    if (!m) continue;
    if (pattern.startsWith("/city/:slug/") && m.params.slug) {
      return { kind: "city-subpath", slug: m.params.slug };
    }
    return { kind: "client" };
  }
  const legacy = LEGACY_TOP_LEVEL_CITY_RE.exec(pathname);
  if (legacy) return { kind: "legacy-city", slug: legacy[1] };
  return { kind: "unknown" };
}

export type CatchallOutcome =
  | { status: 200 | 404 | 503 }
  | { status: 308; location: string };

export const CITY_LOOKUP_TIMEOUT_MS = 3_000;

async function lookupWithDeadline(
  slug: string,
  isRealCity: (slug: string) => Promise<boolean>,
  timeoutMs: number,
): Promise<boolean | "failed"> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      isRealCity(slug),
      new Promise<"failed">((resolve) => {
        timer = setTimeout(() => resolve("failed"), timeoutMs);
      }),
    ]);
  } catch (error) {
    console.error(
      JSON.stringify({
        tag: "catchall-city-lookup-failed",
        slug,
        message: error instanceof Error ? error.message : String(error),
      }),
    );
    return "failed";
  } finally {
    clearTimeout(timer);
  }
}

export async function resolveCatchallOutcome(
  url: URL,
  isRealCity: (slug: string) => Promise<boolean>,
  timeoutMs = CITY_LOOKUP_TIMEOUT_MS,
): Promise<CatchallOutcome> {
  const verdict = classifyCatchallPath(url.pathname);
  if (verdict.kind === "client") return { status: 200 };
  if (verdict.kind === "unknown") return { status: 404 };
  const real = await lookupWithDeadline(verdict.slug, isRealCity, timeoutMs);
  if (real === "failed") return { status: 503 };
  if (!real) return { status: 404 };
  if (verdict.kind === "city-subpath") return { status: 200 };
  return { status: 308, location: `/city/${verdict.slug}${url.search}` };
}
