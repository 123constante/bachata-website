import { useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { AvatarUpload } from '@/components/profile/AvatarUpload';
import { DanceRolePicker } from '@/components/profile/DanceRolePicker';
import { cn } from '@/lib/utils';
import type { DanceRoleValue } from '@/lib/auth-otp-routing';
import { finishScreenNotice, type ProfileCompletion, type ProfileField } from '@/lib/profileCompletion';
import { saveMyDancerProfile, type SaveMyDancerProfileInput } from '@/lib/saveMyDancerProfile';
import { searchCities, type CityResult } from '../citySearch';
import { useDebounced } from '../../../ui/useDebounced';
import { fetchChipCities, fetchCityExists, submitCityRequest } from './dancer4Api';
import {
  CITY_NOT_FOUND_LABEL,
  CITY_REQUESTED_NOTE,
  CITY_REQUEST_FAILED,
  CITY_SEARCH_FAILED,
  EMPTY_ANSWERS,
  NO_PREFILL,
  SAVE_FAILED,
  STEP_COPY,
  buildDancer4Save,
  disabledReason,
  normaliseCityRequest,
  planDancer4,
  progressLabel,
  type Answers,
  type DancerPrefill,
} from './dancer4Model';
import { clearInvitePrefill } from '@/lib/invitePrefill';

export interface Dancer4FlowProps {
  /** The fields the profile is missing (profile completion), read once when the flow opens. */
  missing: readonly ProfileField[];
  /** The caller's dancer profile id (the photo is stored under it). */
  profileId: string;
  /** From the invite (bound link, proven mailbox); NO_PREFILL otherwise. */
  prefill?: DancerPrefill;
  /** Re-asks the server after the last save. */
  refetch: () => Promise<ProfileCompletion>;
  /** The profile is complete: leave the flow. */
  onDone: () => void;
}

const PILL = 'w-full min-h-[44px] rounded-full font-semibold';
const CHIP = 'min-h-[44px] rounded-full border px-4 text-[14px] font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary';
const chipTone = (on: boolean) => (on ? 'border-primary bg-primary text-black' : 'border-border bg-secondary text-foreground hover:border-primary/60');

type CityPick = { id: string; name: string };

/**
 * Dancer 4, one question per screen: first name, city, lead or follow, photo.
 * The same four fields as the Finish screen (profile_complete_v1), the same
 * save path (save_my_dancer_profile); answered or prefilled questions are not
 * asked. Each Next saves what it has, so a refresh keeps the progress.
 */
export function Dancer4Flow(props: Dancer4FlowProps) {
  const { missing, prefill = NO_PREFILL } = props;
  // A prefilled city is only trusted once it is known to exist; unknown or unverifiable -> the question is asked.
  const checkCity = missing.includes('based_city_id') && !!prefill.city_id;
  const cityCheck = useQuery({
    queryKey: ['dancer4-prefill-city', prefill.city_id],
    queryFn: () => fetchCityExists(prefill.city_id as string),
    enabled: checkCity,
    retry: false,
    staleTime: 60_000,
  });
  if (checkCity && cityCheck.isPending) return <p className="text-sm text-muted-foreground" role="status" data-testid="dancer4-checking">Loading&hellip;</p>;
  const trusted: DancerPrefill = checkCity && cityCheck.data !== true ? { ...prefill, city_id: null } : prefill;
  return <Dancer4Questions {...props} prefill={trusted} />;
}

function Dancer4Questions({ missing, profileId, prefill = NO_PREFILL, refetch, onDone }: Dancer4FlowProps) {
  // Planned once, replanned only when a prefilled answer is dropped: the steps must not shift under the person.
  const [plan, setPlan] = useState(() => planDancer4(missing, prefill));
  const [idx, setIdx] = useState(0);
  const [answers, setAnswers] = useState<Answers>(() => ({ ...EMPTY_ANSWERS, ...plan.defaults, ...plan.prefilled }));
  const [city, setCity] = useState<CityPick | null>(null);
  const [cityRequested, setCityRequested] = useState<string | null>(null);
  const sent = useRef<Partial<Record<ProfileField, string>>>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const field = plan.steps[idx] as ProfileField | undefined;
  const firstName = answers.first_name.trim() || null;

  const set = (key: ProfileField, value: string) => setAnswers((prev) => ({ ...prev, [key]: value }));

  // Everything the person has settled so far: prefilled fields plus the steps up to here. True when it landed.
  // 'replanned': a prefilled answer was refused, so it is dropped and its question is now one of the steps.
  const persist = async (upTo: number): Promise<'ok' | 'failed' | 'replanned'> => {
    const prefilledKeys = Object.keys(plan.prefilled) as ProfileField[];
    const fields = [...prefilledKeys, ...plan.steps.slice(0, upTo + 1)];
    const body = buildDancer4Save(fields, answers, sent.current);
    setSaving(true);
    setError(null);
    try {
      if (body) {
        try {
          await saveMyDancerProfile(body as SaveMyDancerProfileInput);
          Object.assign(sent.current, body);
          return 'ok';
        } catch (e) {
          const unsent = prefilledKeys.filter((k) => k in body);
          if (unsent.length === 0) throw e;
          // The invite's prefill is the likely culprit (stale or refused id): save what the person gave without
          // it, then ask the dropped question. If that fails too it was the connection, not the prefill.
          const rest = Object.fromEntries(Object.entries(body).filter(([k]) => !unsent.includes(k as ProfileField)));
          if (Object.keys(rest).length > 0) {
            await saveMyDancerProfile(rest as SaveMyDancerProfileInput);
            Object.assign(sent.current, rest);
          }
        }
      }
      if (!prefilledKeys.some((k) => !(k in sent.current))) return 'ok';
      // Only reached after the fallback above: replan with the dropped fields asked.
      const dropped = prefilledKeys.filter((k) => !(k in sent.current));
      const fresh = planDancer4(missing.filter((f) => !(f in sent.current) || dropped.includes(f)), NO_PREFILL);
      const current = plan.steps[Math.min(upTo, plan.steps.length - 1)];
      const nextSteps = fresh.steps.filter((f) => !(f in sent.current));
      setPlan({ ...fresh, steps: nextSteps, prefilled: {}, defaults: {} });
      setAnswers((prev) => ({ ...prev, ...Object.fromEntries(dropped.map((k) => [k, ''])) }));
      const target = nextSteps.indexOf(dropped[0]);
      setIdx(target >= 0 ? target : Math.max(0, nextSteps.indexOf(current)));
      return 'replanned';
    } catch {
      setError(SAVE_FAILED);
      return 'failed';
    } finally {
      setSaving(false);
    }
  };

  // The last save, then the server's word on whether the profile is now complete.
  const finish = async (upTo: number) => {
    if ((await persist(upTo)) !== 'ok') return;
    try {
      const fresh = await refetch();
      if (fresh.status === 'complete') {
        clearInvitePrefill();
        onDone();
        return;
      }
      setError(finishScreenNotice(fresh, true));
    } catch {
      setError(SAVE_FAILED);
    }
  };

  const next = async () => {
    if (!field || saving) return;
    if (idx >= plan.steps.length - 1) await finish(idx);
    else if ((await persist(idx)) === 'ok') setIdx(idx + 1);
  };

  // Every question was answered by the invite: save it and finish, nothing to ask.
  const autoRan = useRef(false);
  useEffect(() => {
    if (plan.steps.length > 0 || autoRan.current) return;
    autoRan.current = true;
    void finish(-1);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (!field) {
    return (
      <div className="space-y-3" data-testid="dancer4-finalising" role="status">
        <p className="text-sm text-muted-foreground">{error ?? 'Saving\u2026'}</p>
        {error && <Button className={PILL} onClick={() => void finish(-1)} disabled={saving}>Try again</Button>}
      </div>
    );
  }

  const copy = STEP_COPY[field];
  const reason = disabledReason(field, answers, cityRequested !== null);
  const isLast = idx === plan.steps.length - 1;

  return (
    <form
      className="space-y-3"
      data-testid="dancer4"
      data-step={field}
      onSubmit={(e) => {
        e.preventDefault();
        if (!reason) void next();
      }}
    >
      <div className="flex items-center gap-2">
        {idx > 0 ? (
          <button type="button" aria-label="Back" className="flex h-[44px] w-[44px] items-center justify-center rounded-full" onClick={() => { setError(null); setIdx(idx - 1); }} data-testid="dancer4-back">
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          </button>
        ) : null}
        <div className="flex-1">
          <p className="text-[12px] text-muted-foreground" data-testid="dancer4-progress">{progressLabel(idx, plan.steps.length)}</p>
          <div className="mt-1 flex gap-1" aria-hidden="true">
            {plan.steps.map((s, i) => <i key={s} className={cn('h-1 flex-1 rounded-full', i <= idx ? 'bg-primary' : 'bg-border')} />)}
          </div>
        </div>
      </div>

      <h2 className="text-base font-bold text-foreground" data-testid="dancer4-title">{copy.title}</h2>
      <p className="text-sm text-muted-foreground">{copy.why}</p>

      {field === 'first_name' && (
        <Input
          autoFocus
          autoComplete="given-name"
          aria-label="First name"
          placeholder="Your first name"
          className="min-h-[44px] text-[16px]"
          value={answers.first_name}
          onChange={(e) => set('first_name', e.target.value)}
        />
      )}

      {field === 'based_city_id' && (
        <CityStep
          picked={city}
          requested={cityRequested}
          onPick={(c) => { setCity(c); set('based_city_id', c.id); }}
          onRequested={setCityRequested}
        />
      )}

      {field === 'dance_role' && (
        <>
          <p id="dancer4-role-label" className="sr-only">Dance role</p>
          <DanceRolePicker labelId="dancer4-role-label" value={answers.dance_role as DanceRoleValue | ''} onChange={(v) => set('dance_role', v)} />
        </>
      )}

      {field === 'avatar_url' && (
        <AvatarUpload value={answers.avatar_url} onChange={(url) => set('avatar_url', url)} userId={profileId} name={firstName} />
      )}

      {error && <p role="alert" className="text-sm text-destructive" data-testid="dancer4-error">{error}</p>}

      <Button type="submit" className={PILL} disabled={reason !== null || saving} aria-describedby={reason ? 'dancer4-reason' : undefined}>
        {saving ? 'Saving\u2026' : isLast ? 'Finish' : 'Next'}
      </Button>
      {reason && <p id="dancer4-reason" className="text-center text-sm text-muted-foreground" data-testid="dancer4-reason">{reason}</p>}
    </form>
  );
}

function CityStep({ picked, requested, onPick, onRequested }: {
  picked: CityPick | null;
  requested: string | null;
  onPick: (c: CityPick) => void;
  onRequested: (name: string) => void;
}) {
  const [query, setQuery] = useState('');
  const term = useDebounced(query, 250);
  const searching = term.trim().length >= 2;
  const chips = useQuery({ queryKey: ['dancer4-city-chips'], queryFn: fetchChipCities, staleTime: 5 * 60_000, retry: false });
  const hits = useQuery({ queryKey: ['dancer4-city-search', term.trim()], queryFn: () => searchCities(term), enabled: searching, retry: false });
  const [asking, setAsking] = useState(false);
  const [requestName, setRequestName] = useState('');
  const [sending, setSending] = useState(false);
  const [requestError, setRequestError] = useState<string | null>(null);
  const cleanName = normaliseCityRequest(requestName);

  const sendRequest = async () => {
    if (!cleanName || sending) return;
    setSending(true);
    setRequestError(null);
    try {
      await submitCityRequest(cleanName);
      onRequested(cleanName);
      setAsking(false);
    } catch {
      setRequestError(CITY_REQUEST_FAILED);
    } finally {
      setSending(false);
    }
  };

  const chip = (c: CityPick | CityResult) => {
    const pick: CityPick = 'name' in c ? c : { id: c.id, name: c.label };
    const label = 'name' in c ? c.name : c.label;
    return (
      <button key={pick.id} type="button" aria-pressed={picked?.id === pick.id} className={cn(CHIP, chipTone(picked?.id === pick.id))} onClick={() => onPick(pick)} data-testid="dancer4-city-chip">
        {picked?.id === pick.id && <Check className="mr-1 inline h-4 w-4" aria-hidden="true" />}
        {label}
      </button>
    );
  };

  const settledNoHits = searching && hits.isSuccess && (hits.data ?? []).length === 0;
  return (
    <div className="space-y-3">
      {(chips.data ?? []).length > 0 && <div className="flex flex-wrap gap-2" data-testid="dancer4-city-chips">{(chips.data ?? []).map(chip)}</div>}
      <Input
        type="search"
        aria-label="Search for your city"
        placeholder="Search for your city"
        autoComplete="off"
        className="min-h-[44px] text-[16px]"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />
      {searching && hits.isError && <p role="alert" className="text-sm text-destructive">{CITY_SEARCH_FAILED}</p>}
      {searching && (hits.data ?? []).length > 0 && <div className="flex flex-wrap gap-2" data-testid="dancer4-city-results">{(hits.data ?? []).map(chip)}</div>}
      {settledNoHits && !asking && (
        <Button type="button" variant="outline" className={PILL} onClick={() => { setAsking(true); setRequestName(query.trim()); }} data-testid="dancer4-city-notfound">
          {CITY_NOT_FOUND_LABEL}
        </Button>
      )}
      {asking && (
        <div className="space-y-2" data-testid="dancer4-city-request">
          <Input aria-label="Your city" placeholder="Your city" className="min-h-[44px] text-[16px]" value={requestName} onChange={(e) => setRequestName(e.target.value)} />
          {requestError && <p role="alert" className="text-sm text-destructive">{requestError}</p>}
          <Button type="button" className={PILL} disabled={!cleanName || sending} onClick={() => void sendRequest()} data-testid="dancer4-city-send">
            {sending ? 'Sending\u2026' : 'Send request'}
          </Button>
          {!cleanName && <p className="text-center text-sm text-muted-foreground">Type the name of your city</p>}
        </div>
      )}
      {requested && (
        <p role="status" className="rounded-xl border border-border bg-card p-3 text-sm" data-testid="dancer4-city-requested">
          <b>{requested}</b>
          <span className="block text-muted-foreground">{CITY_REQUESTED_NOTE}</span>
        </p>
      )}
    </div>
  );
}
