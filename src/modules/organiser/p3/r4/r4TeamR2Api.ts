import { supabase } from '@/integrations/supabase/client';

// organiser_team_*_v1 (admin organiser_team_r2_people_v1) are live but not in the generated Database type:
// same string-named boundary as claim-link/onboardingStateApi.
type UntypedRpc = {
  rpc(fn: string, args?: Record<string, unknown>): PromiseLike<{ data: unknown; error: { message: string; code?: string } | null }>;
};
const rpc = () => supabase as unknown as UntypedRpc;

export type R4TeamR2Role = 'owner' | 'manager' | 'contributor' | 'door';
export interface R4TeamR2Person {
  userId: string; profileId: string | null; name: string; avatarUrl: string | null; role: R4TeamR2Role;
  canSignIn: boolean; onPublic: boolean; isYou: boolean; doorUntil: string | null; doorExpired: boolean;
}
export interface R4TeamR2Invite { role: string; expiresAt: string | null; createdAt: string | null }
export interface R4TeamR2People { people: R4TeamR2Person[]; invites: R4TeamR2Invite[] }
export interface R4TeamR2Change { at: string; actor: string; person: string; action: string; fromRole: string | null; toRole: string | null }

export const teamR2PeopleKey = (org?: string) => ['organiser-team-r2-people', org] as const;
export const teamR2ChangesKey = (org?: string) => ['organiser-team-r2-changes', org] as const;

const str = (v: unknown): string | null => (typeof v === 'string' && v.trim() ? v : null);
const obj = (v: unknown): Record<string, unknown> => (v && typeof v === 'object' ? (v as Record<string, unknown>) : {});

const ROLES: readonly string[] = ['owner', 'manager', 'contributor', 'door'];

export function parsePeople(raw: unknown): R4TeamR2People {
  const o = obj(raw);
  const people = (Array.isArray(o.people) ? o.people : []).flatMap((p): R4TeamR2Person[] => {
    const r = obj(p);
    const userId = str(r.user_id);
    const role = str(r.role);
    if (!userId || !role || !ROLES.includes(role)) return [];
    return [{
      userId, profileId: str(r.dancer_profile_id), name: str(r.display_name) ?? 'Someone', avatarUrl: str(r.avatar_url),
      role: role as R4TeamR2Role, canSignIn: r.can_sign_in === true, onPublic: r.on_public === true, isYou: r.is_you === true,
      doorUntil: str(r.door_until), doorExpired: r.door_expired === true,
    }];
  });
  const invites = (Array.isArray(o.pending_invites) ? o.pending_invites : []).map((i) => {
    const r = obj(i);
    return { role: str(r.role) ?? '', expiresAt: str(r.expires_at), createdAt: str(r.created_at) };
  });
  return { people, invites };
}

export function parseChanges(raw: unknown): R4TeamR2Change[] {
  return (Array.isArray(raw) ? raw : []).flatMap((c): R4TeamR2Change[] => {
    const r = obj(c);
    const at = str(r.at);
    const action = str(r.action);
    if (!at || !action) return [];
    return [{ at, actor: str(r.actor_name) ?? 'Someone', person: str(r.person_name) ?? 'someone', action, fromRole: str(r.from_role), toRole: str(r.to_role) }];
  });
}

export async function fetchTeamR2People(org: string): Promise<R4TeamR2People> {
  const { data, error } = await rpc().rpc('organiser_team_people_v1', { p_org: org });
  if (error) throw error;
  return parsePeople(data);
}

export async function setTeamR2Switches(org: string, userId: string, canSignIn: boolean, onPublic: boolean): Promise<void> {
  const { error } = await rpc().rpc('organiser_team_set_switches_v1', {
    p_org: org, p_user: userId, p_can_sign_in: canSignIn, p_on_public: onPublic, p_role: null,
  });
  if (error) throw error;
}

/** The RPC raises for anyone but owner/manager: that is `null` (hide the row), not an error. */
export async function fetchTeamR2Changes(org: string, limit = 20): Promise<R4TeamR2Change[] | null> {
  const { data, error } = await rpc().rpc('organiser_team_recent_changes_v1', { p_org: org, p_limit: limit });
  if (error) return null;
  return parseChanges(data);
}
