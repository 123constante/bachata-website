// The organiser public page "Team" list: ONE pure mapping from the people tied
// to an organiser to what a visitor sees. No I/O, no screen imports it yet.
//
// Owner decisions (2026-11-05):
// - One list called "Team", no role labels on the public page.
// - Members: everyone on organiser_team_members (the `listed` source) PLUS every
//   owner and manager of the organiser (entity_members, the `access` source),
//   shown by public name only, never email.
// - Order: owners, managers, then listed people by sort_order, then name A-Z.
//   A person in more than one source appears once, at the best rank.
// - A person links to their dancer page when they have one; else shown, not tappable.
// - A hidden person never appears (hidden in ANY source hides the person).
// - One person is "Run by <name>"; more than one is a list; above
//   TEAM_VISIBLE_CAP the rest go to `overflow` ("+N more"); zero is 'empty'.
//
// Input today: `listed` from the 'organiser-lineup' read (organiser_team_members
// joined to dancer_profiles) and `access` from organiser_team_v1 members with
// role owner/manager. Later: the merged admin RPC sends the same shape.
// docs/handover/organiser-team-mapping.md maps every field.
import { ROLE_PAGE_BASE } from '@/modules/person-page/personRoles';

/** At most this many people show; the rest sit behind "+N more". */
export const TEAM_VISIBLE_CAP = 6;

/** A row of organiser_team_members (with the dancer profile it points at). */
export interface ListedPerson {
  /** The dancer profile id (organiser_team_members.member_profile_id). */
  personId: string;
  name: string | null;
  avatarUrl?: string | null;
  /** The dancer page key (/dancers/<slug>); null or blank = no page to link to. */
  slug?: string | null;
  sortOrder: number | null;
  hidden: boolean;
}

/** An owner or manager of the organiser (entity_members). */
export interface AccessPerson {
  /** The person's dancer profile id when known; without it the row is its own person. */
  personId?: string | null;
  userId: string;
  name: string | null;
  role: 'owner' | 'manager';
  avatarUrl?: string | null;
  slug?: string | null;
  hidden: boolean;
}

export interface TeamInput {
  listed: ListedPerson[];
  access: AccessPerson[];
  cap?: number;
}

export interface TeamPerson {
  /** Stable key: the dancer profile id, else `user:<userId>` for an access row without one. */
  personId: string;
  name: string;
  avatarUrl: string | null;
  href: string | null;
  initials: string;
}

export type TeamMode = 'solo' | 'list' | 'empty';

export interface TeamList {
  people: TeamPerson[];
  overflow: TeamPerson[];
  mode: TeamMode;
}

const RANK = { owner: 0, manager: 1, listed: 2 } as const;

const clean = (v: string | null | undefined): string | null => {
  const t = typeof v === 'string' ? v.trim() : '';
  return t === '' ? null : t;
};

/** "Ana Silva" -> "AS"; one word -> one letter; never splits a surrogate pair; blank -> "?". */
export function teamInitials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  const picked = words.length > 1 ? [words[0], words[words.length - 1]] : words;
  const out = picked.map((w) => Array.from(w)[0] ?? '').join('').toLocaleUpperCase('en-GB');
  return out || '?';
}

interface Source {
  rank: number;
  sortOrder: number | null;
  name: string | null;
  avatarUrl: string | null;
  slug: string | null;
  hidden: boolean;
}

interface Merged {
  key: string;
  rank: number;
  sortOrder: number | null;
  sources: Source[];
}

const byName = (a: string, b: string): number => a.localeCompare(b, 'en-GB', { sensitivity: 'base' });

function compare(a: Merged & { name: string }, b: Merged & { name: string }): number {
  if (a.rank !== b.rank) return a.rank - b.rank;
  if (a.rank === RANK.listed) {
    const sa = a.sortOrder ?? Number.POSITIVE_INFINITY;
    const sb = b.sortOrder ?? Number.POSITIVE_INFINITY;
    if (sa !== sb) return sa < sb ? -1 : 1;
  }
  return byName(a.name, b.name) || (a.key < b.key ? -1 : a.key > b.key ? 1 : 0);
}

/** The people tied to an organiser -> the public Team list. */
export function buildOrganiserTeam(input: TeamInput): TeamList {
  const merged = new Map<string, Merged>();
  const add = (key: string, src: Source) => {
    const m = merged.get(key);
    if (!m) {
      merged.set(key, { key, rank: src.rank, sortOrder: src.sortOrder, sources: [src] });
      return;
    }
    m.sources.push(src);
    if (src.rank < m.rank) m.rank = src.rank;
    // Listed twice: keep the earliest sort_order.
    if (src.rank === RANK.listed && src.sortOrder !== null && (m.sortOrder === null || src.sortOrder < m.sortOrder)) m.sortOrder = src.sortOrder;
  };

  for (const a of input.access ?? []) {
    const pid = clean(a.personId);
    add(pid ?? `user:${a.userId}`, {
      rank: RANK[a.role],
      sortOrder: null,
      name: clean(a.name),
      avatarUrl: clean(a.avatarUrl),
      slug: clean(a.slug),
      hidden: a.hidden === true,
    });
  }
  for (const l of input.listed ?? []) {
    const pid = clean(l.personId);
    if (!pid) continue;
    add(pid, {
      rank: RANK.listed,
      sortOrder: typeof l.sortOrder === 'number' && Number.isFinite(l.sortOrder) ? l.sortOrder : null,
      name: clean(l.name),
      avatarUrl: clean(l.avatarUrl),
      slug: clean(l.slug),
      hidden: l.hidden === true,
    });
  }

  const visible: Array<Merged & { name: string; avatarUrl: string | null; slug: string | null }> = [];
  for (const m of merged.values()) {
    if (m.sources.some((s) => s.hidden)) continue;
    // Best-rank source first; each field from the first source that has it.
    const ordered = [...m.sources].sort((x, y) => x.rank - y.rank);
    const pick = (f: 'name' | 'avatarUrl' | 'slug') => ordered.find((s) => s[f] !== null)?.[f] ?? null;
    const name = pick('name');
    if (!name) continue;
    visible.push({ ...m, name, avatarUrl: pick('avatarUrl'), slug: pick('slug') });
  }
  visible.sort(compare);

  const people: TeamPerson[] = visible.map((v) => ({
    personId: v.key,
    name: v.name,
    avatarUrl: v.avatarUrl,
    href: v.slug ? `${ROLE_PAGE_BASE.dancer}/${encodeURIComponent(v.slug)}` : null,
    initials: teamInitials(v.name),
  }));

  const cap = typeof input.cap === 'number' && Number.isFinite(input.cap) && input.cap >= 1 ? Math.floor(input.cap) : TEAM_VISIBLE_CAP;
  return {
    people: people.slice(0, cap),
    overflow: people.slice(cap),
    mode: people.length === 0 ? 'empty' : people.length === 1 ? 'solo' : 'list',
  };
}

/** The solo line, "Run by <name>"; null unless exactly one person shows. */
export function runByLine(team: TeamList): string | null {
  return team.mode === 'solo' ? `Run by ${team.people[0].name}` : null;
}
