// Pinned-issue comment writer for owner-summary markers. Takes an INJECTED client
// { list(): Promise<[{id,body}]>, create(body): Promise<{id}>, edit(id, body): Promise<void> }.
// No gh, no network in this module.

const MARKER_RE = /<!-- owner-summary key=(\S+) state=(pending|sent|undelivered)(?: at=(\S+))?(?: proof=([^\s>]*))? -->/;

const safe = (s) => String(s ?? '').replace(/[\s<>]/g, '_').slice(0, 120);

export function renderMarker({ key, state, at, proof }) {
  if (/[\s<>]/.test(String(key))) throw new Error('marker key has forbidden characters');
  return `<!-- owner-summary key=${key} state=${state}${at ? ` at=${at}` : ''}${proof ? ` proof=${safe(proof)}` : ''} -->`;
}

export function parseMarker(body) {
  const m = MARKER_RE.exec(String(body ?? ''));
  return m ? { key: m[1], state: m[2], at: m[3] || null, proof: m[4] || null } : null;
}

export async function readMarkers(client) {
  const out = [];
  for (const c of await client.list()) {
    const mk = parseMarker(c.body);
    if (mk) out.push({ ...mk, id: c.id, body: c.body });
  }
  return out;
}

/** Found-or-edited: one comment per key, state edited in place. */
export async function upsertMarkerComment(client, { key, state, at, proof, text = '' }, existing) {
  const found = existing ?? (await readMarkers(client)).find((m) => m.key === key);
  const marker = renderMarker({ key, state, at, proof });
  if (found) {
    await client.edit(found.id, found.body.replace(MARKER_RE, () => marker));
    return found.id;
  }
  // Marker FIRST: parseMarker takes the first match, so text can never shadow it.
  return (await client.create(`${marker}${text ? `\n\n${text}` : ''}`)).id;
}

/** Plain comment (digest, approval list). */
export async function postPlainComment(client, body) {
  return (await client.create(String(body))).id;
}
