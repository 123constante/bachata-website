// /api/analytics/event-view — RESOURCE ROUTE (action only, POST only).
// Phase 2: Extract event view analytics from Supabase → Vercel KV.
//
// Accepts POST with { eventId, source, occurrenceId, sessionId, userAgent }
// Stores deduplicated entry in KV: event-view:{date}:{sessionId}:{eventId}
// 30-day TTL, session-per-day deduplication (same logic as Supabase RPC).
//
// Auth: None (public). Validation: required fields only.
// Errors: All fail silently (telemetry must never block navigation).

import type { Route } from "./+types/api.analytics.event-view";

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

  const eventId = body.eventId as string | undefined;
  const sessionId = body.sessionId as string | undefined;

  // Require minimal fields; fail silently if missing
  if (!eventId || !sessionId) {
    return json({ ok: true }, 200);
  }

  // Extract optional fields
  const source = String(body.source ?? 'public_event_page');
  const occurrenceId = (body.occurrenceId as string | null | undefined) ?? null;
  const userAgent = (body.userAgent as string | undefined) ?? '';

  try {
    // Vercel KV client — lazy-loaded only when needed to avoid import
    // errors in local dev before env vars are set.
    const { kv } = await import('@vercel/kv');

    // Key: event-view:{date}:{sessionId}:{eventId} (dedupe by session per day)
    const date = new Date().toISOString().split('T')[0];
    const key = `event-view:${date}:${sessionId}:${eventId}`;

    // Store in KV (30-day expiry)
    await kv.set(
      key,
      {
        eventId,
        source,
        occurrenceId,
        timestamp: new Date().toISOString(),
        userAgent,
      },
      { ex: 30 * 24 * 60 * 60 }, // 30 days
    );

    return json({ ok: true }, 200);
  } catch (error) {
    // Fail silently — telemetry errors must never reach the client
    console.error('[analytics/event-view] KV error:', error);
    return json({ ok: true }, 200);
  }
}
