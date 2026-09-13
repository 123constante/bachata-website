// /api/analytics/profile-view — RESOURCE ROUTE (action only, POST only).
// Phase 2: Extract profile view analytics from Supabase → Vercel KV.
//
// Accepts POST with { personId, profileType, context, eventId, sessionId, userAgent }
// Stores deduplicated entry in KV: profile-view:{date}:{sessionId}:{personId}
// 30-day TTL, session-per-day deduplication (same logic as Supabase RPC).
//
// Auth: None (public). Validation: required fields only.
// Errors: All fail silently (telemetry must never block navigation).

import type { Route } from "./+types/api.analytics.profile-view";

const ALLOWED_PROFILE_TYPES = new Set([
  'dancer',
  'teacher',
  'dj',
  'organiser',
  'videographer',
  'vendor',
]);

const sanitiseProfileType = (raw: string | null | undefined): string => {
  if (!raw) return 'unknown';
  const lower = String(raw).toLowerCase().trim();
  return ALLOWED_PROFILE_TYPES.has(lower) ? lower : 'unknown';
};

function json(obj: unknown, status: number): Response {
  return new Response(JSON.stringify(obj), {
    status,
    headers: {
      'content-type': 'application/json',
      'cache-control': 'no-store',
    },
  });
}

export async function action({ request }: Route.ActionArgs): Promise<Response> {
  // POST only
  if (request.method !== 'POST') {
    return json({ ok: false, reason: 'POST required' }, 405);
  }

  let body: Record<string, unknown> = {};
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    // Fail silently on parse error
    return json({ ok: true }, 200);
  }

  const personId = body.personId as string | undefined;
  const sessionId = body.sessionId as string | undefined;

  // Require minimal fields; fail silently if missing
  if (!personId || !sessionId) {
    return json({ ok: true }, 200);
  }

  // Extract optional fields
  const profileType = sanitiseProfileType(body.profileType);
  const context = String(body.context ?? '');
  const eventId = (body.eventId as string | null | undefined) ?? null;
  const userAgent = (body.userAgent as string | undefined) ?? '';

  try {
    // Vercel KV client — lazy-loaded only when needed to avoid import
    // errors in local dev before env vars are set.
    const { kv } = await import('@vercel/kv');

    // Key: profile-view:{date}:{sessionId}:{personId} (dedupe by session per day)
    const date = new Date().toISOString().split('T')[0];
    const key = `profile-view:${date}:${sessionId}:${personId}`;

    // Store in KV (30-day expiry)
    await kv.set(
      key,
      {
        personId,
        profileType,
        context,
        eventId,
        timestamp: new Date().toISOString(),
        userAgent,
      },
      { ex: 30 * 24 * 60 * 60 }, // 30 days
    );

    return json({ ok: true }, 200);
  } catch (error) {
    // Fail silently — telemetry errors must never reach the client
    console.error('[analytics/profile-view] KV error:', error);
    return json({ ok: true }, 200);
  }
}
