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
// - One person is "Run by <name>"; more than one is a list; zero is 'empty'.
//   Everyone shows: no cap, no "+N more" (owner decision, P2 brief scope 2).
//
// Input (P2): the public page reads organiser_public_team_v1 and maps its rows
// with teamFromPublicRows() below -- the RPC is the SINGLE source of order
// (its sort_key) and of who may show (hides, opt-outs, inactive profiles).
// buildOrganiserTeam() stays as the pure merge rule the RPC mirrors.
// docs/handover/organiser-team-mapping.md maps every field.
import { ROLE_PAGE_BASE } from '@/modules/person-page/personRoles';

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

  return toList(people);
}

const toList = (people: TeamPerson[]): TeamList => ({
  people,
  mode: people.length === 0 ? 'empty' : people.length === 1 ? 'solo' : 'list',
});

/** One row of organiser_public_team_v1 (already filtered and ordered by the RPC). */
export interface PublicTeamRow {
  person_id: string;
  slug: string | null;
  public_name: string | null;
  avatar_url: string | null;
  sort_key: number;
}

/**
 * organiser_public_team_v1 rows -> the public Team list. The RPC decides who
 * shows and in what order (sort_key: owners, managers, listed by sort_order,
 * name A-Z); this only renders that order. A repeated person_id (the RPC
 * already dedupes) shows once, at its lowest sort_key. A row with no name is
 * dropped. A person links to their dancer page by slug, else by id.
 */
export function teamFromPublicRows(rows: readonly PublicTeamRow[]): TeamList {
  const best = new Map<string, PublicTeamRow>();
  for (const r of rows ?? []) {
    const pid = clean(r.person_id);
    if (!pid || !clean(r.public_name)) continue;
    const prev = best.get(pid);
    if (!prev || r.sort_key < prev.sort_key) best.set(pid, r);
  }
  const people = [...best.values()]
    .sort((a, b) => a.sort_key - b.sort_key)
    .map((r): TeamPerson => {
      const name = clean(r.public_name) as string;
      const key = clean(r.slug) ?? clean(r.person_id) as string;
      return {
        personId: clean(r.person_id) as string,
        name,
        avatarUrl: clean(r.avatar_url),
        href: `${ROLE_PAGE_BASE.dancer}/${encodeURIComponent(key)}`,
        initials: teamInitials(name),
      };
    });
  return toList(people);
}

/** The solo line, "Run by <name>"; null unless exactly one person shows. */
export function runByLine(team: TeamList): string | null {
  return team.mode === 'solo' ? `Run by ${team.people[0].name}` : null;
}
