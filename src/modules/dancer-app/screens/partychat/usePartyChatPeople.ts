import { useCallback, useEffect, useRef, useState } from 'react';
import { rpcLoose } from '@/integrations/supabase/rpcLoose';
import { supabase } from '@/integrations/supabase/client';

export type PartyRole = 'organiser' | 'dj' | 'instructor';
export type ChatMember = { profile_id: string; first_name: string | null; avatar_url: string | null; top_role: PartyRole | null; joined_at: string; is_me: boolean };

const str = (v: unknown) => (typeof v === 'string' ? v : null);
const ROLES: PartyRole[] = ['organiser', 'dj', 'instructor'];

export const parseMembers = (data: unknown): ChatMember[] => {
  // RPC shape: {ok, members:[{profile_id, first_name, avatar_url, role, joined_at, is_me}]}; a bare array is also accepted.
  const list = Array.isArray(data) ? data : (data as { members?: unknown } | null)?.members;
  if (!Array.isArray(list)) return [];
  const out: ChatMember[] = [];
  for (const r of list) {
    const d = (r ?? {}) as Record<string, unknown>;
    if (typeof d.profile_id !== 'string' || typeof d.joined_at !== 'string') continue;
    const role = ROLES.find((x) => x === (d.role ?? d.top_role)) ?? null;
    out.push({ profile_id: d.profile_id, first_name: str(d.first_name), avatar_url: str(d.avatar_url), top_role: role, joined_at: d.joined_at, is_me: d.is_me === true });
  }
  return out;
};

/** Members of the chat (RPC, member-only; any failure = no members, never a crash) plus who is online (Realtime presence). */
export const usePartyChatPeople = (chatId: string, enabled: boolean, knownSelfId: string | null) => {
  const [members, setMembers] = useState<ChatMember[]>([]);
  const selfId = knownSelfId ?? members.find((m) => m.is_me)?.profile_id ?? null;
  const [online, setOnline] = useState<Set<string>>(new Set());
  const live = useRef(true);

  const refresh = useCallback(async () => {
    if (!chatId || !enabled) return;
    try {
      const { data, error } = await rpcLoose('get_party_chat_members_v1', { p_chat_id: chatId });
      if (live.current && !error) setMembers(parseMembers(data));
    } catch {
      /* show nothing */
    }
  }, [chatId, enabled]);

  useEffect(() => { live.current = true; return () => { live.current = false; }; }, []);
  // First load as soon as the chat is open; later refetches ride the screen's poll tick.
  useEffect(() => { void refresh(); }, [refresh]);

  useEffect(() => {
    if (!chatId || !enabled) return;
    try {
      const ch = supabase.channel(`party-chat:${chatId}`, selfId ? { config: { presence: { key: selfId } } } : undefined);
      const sync = () => {
        try {
          const state = ch.presenceState() as Record<string, { profile_id?: string }[]>;
          const ids = new Set<string>();
          for (const [key, metas] of Object.entries(state)) {
            for (const m of metas) if (typeof m.profile_id === 'string') ids.add(m.profile_id);
            if (metas.length === 0) ids.add(key);
          }
          if (live.current) setOnline(ids);
        } catch {
          /* everyone stays Others */
        }
      };
      ch.on('presence', { event: 'sync' }, sync).subscribe((status: string) => {
        if (status === 'SUBSCRIBED' && selfId) void ch.track({ profile_id: selfId });
      });
      return () => { void supabase.removeChannel(ch); };
    } catch {
      return undefined;
    }
  }, [chatId, enabled, selfId]);

  return { members, online, refresh, selfId };
};
