import { Suspense, useCallback, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { lazyWithRetry } from '@/lib/lazyWithRetry';
import { londonTodayKey } from '@/lib/londonDate';
import { OB_THEME_KEY, readObTheme } from '../onboarding/obEnv';
import { GRACE_HIDE_KEY, graceShown, graceStatusFrom, onboardingLeft, thingsLeft } from '../onboarding/graceModel';
import { fetchOnboardingStatus, onboardingStatusKey } from '../onboarding/statusQuery';
import { P3_PATHS } from '../shell/paths';
import { useOrganiserChoice } from '../../switch/useOrganiserChoice';

// The sheet (and onboarding.css) load only when Settings is tapped.
const SettingsSheet = lazyWithRetry(() => import('../onboarding/SettingsSheet'));

const readHidden = (): string | null => {
  try {
    return window.localStorage.getItem(GRACE_HIDE_KEY);
  } catch {
    return null;
  }
};

/**
 * P3 Home's grace banner (prototype screen 23) and the Settings button. Shown only while something is left to
 * do (graceModel's one count, the same the You tab shows), never to admins; "Hide for today" is per device. No
 * grace end date is shown: the server has none yet (plan Q1 open), and the banner never invents one. A failed status read shows nothing (Home works).
 */
export function GraceBanner({ fetcher = fetchOnboardingStatus }: { fetcher?: () => Promise<unknown> }) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const q = useQuery({ queryKey: onboardingStatusKey(user?.id), queryFn: fetcher, enabled: !!user?.id, staleTime: 60_000, retry: false });
  // The shown page, as the You tab counts it (one mapping, one page: the two never disagree).
  const { selected } = useOrganiserChoice();
  const s = q.data ? graceStatusFrom(q.data, selected?.id ?? null) : null;
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
            <span>{thingsLeft(onboardingLeft(s))}. Until then everything works as usual.</span>
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
