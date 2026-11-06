// Dedupe store: at-most-once per key, over an injected issue client (see owner-summary-issue.mjs).
// The issue comment is the system of record; `sent` means only "ntfy accepted it".
import { readMarkers, upsertMarkerComment } from './owner-summary-issue.mjs';

export const STALE_MS = 15 * 60 * 1000;
export const undeliveredKey = (key) => `undelivered:${key}`;

export function createStore({ client, now = () => new Date() }) {
  return {
    /** GO only when no marker exists for the key; writes `pending` BEFORE the caller sends. */
    async begin(key, { text = '' } = {}) {
      const found = (await readMarkers(client)).find((m) => m.key === key);
      if (found) return { decision: 'SKIP', state: found.state };
      await upsertMarkerComment(client, { key, state: 'pending', at: now().toISOString(), text });
      return { decision: 'GO', state: 'pending' };
    },
    /** pending -> sent, with a proof string (the ntfy message id). */
    async commit(key, { proof } = {}) {
      const found = (await readMarkers(client)).find((m) => m.key === key);
      if (!found) throw new Error('commit: no pending marker for key');
      await upsertMarkerComment(client, { key, state: 'sent', at: found.at, proof: proof || 'accepted' }, found);
    },
    /** Lists `pending` markers older than 15 min with no `undelivered` marker; writes ONE per key. */
    async heartbeat({ now: at = now() } = {}) {
      const all = await readMarkers(client);
      const done = new Set(all.filter((m) => m.key.startsWith('undelivered:')).map((m) => m.key));
      const stale = all.filter((m) => m.state === 'pending' && !m.key.startsWith('undelivered:')
        && Number.isFinite(Date.parse(m.at)) && new Date(at).getTime() - Date.parse(m.at) > STALE_MS
        && !done.has(undeliveredKey(m.key)));
      for (const m of stale) {
        await upsertMarkerComment(client, { key: undeliveredKey(m.key), state: 'undelivered', at: new Date(at).toISOString(), text: `Undelivered: ${m.key}` });
      }
      return stale.map((m) => ({ key: m.key, at: m.at }));
    },
    async unsent() {
      return (await readMarkers(client)).filter((m) => m.state !== 'sent' && !m.key.startsWith('undelivered:'));
    },
  };
}
