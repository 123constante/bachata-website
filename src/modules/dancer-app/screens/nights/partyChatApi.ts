import { rpcLoose } from '@/integrations/supabase/rpcLoose';
import { getSupabase } from '@/integrations/supabase/getSupabase';

export type PartyCard =
  | { state: 'none' | 'closed'; city_id: string | null; chat_id: string | null; closes_at: string | null }
  | { state: 'in' | 'open'; city_id: string | null; chat_id: string | null; closes_at: string | null };

const STATES = ['none', 'in', 'open', 'closed'];

export const parsePartyCard = (data: unknown): PartyCard | null => {
  if (!data || typeof data !== 'object') return null;
  const d = data as Record<string, unknown>;
  if (typeof d.state !== 'string' || !STATES.includes(d.state)) return null;
  const s = (v: unknown) => (typeof v === 'string' ? v : null);
  return { state: d.state as PartyCard['state'], city_id: s(d.city_id), chat_id: s(d.chat_id), closes_at: s(d.closes_at) };
};

/** get_party_card_v1; null on any failure (the card stays silent). */
export const fetchPartyCard = async (): Promise<PartyCard | null> => {
  const { data, error } = await rpcLoose('get_party_card_v1');
  if (error) return null;
  return parsePartyCard(data);
};

/** register_party_interest_v1: true = joined (or already in); false = failed. */
export const joinParty = async (cityId: string): Promise<{ ok: boolean; error: string | null }> => {
  try {
    const { data, error } = await rpcLoose('register_party_interest_v1', { p_city_id: cityId, p_party_date: null });
    if (error) return { ok: false, error: 'call_failed' };
    const d = (data ?? {}) as { ok?: unknown; error?: unknown };
    if (d.ok === true) return { ok: true, error: null };
    return { ok: false, error: typeof d.error === 'string' ? d.error : 'call_failed' };
  } catch {
    return { ok: false, error: 'call_failed' };
  }
};

export type CityOption = { id: string; name: string };

export const fetchActiveCities = async (): Promise<CityOption[]> => {
  const supabase = await getSupabase();
  const { data, error } = await supabase.from('cities').select('id, name').eq('is_active', true).order('name');
  if (error || !data) return [];
  return (data as { id: string; name: string }[]).filter((c) => c.id && c.name);
};
