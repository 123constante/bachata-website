import { Suspense, useCallback, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { lazyWithRetry } from '@/lib/lazyWithRetry';
import { londonTodayKey } from '@/lib/londonDate';
import { OB_THEME_KEY, readObTheme } from '../onboarding/obEnv';
import { GRACE_HIDE_KEY, graceShown, thingsLeft } from '../onboarding/graceModel';
import { P3_PATHS } from '../shell/paths';

// The sheet (and onboarding.css) load only when Settings is tapped.
const SettingsSheet = lazyWithRetry(() => import('../onboarding/SettingsSheet'));

type UntypedRpc = { rpc(fn: string, args?: Record<string, unknown>): PromiseLike<{ data: unknown; error: { message: string } | null }> };

export type GraceStatus = { complete: boolean; isAdmin: boolean; left: number; firstId: string | null; firstName: string };

/** organiser_onboarding_status_v1() for every page the person is on (no id = all). */
export function graceStatusFrom(raw: unknown): GraceStatus | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as { complete?: unknown; is_admin?: unknown; person?: { missing?: unknown }; organisers?: unknown };
  const orgs = Array.isArray(r.organisers) ? (r.organisers as { id?: unknown; name?: unknown; complete?: unknown; missing?: unknown }[]) : [];
  const first = orgs.find((o) => o.complete !== true) ?? orgs[0];
  const len = (v: unknown) => (Array.isArray(v) ? v.length : 0);
  return {
    complete: r.complete === true,
    isAdmin: r.is_admin === true,
    left: len(r.person?.missing) + (first ? len(first.missing) : 0),
    firstId: typeof first?.id === 'string' ? first.id : null,
    firstName: typeof first?.name === 'string' ? first.name : '',
  };
}

async function fetchStatus(): Promise<unknown> {
  const { data, error } = await (supabase as unknown as UntypedRpc).rpc('organiser_onboarding_status_v1', {});
  if (error) throw new Error(error.message);
  return data;
}

const readHidden = (): string | null => {
  try {
    return window.localStorage.getItem(GRACE_HIDE_KEY);
  } catch {
    return null;
  }
};

/**
 * P3 Home's grace banner (prototype screen 23) and the Settings button. Shown while the onboarding is not
 * complete, never to admins; "Hide for today" is per device. No grace end date is shown: the server has
 * none yet (plan Q1 open), and the banner never invents one. A failed status read shows nothing (Home works).
 */
export function GraceBanner({ fetcher = fetchStatus }: { fetcher?: () => Promise<unknown> }) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['p3-ob-status', 'all', user?.id], queryFn: fetcher, enabled: !!user?.id, staleTime: 60_000, retry: false });
  const s = q.data ? graceStatusFrom(q.data) : null;
  const today = londonTodayKey();
  const [hiddenOn, setHiddenOn] = useState(readHidden);
  const [settings, setSettings] = useState(false);
  const [theme, setThemeState] = useState(readObTheme);
  const setTheme = useCallback((t: 'light' | 'dark') => {
    setThemeState(t);
    try {
      window.localStorage.setItem(OB_THEME_KEY, t);
    } catch {
      /* private mode */
    }
  }, []);
  const hide = () => {
    setHiddenOn(today);
    try {
      window.localStorage.setItem(GRACE_HIDE_KEY, today);
    } catch {
      /* private mode: hidden for this visit only */
    }
  };
  const shown = graceShown(s, hiddenOn, today);
  return (
    <>
      <div className="p3-grace-bar">
        <button type="button" className="p3-link" onClick={() => setSettings(true)} data-testid="p3-home-settings">Settings</button>
      </div>
      {shown && s && (
        <section className="p3-card p3-grace" role="status" data-testid="p3-grace">
          <div className="p3-grace-txt">
            <strong>Finish your details to create and edit events.</strong>
            <span>{thingsLeft(s.left)}. Until then everything works as usual.</span>
          </div>
          <div className="p3-grace-acts">
            <Link className="p3-btn" to={s.firstId ? `${P3_PATHS.start}?o=${encodeURIComponent(s.firstId)}&at=review` : P3_PATHS.start} data-testid="p3-grace-go">Continue</Link>
            <button type="button" className="p3-link" onClick={hide} data-testid="p3-grace-hide">Hide for today</button>
          </div>
        </section>
      )}
      {settings && (
        <Suspense fallback={null}>
          <SettingsSheet
            theme={theme}
            setTheme={setTheme}
            organiserId={s?.firstId ?? null}
            pageName={s?.firstName ?? ''}
            onRenamed={() => {
              void qc.invalidateQueries({ queryKey: ['organiser-home'] });
              void qc.invalidateQueries({ queryKey: ['p3-ob-status'] });
            }}
            onClose={() => setSettings(false)}
          />
        </Suspense>
      )}
    </>
  );
}
