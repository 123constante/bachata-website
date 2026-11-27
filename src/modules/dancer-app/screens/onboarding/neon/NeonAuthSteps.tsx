import { useEffect, useState, type KeyboardEvent } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { ADD_CITY_MESSAGE, dancerMessageUsUrl } from '../../../api/messageUs';
import type { DancerDelta, MyDancerEdit } from '../../../api/types';
import { ROLE_CHOICES } from '../model';

/** Neon Night (D1) look for the pre stage: name, city, lead/follow. Same state and save payloads as NameCard/CityCard/RoleCard (steps.tsx); look only, no auth logic. */

export type NeonAuthProps = { profile: MyDancerEdit; busy: boolean; error: string | null; onSubmit: (delta: DancerDelta) => void };

const Head = ({ title, sub }: { title: string; sub: string }) => (
  <>
    <h2 className="q">{title}</h2>
    <p className="sub" data-testid="onboarding-sub">
      {sub}
    </p>
  </>
);

const Foot = ({ busy, error, disabled, reason, onContinue }: { busy: boolean; error: string | null; disabled: boolean; reason: string; onContinue: () => void }) => (
  <>
    {error ? (
      <p role="alert" className="small" data-testid="onboarding-error">
        {error}
      </p>
    ) : null}
    {disabled ? (
      <p className="small" data-testid="onboarding-reason">
        {reason}
      </p>
    ) : null}
    <button type="button" className="cta" data-testid="onboarding-continue" disabled={disabled || busy} onClick={onContinue}>
      {busy ? 'Saving\u2026' : 'Continue'}
    </button>
  </>
);

export const NameNeon = ({ profile, busy, error, onSubmit }: NeonAuthProps) => {
  const [first, setFirst] = useState(profile.first_name ?? '');
  const ready = first.trim() !== '';
  // The display name is not asked here: it is sent back unchanged so saving never wipes it.
  const submit = () => {
    if (ready && !busy) onSubmit({ first_name: first.trim(), display_name: (profile.display_name ?? '').trim() });
  };
  const onEnter = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== 'Enter') return;
    e.preventDefault();
    submit();
  };
  return (
    <>
      <Head title="What do we call you?" sub="Your first name is enough." />
      <input className="fld" data-testid="onboarding-first-name" aria-label="First name" placeholder="First name" autoComplete="given-name" enterKeyHint="next" value={first} onChange={(e) => setFirst(e.target.value)} onKeyDown={onEnter} />
      <Foot busy={busy} error={error} disabled={!ready} reason="Enter your first name to continue." onContinue={submit} />
    </>
  );
};

type CityRow = { id: string; name: string; country: string };

export const CityNeon = ({ profile, busy, error, onSubmit }: NeonAuthProps) => {
  const [city, setCity] = useState(profile.based_city_id ?? '');
  const [query, setQuery] = useState('');
  const [debounced, setDebounced] = useState('');
  useEffect(() => {
    const t = setTimeout(() => setDebounced(query), 300);
    return () => clearTimeout(t);
  }, [query]);
  // Same live RPC as the real CityPicker (search_cities), not the mockup's 37-city stand-in.
  const { data: rows = [], isFetched } = useQuery({
    queryKey: ['city-search', 'neon', debounced],
    queryFn: async (): Promise<CityRow[]> => {
      const { data, error: e } = await (supabase.rpc as any)('search_cities', { p_query: debounced, p_limit: 20 });
      if (e) throw e;
      return (data || []).map((r: any) => ({ id: r.city_id || r.id, name: r.city_name || r.name, country: r.country_name || '' }));
    },
    staleTime: 1000 * 60 * 5,
  });
  const none = isFetched && rows.length === 0 && debounced.trim() !== '';
  return (
    <>
      <Head title="Where do you dance?" sub="Every city is open. Type to search." />
      <input className="fld" data-testid="onboarding-city-search" aria-label="Search your city" placeholder="Search your city" value={query} onChange={(e) => setQuery(e.target.value)} />
      <div role="radiogroup" aria-label="Your city" className="citylist">
        {rows.map((c) => (
          <button key={c.id} type="button" role="radio" aria-checked={city === c.id} className={city === c.id ? 'opt on' : 'opt'} data-testid={`onboarding-city-${c.id}`} onClick={() => setCity(c.id)}>
            <span className="ic" aria-hidden="true">
              {'\u{1F4CD}'}
            </span>
            <span>
              {c.name}
              {c.country ? <small>{c.country}</small> : null}
            </span>
          </button>
        ))}
      </div>
      <a className="lnk" href={dancerMessageUsUrl(ADD_CITY_MESSAGE)} target="_blank" rel="noopener noreferrer">
        {none ? 'No match. Message us and we add your city' : 'Not listed? Message us and we add your city'}
      </a>
      <Foot busy={busy} error={error} disabled={!city} reason="Pick your city from the list to continue." onContinue={() => onSubmit({ based_city_id: city })} />
    </>
  );
};

const ROLE_ICON: Record<string, string> = { Leader: '\u{1F57A}', Follower: '\u{1F483}', 'Lead and Follow': '\u{1F504}' };

export const RoleNeon = ({ profile, busy, error, onSubmit }: NeonAuthProps) => {
  const [role, setRole] = useState(profile.dance_role);
  return (
    <>
      <Head title="Lead, follow, or both?" sub="Helps partners find you." />
      <div role="radiogroup" aria-label="How you dance">
        {ROLE_CHOICES.map((c) => (
          <button key={c.value} type="button" role="radio" aria-checked={role === c.value} className={role === c.value ? 'opt on' : 'opt'} data-testid={`onboarding-dance-role-${c.value}`} onClick={() => setRole(c.value)}>
            <span className="ic" aria-hidden="true">
              {ROLE_ICON[c.value]}
            </span>
            <span>{c.label}</span>
          </button>
        ))}
      </div>
      <Foot busy={busy} error={error} disabled={!role} reason="Pick Leader, Follower or Both to continue." onContinue={() => role && onSubmit({ dance_role: role })} />
    </>
  );
};
