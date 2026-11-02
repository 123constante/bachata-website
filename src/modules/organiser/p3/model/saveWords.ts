/**
 * The save confirmations, as a function of the event's lifecycle_status (event_series_p5; written by the
 * owner lifecycle commands and the admin console). Prod values today: archived 653, live 69, ended 21,
 * draft 14, paused 2. Only `live` may say dancers see it now. Draft says they do not yet; paused says
 * they do not while it is paused; ended, archived, cancelled, null and anything unknown say nothing about
 * dancers at all (no claim we cannot back). One mapping, every screen calls it.
 */
type Tone = 'live' | 'draft' | 'paused' | 'silent';

export function toneOf(lifecycle: string | null | undefined): Tone {
  if (lifecycle === 'live') return 'live';
  if (lifecycle === 'draft') return 'draft';
  if (lifecycle === 'paused') return 'paused';
  return 'silent';
}

export interface SaveWords {
  savedEvery: string;
  savedDate: (day: string) => string;
  addedEvery: string;
  addedDate: (day: string) => string;
  detailsSaved: string;
  prices: string;
}

export function saveWordsFor(lifecycle: string | null | undefined): SaveWords {
  const t = toneOf(lifecycle);
  // [what was saved] + [how dancers stand], one sentence each
  const s = (what: string, they: string): string => {
    if (t === 'live') return `${what}. Dancers see ${they} now.`;
    if (t === 'draft') return `${what} as a draft. Dancers do not see ${they} yet.`;
    if (t === 'paused') return `${what}. It is paused, so dancers do not see ${they}.`;
    return `${what}.`;
  };
  return {
    savedEvery: s('Saved for every date', 'it'),
    savedDate: (day) => s(`Saved for ${day} only`, 'it'),
    addedEvery: s('Session added to every date', 'it'),
    addedDate: (day) => s(`Added to ${day} only`, 'it'),
    detailsSaved: s('Saved for every date', 'it'),
    prices: s('Prices saved', 'them'),
  };
}
