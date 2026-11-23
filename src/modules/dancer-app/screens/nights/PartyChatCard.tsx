import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useMyDancerEdit } from '../../api/useMyDancerEdit';
import { fetchActiveCities, fetchPartyCard, joinParty } from './partyChatApi';

const KEY = ['party-card'] as const;
const BTN = 'min-h-[44px] w-full rounded-[12px] px-[12px] text-[15px] font-bold';

/**
 * Party chat S1: the card at the top of Nights (flag VITE_ENABLE_PARTY_CHAT). Mounted only with the
 * flag on, so flag off makes no RPC call. closed / loading / error / no profile = no card.
 */
export const PartyChatCard = () => {
  const { user } = useAuth();
  const qc = useQueryClient();
  const nav = useNavigate();
  const profile = useMyDancerEdit();
  const [picking, setPicking] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const card = useQuery({ queryKey: [...KEY, user?.id ?? null], queryFn: fetchPartyCard, enabled: !!user, retry: false, staleTime: 30_000 });
  const needCities = picking || card.data?.state === 'in' || card.data?.state === 'open';
  const cities = useQuery({ queryKey: ['party-cities'], queryFn: fetchActiveCities, enabled: !!user && needCities, staleTime: 300_000 });

  const c = card.data;
  if (!user || !c || c.state === 'closed') return null;
  const cityName = (id: string | null) =>
    (id && (cities.data?.find((x) => x.id === id)?.name ?? (profile.data?.based_city_id === id ? profile.data.city_name : null))) || null;

  if (c.state === 'in') {
    const n = cityName(c.city_id);
    return (
      <section data-testid="party-card-in" className="grid gap-[6px] rounded-[16px] bg-[var(--da-violet,#7c5cff)] p-[14px] text-[#14101f]">
        <h3 className="m-0 text-[17px] font-extrabold">You&rsquo;re in{n ? ` · ${n}` : ''}</h3>
        <p className="m-0 text-[14px]">The chat opens tonight if enough people join. You&rsquo;ll get a notification.</p>
      </section>
    );
  }
  if (c.state === 'open') {
    const n = cityName(c.city_id);
    return (
      <section data-testid="party-card-open" className="grid gap-[10px] rounded-[16px] border border-[var(--line)] bg-[var(--card)] p-[14px]">
        <h3 className="m-0 text-[17px] font-extrabold">Party chat is open{n ? ` · ${n}` : ''}</h3>
        <button type="button" data-testid="party-open-chat" disabled={!c.chat_id} onClick={() => nav(`/account/party-chat/${c.chat_id}`)} className={`${BTN} bg-[var(--da-violet,#7c5cff)] text-[#14101f]`}>
          Open chat
        </button>
      </section>
    );
  }

  const join = async (cityId: string) => {
    setBusy(true);
    setErr(null);
    const r = await joinParty(cityId);
    setBusy(false);
    if (r.ok || r.error === 'not_today') {
      setPicking(false);
      await qc.invalidateQueries({ queryKey: KEY });
      return;
    }
    setErr('Couldn’t join. Try again.');
  };
  const home = profile.data?.based_city_id ?? null;
  const homeName = profile.data?.city_name ?? null;
  return (
    <section data-testid="party-card-none" className="grid gap-[10px] rounded-[16px] border border-[var(--line)] bg-[var(--card)] p-[14px]">
      <h3 className="m-0 text-[17px] font-extrabold">Pre-party or after-party tonight?</h3>
      <p className="m-0 text-[14px] text-[var(--mut)]">Tap your city if you&rsquo;re up for a pre-party or after-party tonight.</p>
      {!picking && (
        <div className="grid gap-[8px]">
          {home && homeName && (
            <button type="button" data-testid="party-join-home" disabled={busy} onClick={() => void join(home)} className={`${BTN} bg-[var(--da-violet,#7c5cff)] text-[#14101f] disabled:opacity-60`}>
              {homeName}
            </button>
          )}
          <button type="button" data-testid="party-other-city" disabled={busy} onClick={() => setPicking(true)} className={`${BTN} border border-[var(--line)] bg-transparent text-[var(--fg)]`}>
            Other city
          </button>
        </div>
      )}
      {picking && (
        <ul className="m-0 grid list-none gap-[6px] p-0" data-testid="party-city-list">
          {(cities.data ?? []).map((x) => (
            <li key={x.id}>
              <button type="button" data-testid="party-city-row" disabled={busy} onClick={() => void join(x.id)} className={`${BTN} border border-[var(--line)] bg-transparent text-left text-[var(--fg)] disabled:opacity-60`}>
                {x.name}
              </button>
            </li>
          ))}
        </ul>
      )}
      {err && <p role="alert" data-testid="party-error" className="m-0 text-[14px]">{err}</p>}
    </section>
  );
};
