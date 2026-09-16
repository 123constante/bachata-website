// /api/io-health — RESOURCE ROUTE (loader only, no component). Phase 6 Step 2
// of the Supabase IO Optimization arc (see
// ~/.claude/plans/phase-6-io-health-check-auto-degradation.md). Cheap,
// pollable signal for current Supabase read/IO pressure — CI-only consumer
// for now; nothing in the app auto-acts on this yet (that's Step 3, out of
// scope here and reviewed separately).
//
// Delivered as a framework resource route, NOT a /api/*.ts function — see
// app/routes/api.revalidate.tsx for the full diagnosis of why.
//
// Auth: Bearer IO_HEALTH_SECRET (CI-only; not for public/browser use — the
// underlying scrape returns internal platform metrics).
//
// Queries Supabase's per-project Prometheus scrape
// (`/customer/v1/privileged/metrics`, HTTP Basic Auth with the service-role
// key — see Step 1 in the plan for why this endpoint and not the Management
// API). Result is cached in-memory for CACHE_TTL_MS so repeated polls within
// a function instance's lifetime don't re-hit Supabase on every request —
// the endpoint's own cost must not offset the savings it's meant to protect.
//
// CANDIDATE_SERIES is PROVISIONAL: plan Step 1 explicitly left "which series
// to key off" undecided (candidates: pg_stat disk I/O counters, Supavisor
// connection-pool saturation). This returns raw values for the candidates so
// a human/CI can observe real drift; it does not compute a health verdict or
// threshold — that's part of the still-open design in Step 1/Step 3.
import { timingSafeEqual } from "node:crypto";

import type { Route } from "./+types/api.io-health";

function timingSafeStringEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

const SUPABASE_URL = (process.env.SUPABASE_URL ?? "").replace(/\/$/, "");
const SUPABASE_SERVICE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SERVICE_KEY ?? "";
const IO_HEALTH_SECRET = process.env.IO_HEALTH_SECRET ?? "";

const CACHE_TTL_MS = 60_000;

const CANDIDATE_SERIES = [
  "pg_stat_database_blks_read",
  "pg_stat_database_blks_hit",
  "pg_stat_database_tup_returned",
  "pgbouncer_pools_client_active_connections",
  "pgbouncer_pools_client_waiting_connections",
] as const;

type SeriesSample = { metric: string; labels: string; value: number };

let cache: { at: number; body: unknown } | null = null;

function json(obj: unknown, status: number): Response {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { "content-type": "application/json", "cache-control": "no-store" },
  });
}

// Minimal Prometheus text-exposition-format line parser: `name{labels} value`
// or `name value`. Comments (#) and blank lines are skipped.
function parseCandidates(text: string): SeriesSample[] {
  const out: SeriesSample[] = [];
  for (const line of text.split("\n")) {
    if (!line || line.startsWith("#")) continue;
    const match = /^([a-zA-Z_:][a-zA-Z0-9_:]*)(\{[^}]*\})?\s+(-?[0-9.eE+-]+)(?:\s+-?\d+)?\s*$/.exec(line.trim());
    if (!match) continue;
    const [, metric, labels = "", rawValue] = match;
    if (!CANDIDATE_SERIES.includes(metric as (typeof CANDIDATE_SERIES)[number])) continue;
    const value = Number(rawValue);
    if (Number.isNaN(value)) continue;
    out.push({ metric, labels, value });
  }
  return out;
}

export async function loader({ request }: Route.LoaderArgs): Promise<Response> {
  if (!IO_HEALTH_SECRET || !timingSafeStringEqual(request.headers.get("authorization") ?? "", `Bearer ${IO_HEALTH_SECRET}`)) {
    return json({ ok: false, reason: "unauthorized" }, 401);
  }
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    return json({ ok: false, reason: "misconfigured: missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY" }, 500);
  }

  const now = Date.now();
  if (cache && now - cache.at < CACHE_TTL_MS) {
    return json({ ...(cache.body as Record<string, unknown>), cached: true }, 200);
  }

  let text: string;
  try {
    const auth = Buffer.from(`service_role:${SUPABASE_SERVICE_KEY}`).toString("base64");
    const res = await fetch(`${SUPABASE_URL}/customer/v1/privileged/metrics`, {
      headers: { Authorization: `Basic ${auth}` },
    });
    if (!res.ok) {
      return json({ ok: false, reason: `metrics scrape returned ${res.status}` }, 502);
    }
    text = await res.text();
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return json({ ok: false, reason: `metrics scrape failed: ${msg}` }, 502);
  }

  const series = parseCandidates(text);
  const body = { ok: true, scraped_at: new Date(now).toISOString(), series, cached: false };
  cache = { at: now, body };
  return json(body, 200);
}
