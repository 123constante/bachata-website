// /api/revalidate — purge a detail page's Vercel edge cache by tag on content
// change. Invoked by the Supabase DB webhook (the apply_aggregate_write_p5 hook
// + the standalone save RPCs) with the entity that changed; maps it to the same
// Vercel-Cache-Tag the route stamped (see app/detailLoader.ts + app/routes/*),
// then soft-invalidates (serve-stale-then-revalidate-in-background, no stampede).
//
// SELF-CONTAINED on purpose (see api/og/*): Vercel's ESM build does not reliably
// resolve sibling helper modules at runtime, so this uses a plain fetch to the
// Vercel REST API with no local imports.
//
// Auth: Bearer REVALIDATE_SECRET (shared with the DB webhook via Supabase Vault).
// POST body: { entityType|entity_type, entityId|entity_id, occurrenceId?, tags?, target? }
//   - entityType + entityId (a UUID) → the tags are derived (mirrors the routes).
//   - tags: string[] — explicit tags, overrides the derived list (bulk/manual).
//   - target: 'production' | 'preview' — omit to purge ALL environments (default).
import type { VercelRequest, VercelResponse } from '@vercel/node';

export const config = { maxDuration: 10 };

const REVALIDATE_SECRET = process.env.REVALIDATE_SECRET ?? '';
const VERCEL_TOKEN = process.env.VERCEL_TOKEN ?? '';
const PROJECT_ID = process.env.VERCEL_PROJECT_ID ?? 'prj_KVXvwOmB4SDFy3HljJqXVgiq6APq';
const TEAM_ID = process.env.VERCEL_TEAM_ID ?? 'team_Id0gAANQpZgZF457VMkqjiRy';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type EntityType = 'event' | 'festival' | 'dancer' | 'dj' | 'teacher' | 'venue';
const VALID_TYPES: ReadonlySet<string> = new Set<EntityType>([
  'event',
  'festival',
  'dancer',
  'dj',
  'teacher',
  'venue',
]);

// entityType → cache tags to invalidate. MUST mirror the tags the routes stamp
// in app/routes/*.tsx (via detailLoader.taggedData). A festival edit hits both
// /festival/:id and /event/:id (same events.id), so purge both surfaces.
function tagsFor(entityType: EntityType, id: string): string[] {
  switch (entityType) {
    case 'festival':
      return [`festival-${id}`, `event-${id}`];
    case 'event':
      return [`event-${id}`];
    case 'dancer':
      return [`dancer-${id}`];
    case 'dj':
      return [`dj-${id}`];
    case 'teacher':
      return [`teacher-${id}`];
    case 'venue':
      return [`venue-${id}`];
    default:
      return [];
  }
}

async function invalidateTags(
  tags: string[],
  target?: string,
): Promise<{ ok: boolean; status: number; body: string }> {
  const params = new URLSearchParams({ projectIdOrName: PROJECT_ID, teamId: TEAM_ID });
  const payload: Record<string, unknown> = { tags };
  if (target) payload.target = target;
  const r = await fetch(`https://api.vercel.com/v1/edge-cache/invalidate-by-tags?${params}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${VERCEL_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const body = await r.text().catch(() => '');
  return { ok: r.ok, status: r.status, body };
}

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  if (req.method !== 'POST') {
    res.status(405).json({ ok: false, reason: 'POST required' });
    return;
  }
  if (!REVALIDATE_SECRET || req.headers['authorization'] !== `Bearer ${REVALIDATE_SECRET}`) {
    res.status(401).json({ ok: false, reason: 'unauthorized' });
    return;
  }
  if (!VERCEL_TOKEN) {
    res.status(500).json({ ok: false, reason: 'VERCEL_TOKEN not configured' });
    return;
  }

  const body = (
    typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body ?? {})
  ) as Record<string, unknown>;

  const entityType = (body.entityType ?? body.entity_type) as string | undefined;
  const entityId = (body.entityId ?? body.entity_id) as string | undefined;
  const target = typeof body.target === 'string' ? body.target : undefined;
  const explicitTags = Array.isArray(body.tags)
    ? (body.tags as unknown[]).filter((t): t is string => typeof t === 'string' && t.length > 0)
    : null;

  // Explicit tags win; otherwise derive from entityType + entityId.
  let tags: string[];
  if (explicitTags && explicitTags.length) {
    tags = explicitTags;
  } else {
    if (!entityType || !VALID_TYPES.has(entityType)) {
      res.status(400).json({ ok: false, reason: 'invalid or missing entityType' });
      return;
    }
    if (!entityId || !UUID_RE.test(entityId)) {
      res.status(400).json({ ok: false, reason: 'invalid or missing entityId (expected UUID)' });
      return;
    }
    tags = tagsFor(entityType as EntityType, entityId);
  }
  if (!tags.length) {
    res.status(400).json({ ok: false, reason: 'no tags to invalidate' });
    return;
  }
  tags = tags.slice(0, 16); // Vercel bulk-invalidate limit is 16 tags/call.

  try {
    const result = await invalidateTags(tags, target);
    if (!result.ok) {
      console.error('[revalidate] purge failed', result.status, result.body);
      // 502 → the DB webhook can safely retry (invalidation is idempotent).
      res.status(502).json({ ok: false, reason: `vercel ${result.status}`, tags });
      return;
    }
    res.status(200).json({ ok: true, tags });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[revalidate] error', msg);
    res.status(502).json({ ok: false, reason: msg });
  }
}
