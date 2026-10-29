import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { uploadToR2 } from '@/lib/uploadToR2';
import { uploadErrorMessage, validateImageFile } from '@/lib/upload-validation';
import { loadCountries, type Country } from '@/constants/countries';
import { useP3Home } from '../data/useP3Data';
import { P3_PATHS } from '../shell/paths';
import { Flag, ObSheet, ObShell, ObToast } from './ObShell';
import { prefersReducedMotion, readObTheme } from './obEnv';
import { PERSON_STALE_KEYS, REAL_READS, REAL_WRITES, type OrganiserBrief, type PersonReads, type PersonWrites } from './personApi';
import {
  ABOUT_MAX,
  EMPTY_DRAFT,
  LANG_ALL,
  LANG_FEW,
  LEVELS,
  POPULAR_NATIONS,
  READ_FAILED,
  ROLE_OPTIONS,
  SAVE_FAILED,
  STEP_COPY,
  STY_ALL,
  STY_FEW,
  UPLOAD_FAILED,
  blockedReason,
  commandFor,
  heldAfter,
  heldFrom,
  nextStep,
  personPath,
  prevStep,
  progressPercent,
  sixFor,
  starterSentence,
  toggleIn,
  type PersonDraft,
  type PersonStep,
} from './personModel';

const TICK = <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3} aria-hidden="true"><path d="M5 12l5 5 9-10" strokeLinecap="round" strokeLinejoin="round" /></svg>;
const X = <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3} aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" /></svg>;
const SEARCH = <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="M20 20l-3.5-3.5" strokeLinecap="round" /></svg>;

/**
 * P3 onboarding, the person screens 10-20 (W4b build 2 slice 1, design record
 * docs/design/onboarding-prototype.md). Route /account/p3/you/details[?o=<organiser id>]:
 * the organiser is the one About is written for (plan A7); without one About is not on the path.
 */
export default function PersonFlow({ reads = REAL_READS, writes = REAL_WRITES }: { reads?: PersonReads; writes?: PersonWrites }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const home = useP3Home();
  const orgId = params.get('o') ?? home.data?.organisers[0]?.id ?? null;
  const uid = user?.id;
  const dancer = useQuery({ queryKey: ['p3-ob', 'dancer', uid], queryFn: reads.dancer, enabled: !!uid, retry: false });
  const intent = useQuery({ queryKey: ['p3-ob', 'intent', uid], queryFn: reads.intent, enabled: !!uid, retry: false });
  const teacher = useQuery({ queryKey: ['p3-ob', 'teacher', uid], queryFn: reads.teacher, enabled: !!uid, retry: false });
  const organiser = useQuery({ queryKey: ['p3-ob', 'organiser', orgId], queryFn: () => reads.organiser(orgId as string), enabled: !!orgId, retry: false });
  const [theme] = useState(readObTheme);
  const exit = useCallback(() => navigate(P3_PATHS.you), [navigate]);
  const waitingOrg = !params.get('o') && home.isPending;
  const all = [dancer, intent, teacher, ...(orgId ? [organiser] : [])];

  if (!user) return null;
  if (all.some((q) => q.isError)) {
    return (
      <ObShell screen="error" dir="fwd" percent={0} onBack={exit} backLabel="Back" onEscape={exit} theme={theme}
        foot={<button type="button" className="p3-ob-btn" onClick={() => all.forEach((q) => void q.refetch())} data-testid="p3-ob-retry">Try again</button>}>
        <h1 className="p3-ob-t" tabIndex={-1}>Your details</h1>
        <p className="p3-ob-err" role="alert" data-testid="p3-ob-readfail">{READ_FAILED}</p>
      </ObShell>
    );
  }
  if (waitingOrg || all.some((q) => q.isPending)) {
    return (
      <ObShell screen="loading" dir="fwd" percent={0} onBack={exit} backLabel="Back" onEscape={exit} theme={theme}
        foot={<button type="button" className="p3-ob-btn" aria-disabled="true">Continue</button>}>
        <div role="status" aria-label="Loading" data-testid="p3-ob-loading" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div className="p3-ob-skel" style={{ width: '60%', minHeight: 34 }} />
          <div className="p3-ob-skel" />
        </div>
      </ObShell>
    );
  }
  const held = heldFrom({ dancer: dancer.data ?? null, intent: intent.data ?? null, teacher: teacher.data ?? null, bio: organiser.data?.bio ?? null });
  return (
    <PersonScreens
      held={held}
      organiser={orgId ? organiser.data ?? null : null}
      userId={user.id}
      signInEmail={user.email ?? null}
      writes={writes}
      theme={theme}
      onExit={exit}
      onDone={exit}
    />
  );
}

export interface PersonScreensProps {
  held: PersonDraft;
  organiser: OrganiserBrief | null;
  userId: string;
  signInEmail: string | null;
  writes: PersonWrites;
  theme: 'light' | 'dark';
  onExit: () => void;
  onDone: () => void;
  /** Tests start on a given screen. */
  initialStep?: PersonStep;
  /** Tests stub the upload. */
  upload?: (file: File) => Promise<string>;
}

type Sheet = 'nat' | 'langs' | 'styles' | null;

export function PersonScreens({ held: heldIn, organiser, userId, signInEmail, writes, theme, onExit, onDone, initialStep, upload }: PersonScreensProps) {
  const qc = useQueryClient();
  const [held, setHeld] = useState<PersonDraft>(heldIn);
  const [d, setD] = useState<PersonDraft>({ ...EMPTY_DRAFT, ...heldIn });
  const [step, setStep] = useState<PersonStep>(initialStep ?? 'name');
  const [dir, setDir] = useState<'fwd' | 'back'>('fwd');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [sheet, setSheet] = useState<Sheet>(null);
  const [bounce, setBounce] = useState(false);
  const path = personPath(d.teach, !!organiser);
  const set = <K extends keyof PersonDraft>(k: K, v: PersonDraft[K]) => setD((p) => ({ ...p, [k]: v }));

  const move = (to: PersonStep | null, how: 'fwd' | 'back') => {
    setError(null);
    setSheet(null);
    if (!to) {
      if (how === 'back') onExit();
      else onDone();
      return;
    }
    setDir(how);
    setStep(to);
  };
  const back = () => move(prevStep(step, path), 'back');
  const escape = () => (sheet ? setSheet(null) : back());

  const celebrate = () => {
    if (prefersReducedMotion()) return;
    setBounce(true);
    try {
      navigator.vibrate?.(12);
    } catch {
      /* not every browser has it */
    }
  };
  useEffect(() => {
    if (!bounce) return;
    const t = setTimeout(() => setBounce(false), 340);
    return () => clearTimeout(t);
  }, [bounce]);

  const continueStep = async () => {
    if (saving) return;
    const reason = blockedReason(step, d);
    if (reason) {
      setToast(reason);
      return;
    }
    const cmd = commandFor(step, d, held);
    if (cmd) {
      setSaving(true);
      setError(null);
      try {
        await writes.run(cmd, organiser?.id ?? null);
      } catch {
        setError(SAVE_FAILED);
        setSaving(false);
        return;
      }
      setSaving(false);
      setHeld((h) => heldAfter(step, h, d));
      for (const key of PERSON_STALE_KEYS) void qc.invalidateQueries({ queryKey: key as string[] });
    }
    celebrate();
    move(nextStep(step, path), 'fwd');
  };

  const skip = async () => {
    if (saving) return;
    if (step === 'about' && organiser) {
      setSaving(true);
      try {
        await writes.skipAbout(organiser.id);
      } catch {
        setError(SAVE_FAILED);
        setSaving(false);
        return;
      }
      setSaving(false);
    }
    setD((p) => ({ ...p, ...(step === 'langs' ? { languages: held.languages } : step === 'about' ? { about: held.about } : {}) }));
    move(nextStep(step, path), 'fwd');
  };

  const copy = STEP_COPY[step];
  const reason = blockedReason(step, d);
  const isLast = nextStep(step, path) === null;
  const primaryLabel = saving ? 'Saving\u2026' : step === 'email' ? (signInEmail ? 'Save it privately' : 'Continue') : step === 'about' && d.about.trim() ? 'Save and continue' : isLast ? 'Done' : 'Continue';
  const skippable = step === 'langs' || step === 'about' || step === 'email';
  const title = step === 'about' && organiser?.name ? `About ${organiser.name}` : copy.title;

  const foot = (
    <>
      {error ? <p className="p3-ob-err" role="alert" data-testid="p3-ob-error">{error}</p> : reason ? <p className="p3-ob-why" id="p3-ob-why" data-testid="p3-ob-why">{reason}</p> : null}
      <button
        type="button"
        className="p3-ob-btn"
        aria-disabled={reason || saving ? 'true' : undefined}
        aria-describedby={reason ? 'p3-ob-why' : undefined}
        data-bounce={bounce ? 'true' : undefined}
        onClick={() => void (step === 'email' && !signInEmail ? skip() : continueStep())}
        data-testid="p3-ob-continue"
      >
        {primaryLabel}
      </button>
      {skippable && <button type="button" className="p3-ob-lnk" onClick={() => void skip()} data-testid="p3-ob-skip">Skip for now</button>}
    </>
  );

  return (
    <ObShell screen={step} dir={dir} percent={progressPercent(step, path)} onBack={back} backLabel="Back" onEscape={escape} theme={theme} foot={foot}>
      <h1 className="p3-ob-t" id="p3-ob-title" tabIndex={-1} data-testid="p3-ob-title">
        {title}
        {copy.optional && <span className="p3-ob-opt">optional</span>}
      </h1>
      {copy.helper && <p className="p3-ob-m">{copy.helper}</p>}
      {step === 'name' && (
        <input className="p3-ob-inp" type="text" autoComplete="given-name" aria-labelledby="p3-ob-title" value={d.first_name} maxLength={80}
          onChange={(e) => set('first_name', e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') void continueStep(); }} data-testid="p3-ob-name" />
      )}
      {step === 'photo' && <PhotoStep url={d.avatar_url} userId={userId} onUrl={(u) => set('avatar_url', u)} upload={upload} />}
      {step === 'role' && (
        <div className="p3-ob-tiles" data-three="true" role="radiogroup" aria-labelledby="p3-ob-title">
          {ROLE_OPTIONS.map((r) => (
            <Tile key={r.value} role="radio" on={d.dance_role === r.value} onClick={() => set('dance_role', r.value)} label={r.label} testId={`p3-ob-role-${r.label}`} />
          ))}
        </div>
      )}
      {step === 'nat' && <NationalityStep value={d.nationality} onPick={(c) => set('nationality', c)} onMore={() => setSheet('nat')} />}
      {step === 'langs' && (
        <MultiStep all={LANG_ALL} few={LANG_FEW} chosen={d.languages} onToggle={(v) => set('languages', toggleIn(d.languages, v))} moreLabel="More languages" onMore={() => setSheet('langs')} testId="p3-ob-langs" />
      )}
      {step === 'teach' && (
        <div className="p3-ob-tiles" role="radiogroup" aria-labelledby="p3-ob-title">
          <Tile role="radio" on={d.teach === 'yes'} onClick={() => set('teach', 'yes')} label="Yes, I teach" testId="p3-ob-teach-yes" />
          <Tile role="radio" on={d.teach === 'no'} onClick={() => set('teach', 'no')} label="No" testId="p3-ob-teach-no" />
        </div>
      )}
      {step === 'levels' && (
        <div className="p3-ob-tiles" role="group" aria-labelledby="p3-ob-title">
          {LEVELS.map((l) => (
            <Tile key={l.value} role="checkbox" on={d.levels.includes(l.value)} onClick={() => set('levels', toggleIn(d.levels, l.value))} label={l.value} help={l.help} testId={`p3-ob-level-${l.value}`} />
          ))}
        </div>
      )}
      {step === 'styles' && (
        <MultiStep all={uniq([...STY_ALL, ...d.styles])} few={STY_FEW} chosen={d.styles} onToggle={(v) => set('styles', toggleIn(d.styles, v))} moreLabel="More styles" onMore={() => setSheet('styles')} testId="p3-ob-styles" />
      )}
      {step === 'years' && (
        <input className="p3-ob-inp p3-ob-years" type="text" inputMode="numeric" pattern="[0-9]*" placeholder="0 to 60" aria-labelledby="p3-ob-title" value={d.years} maxLength={2}
          onChange={(e) => set('years', e.target.value.replace(/[^0-9]/g, ''))} onKeyDown={(e) => { if (e.key === 'Enter') void continueStep(); }} data-testid="p3-ob-years" />
      )}
      {step === 'about' && <AboutStep value={d.about} onChange={(v) => set('about', v)} starter={organiser ? starterSentence({ name: organiser.name, category: organiser.category, city: organiser.city, styles: d.teach === 'yes' ? d.styles : [] }) : ''} />}
      {step === 'email' && (
        <>
          <div className="p3-ob-card p3-ob-kbhide">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true"><rect x="5" y="10" width="14" height="10" rx="2" /><path d="M8 10V7a4 4 0 0 1 8 0v3" /></svg>
            <div><strong>Private. Never shown on your page.</strong></div>
          </div>
          <p className="p3-ob-m" data-testid="p3-ob-email-line">
            {signInEmail ? <>You sign in as <b>{signInEmail}</b>. We keep a private copy so you never lose the page.</> : 'There is no email on this sign-in, so there is nothing to keep.'}
          </p>
        </>
      )}

      {sheet === 'nat' && (
        <ObSheet title="All countries" onClose={() => setSheet(null)} theme={theme} testId="p3-ob-sheet-nat">
          <CountryRows value={d.nationality} onPick={(c) => { set('nationality', c); setSheet(null); }} />
        </ObSheet>
      )}
      {sheet === 'langs' && (
        <ObSheet title="Languages" onClose={() => setSheet(null)} theme={theme} testId="p3-ob-sheet-langs">
          <PickRows all={uniq([...d.languages, ...LANG_ALL])} chosen={d.languages} onToggle={(v) => set('languages', toggleIn(d.languages, v))} />
        </ObSheet>
      )}
      {sheet === 'styles' && (
        <ObSheet title="Styles" onClose={() => setSheet(null)} theme={theme} testId="p3-ob-sheet-styles">
          <PickRows all={uniq([...d.styles, ...STY_ALL])} chosen={d.styles} onToggle={(v) => set('styles', toggleIn(d.styles, v))} />
        </ObSheet>
      )}
      {toast && <ObToast text={toast} theme={theme} onDone={() => setToast(null)} />}
    </ObShell>
  );
}

const uniq = (xs: readonly string[]): string[] => {
  const seen = new Set<string>();
  return xs.filter((x) => (seen.has(x.toLowerCase()) ? false : (seen.add(x.toLowerCase()), true)));
};

function Tile({ role, on, onClick, label, help, testId }: { role: 'radio' | 'checkbox'; on: boolean; onClick: () => void; label: string; help?: string; testId: string }) {
  return (
    <button type="button" className="p3-ob-tile" role={role} aria-checked={on} onClick={onClick} data-testid={testId}>
      <strong>{label}</strong>
      {help && <span>{help}</span>}
      <span className="p3-ob-tick">{TICK}</span>
    </button>
  );
}

function PhotoStep({ url, userId, onUrl, upload }: { url: string; userId: string; onUrl: (u: string) => void; upload?: (f: File) => Promise<string> }) {
  const camera = useRef<HTMLInputElement>(null);
  const gallery = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    const check = validateImageFile(file);
    if (check.ok === false) {
      setErr(check.message);
      return;
    }
    setBusy(true);
    setErr(null);
    try {
      const ext = file.name.split('.').pop() ?? 'jpg';
      onUrl(upload ? await upload(file) : await uploadToR2(file, 'avatars', `${userId}-${Math.random()}.${ext}`));
    } catch (x) {
      setErr(uploadErrorMessage(x) || UPLOAD_FAILED);
    } finally {
      setBusy(false);
    }
  };
  return (
    <>
      <div className="p3-ob-ava-row">
        <div className="p3-ob-ava" data-has={url ? 'true' : undefined} data-testid="p3-ob-ava">
          {url ? <img src={url} alt="Your photo" loading="lazy" decoding="async" /> : <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true"><circle cx="12" cy="8" r="4" /><path d="M4 21c0-4 3.6-7 8-7s8 3 8 7" strokeLinecap="round" /></svg>}
        </div>
        <div className="p3-ob-ava-btns">
          <button type="button" className="p3-ob-ava-btn" onClick={() => camera.current?.click()} disabled={busy} data-testid="p3-ob-photo-camera">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true"><path d="M4 8h3l2-3h6l2 3h3v11H4z" strokeLinejoin="round" /><circle cx="12" cy="13" r="3.5" /></svg>
            {busy ? 'Uploading\u2026' : 'Take a photo'}
          </button>
          <button type="button" className="p3-ob-ava-btn" onClick={() => gallery.current?.click()} disabled={busy} data-testid="p3-ob-photo-gallery">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true"><rect x="4" y="5" width="16" height="14" rx="2" /><path d="M4 16l5-5 4 4 3-3 4 4" strokeLinejoin="round" /></svg>
            Choose from gallery
          </button>
        </div>
      </div>
      <input ref={camera} className="p3-ob-sr" type="file" accept="image/*" capture="user" tabIndex={-1} aria-hidden="true" onChange={(e) => void onFile(e)} />
      <input ref={gallery} className="p3-ob-sr" type="file" accept="image/*" tabIndex={-1} aria-hidden="true" onChange={(e) => void onFile(e)} data-testid="p3-ob-photo-file" />
      {err && <p className="p3-ob-err" role="alert" data-testid="p3-ob-photo-err">{err}</p>}
    </>
  );
}

/** Country names: the popular list inline; the full ISO list + home nations loads lazily (world-countries). */
function useCountries(): Country[] | null {
  const [list, setList] = useState<Country[] | null>(null);
  useEffect(() => {
    let live = true;
    loadCountries().then((c) => live && setList(c), () => live && setList([]));
    return () => {
      live = false;
    };
  }, []);
  return list;
}

type Nation = { code: string; name: string };
const POPULAR: Nation[] = POPULAR_NATIONS.map(([code, name]) => ({ code, name }));

function nationName(code: string, countries: Country[] | null): string {
  const c = code.trim().toUpperCase();
  return POPULAR.find((n) => n.code === c)?.name ?? countries?.find((n) => n.code.toUpperCase() === c)?.name ?? code;
}

function allNations(countries: Country[] | null): Nation[] {
  const rest = (countries ?? []).filter((c) => !POPULAR.some((p) => p.code === c.code.toUpperCase())).map((c) => ({ code: c.code.toUpperCase(), name: c.name }));
  return [...POPULAR, ...rest];
}

function SearchBox({ value, onChange, label }: { value: string; onChange: (v: string) => void; label: string }) {
  return (
    <div className="p3-ob-search">
      {SEARCH}
      <input className="p3-ob-inp" type="search" placeholder="Type to search" autoComplete="off" aria-label={label} value={value} onChange={(e) => onChange(e.target.value)} data-testid="p3-ob-search" />
    </div>
  );
}

function NationalityStep({ value, onPick, onMore }: { value: string; onPick: (code: string) => void; onMore: () => void }) {
  const countries = useCountries();
  const [q, setQ] = useState('');
  const six = sixFor(allNations(countries), POPULAR, q, (n) => n.name);
  const chosen = value.trim().toUpperCase();
  const shown = chosen && !six.some((n) => n.code === chosen) ? [{ code: chosen, name: nationName(chosen, countries) }, ...six.slice(0, 5)] : six;
  return (
    <>
      <SearchBox value={q} onChange={setQ} label="Search nationality" />
      <div className="p3-ob-scrollbox">
        {shown.length === 0 ? (
          <p className="p3-ob-m" role="status">No match. Try All countries.</p>
        ) : (
          <div className="p3-ob-chips" role="radiogroup" aria-labelledby="p3-ob-title" data-testid="p3-ob-nat-chips">
            {shown.map((n) => {
              const on = n.code === chosen;
              return (
                <button key={n.code} type="button" role="radio" aria-checked={on} className="p3-ob-chip" onClick={() => onPick(on ? '' : n.code)} data-testid={`p3-ob-nat-${n.code}`}>
                  <Flag code={n.code} />
                  {n.name}
                  {on && <span className="p3-ob-chip-x" aria-hidden="true">{X}</span>}
                </button>
              );
            })}
          </div>
        )}
      </div>
      <button type="button" className="p3-ob-btn p3-ob-btn-line p3-ob-btn-sm p3-ob-kbhide" onClick={onMore} data-testid="p3-ob-more">All countries</button>
    </>
  );
}

function CountryRows({ value, onPick }: { value: string; onPick: (code: string) => void }) {
  const countries = useCountries();
  const chosen = value.trim().toUpperCase();
  const rest = allNations(countries).slice(POPULAR.length);
  const row = (n: Nation) => (
    <button key={n.code} type="button" role="radio" aria-checked={n.code === chosen} className="p3-ob-row" onClick={() => onPick(n.code)} data-testid={`p3-ob-nat-row-${n.code}`}>
      <Flag code={n.code} />
      {n.name}
    </button>
  );
  return (
    <div role="radiogroup" aria-label="Nationality">
      {POPULAR.map(row)}
      <div className="p3-ob-sect">All countries</div>
      {countries === null ? <p className="p3-ob-m" role="status">Loading&hellip;</p> : rest.map(row)}
    </div>
  );
}

function MultiStep({ all, few, chosen, onToggle, moreLabel, onMore, testId }: { all: readonly string[]; few: readonly string[]; chosen: readonly string[]; onToggle: (v: string) => void; moreLabel: string; onMore: () => void; testId: string }) {
  const [q, setQ] = useState('');
  const six = sixFor(all, few, q, (s) => s);
  const lower = chosen.map((c) => c.toLowerCase());
  const shown = q ? six : uniq([...chosen, ...six.filter((s) => !lower.includes(s.toLowerCase()))]);
  return (
    <>
      <SearchBox value={q} onChange={setQ} label={`Search ${moreLabel.replace('More ', '')}`} />
      <div className="p3-ob-scrollbox">
        {shown.length === 0 ? (
          <p className="p3-ob-m" role="status">No match. Try {moreLabel}.</p>
        ) : (
          <div className="p3-ob-chips" role="group" aria-labelledby="p3-ob-title" data-testid={testId}>
            {shown.map((s) => {
              const on = lower.includes(s.toLowerCase());
              return (
                <button key={s} type="button" aria-pressed={on} className="p3-ob-chip" onClick={() => onToggle(s)} data-testid={`${testId}-${s}`}>
                  {s}
                  {on && <span className="p3-ob-chip-x" aria-hidden="true">{X}</span>}
                </button>
              );
            })}
          </div>
        )}
      </div>
      <button type="button" className="p3-ob-btn p3-ob-btn-line p3-ob-btn-sm p3-ob-kbhide" onClick={onMore} data-testid="p3-ob-more">{moreLabel}</button>
    </>
  );
}

function PickRows({ all, chosen, onToggle }: { all: readonly string[]; chosen: readonly string[]; onToggle: (v: string) => void }) {
  const lower = chosen.map((c) => c.toLowerCase());
  return (
    <div role="group">
      {all.map((s) => (
        <button key={s} type="button" aria-pressed={lower.includes(s.toLowerCase())} className="p3-ob-row" onClick={() => onToggle(s)}>
          {s}
        </button>
      ))}
    </div>
  );
}

function AboutStep({ value, onChange, starter }: { value: string; onChange: (v: string) => void; starter: string }): ReactNode {
  return (
    <>
      <textarea className="p3-ob-inp" maxLength={ABOUT_MAX} placeholder="Who you are and what you run" aria-labelledby="p3-ob-title" value={value} onChange={(e) => onChange(e.target.value)} data-testid="p3-ob-about" />
      <p className="p3-ob-m p3-ob-kbhide" aria-live="polite">{value.length} / {ABOUT_MAX}</p>
      {starter && !value.trim() && (
        <button type="button" className="p3-ob-lnk p3-ob-kbhide" onClick={() => onChange(starter)} data-testid="p3-ob-starter">Use the starter sentence</button>
      )}
    </>
  );
}
