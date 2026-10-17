import { supabase } from '@/integrations/supabase/client';
import { firstName } from '@/modules/organiser/shared/teamModel';

// organiser_team_browse_people_v1 (pinned 4.3 #10) is not in the generated types; teamRpcApi.ts is
// read-only for this slice, so the browse call lives here behind the same string-named boundary.
type UntypedRpc = { rpc(fn: string, args?: Record<string, unknown>): PromiseLike<{ data: unknown; error: { message: string } | null }> };

export const BROWSE_PAGE = 30;
export const browseQueryKey = (organiserId: string | undefined, limit: number) => ['organiser-team-browse', organiserId, limit] as const;

export type FaceFact = { kind: 'attended'; n: number } | { kind: 'requested' } | { kind: 'dj' } | { kind: 'teacher' } | null;

export interface Face {
  profileId: string;
  name: string;
  photoUrl: string | null;
  fact: FaceFact;
  canAdd: boolean;
}

const str = (v: unknown): string | null => (typeof v === 'string' && v.trim() !== '' ? v.trim() : null);

export function parseFact(raw: unknown): FaceFact {
  if (raw === 'requested' || raw === 'dj' || raw === 'teacher') return { kind: raw };
  if (typeof raw === 'string' && raw.startsWith('attended:')) {
    const n = Number(raw.slice('attended:'.length));
    if (Number.isFinite(n) && n > 0) return { kind: 'attended', n: Math.floor(n) };
  }
  return null;
}

/** Rows -> faces. A row with no id or no name is dropped (a nameless face would be a blank circle); a duplicate id once. */
export function parseFaces(raw: unknown): Face[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const out: Face[] = [];
  for (const row of raw as Record<string, unknown>[]) {
    if (!row || typeof row !== 'object') continue;
    const profileId = str(row.profile_id);
    const name = str(row.display_name);
    if (!profileId || !name || seen.has(profileId)) continue;
    seen.add(profileId);
    out.push({ profileId, name, photoUrl: str(row.photo_url), fact: parseFact(row.fact), canAdd: row.can_add === true });
  }
  return out;
}

export async function fetchBrowsePeople(organiserId: string, limit: number): Promise<Face[]> {
  const { data, error } = await (supabase as unknown as UntypedRpc).rpc('organiser_team_browse_people_v1', { p_organiser_id: organiserId, p_limit: limit });
  if (error) throw error;
  return parseFaces(data);
}

/** The one fact under a face. */
export function factLabel(f: FaceFact): string | null {
  if (!f) return null;
  if (f.kind === 'attended') return f.n === 1 ? 'Came once' : `Came ${f.n} times`;
  if (f.kind === 'requested') return 'Asked to join';
  return f.kind === 'dj' ? 'DJ' : 'Teacher';
}

/** D56: the Invite message, with the account-system's safe attach wording. */
export function inviteMessage(name: string, pageName: string, url: string): string {
  return `${firstName(name)}, join ${pageName} on Bachata Calendar: ${url}. Sign up with the email we have for you and your profile links automatically; otherwise ask us to link it.`;
}

export const shortWallLine = (n: number) => `${n} dancers have an account and a photo so far. Share an invite link to reach the rest.`;
/** Fewer faces than this and the wall says so (three full rows). */
export const SHORT_WALL = 9;
