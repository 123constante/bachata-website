import { lazy, Suspense, useCallback, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, Instagram, MapPin } from 'lucide-react';
import GlobalLayout from '@/components/layout/GlobalLayout';
import { buildBreadcrumbs } from '@/lib/breadcrumbs';
import { EmbeddedProfileContext } from '@/lib/embeddedProfile';
import { optimizedImageUrl } from '@/lib/imageCdn';
import { Skeleton } from '@/components/ui/skeleton';
import {
  ROLE_LABEL,
  TAB_HASH,
  TAB_LABEL,
  roleFromHash,
  rolePagePath,
  type PersonRole,
} from './personRoles';
// Through the seam src/pages/DancerProfile.tsx, never from dancer-app (isolation rule c).
import type { PublicPageV2Data } from '@/pages/DancerProfile';
import type { PersonSnapshot } from './reads';

// Each tab body IS the existing role page (same reads, same components); only the
// active one is mounted, so a visitor pays for the tab they open.
const TeacherProfile = lazy(() => import('@/pages/TeacherProfile'));
const DJProfile = lazy(() => import('@/pages/DJProfile'));
const DancerProfile = lazy(() => import('@/pages/DancerProfile'));

const BODY: Record<PersonRole, React.LazyExoticComponent<(props: { publicPage?: PublicPageV2Data | null; embedded?: boolean }) => JSX.Element>> = {
  teacher: TeacherProfile as never,
  dj: DJProfile as never,
  dancer: DancerProfile as never,
};

const FULL_PAGE_LABEL: Record<PersonRole, string> = {
  teacher: 'Open full teacher page',
  dj: 'Open full DJ page',
  dancer: 'Open full dancer page',
};

const instagramHandle = (url: string | null) => {
  if (!url) return null;
  const seg = url.replace(/[?#].*$/, '').split('/').filter(Boolean).pop();
  return seg ? `@${seg.replace(/^@/, '')}` : '@instagram';
};

type Props = {
  person: PersonSnapshot;
  /** The slug (or id) this page was opened with; role-page links reuse it. */
  slugOrId: string;
  /** From the /people loader (same read as /dancers/:id): v2 when the dancer area is open; null/absent = the classic grid. */
  publicPage?: PublicPageV2Data | null;
};

export default function PersonPage({ person, slugOrId, publicPage = null }: Props) {
  const { roles } = person;
  const navigate = useNavigate();
  // The hash is client-only, so the server and the first client render both show
  // the first tab; the real hash is applied right after mount (no hydration mismatch).
  const [hash, setHash] = useState('');
  useEffect(() => {
    const read = () => setHash(window.location.hash);
    read();
    window.addEventListener('hashchange', read);
    return () => window.removeEventListener('hashchange', read);
  }, []);

  const active = roleFromHash(hash, roles);
  const selectTab = useCallback((role: PersonRole) => {
    const next = `#${TAB_HASH[role]}`;
    window.history.replaceState(window.history.state, '', `${window.location.pathname}${window.location.search}${next}`);
    setHash(next);
  }, []);

  const name = person.name ?? 'Bachata Calendar profile';
  const handle = instagramHandle(person.instagramUrl);
  const goBack = () => (window.history.length > 1 ? navigate(-1) : navigate('/search'));
  const BodyComponent = BODY[active];

  return (
    <GlobalLayout
      breadcrumbs={buildBreadcrumbs('person.detail', { entityName: person.name ?? undefined })}
      showSubheader={false}
    >
      <div className="mx-auto w-full max-w-3xl px-3 pb-24 pt-3">
        <button
          type="button"
          onClick={goBack}
          aria-label="Back"
          className="-ml-2 inline-flex h-[44px] w-[44px] items-center justify-center rounded-md text-muted-foreground hover:bg-primary/10 hover:text-primary"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>

        <header className="flex flex-col items-center gap-2 pb-3 text-center">
          {person.avatarUrl ? (
            <img
              src={optimizedImageUrl(person.avatarUrl, 320)}
              alt=""
              width={96}
              height={96}
              loading="eager"
              className="h-24 w-24 rounded-full object-cover"
            />
          ) : (
            <div
              aria-hidden="true"
              className="flex h-24 w-24 items-center justify-center rounded-full bg-muted text-3xl font-black text-foreground"
            >
              {name.charAt(0).toUpperCase()}
            </div>
          )}
          <h1 className="max-w-full break-words text-xl font-bold text-foreground">{name}</h1>
          <p data-testid="role-chips" className="text-sm text-foreground/80">
            {/* Chips and tabs are the ONE list `roles` (the search row shows the same, review F2). */}
            {roles.map((r, i) => (
              <span key={r}>
                {i > 0 ? <span aria-hidden="true"> &middot; </span> : null}
                {ROLE_LABEL[r]}
              </span>
            ))}
          </p>
          {person.city || handle ? (
            <div className="flex flex-wrap items-center justify-center gap-x-3 text-sm text-foreground/80">
              {person.city ? (
                <span className="inline-flex items-center gap-1">
                  <MapPin className="h-4 w-4" aria-hidden="true" />
                  {person.city}
                </span>
              ) : null}
              {handle && person.instagramUrl ? (
                <a
                  href={person.instagramUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex min-h-[44px] items-center gap-1 underline-offset-2 hover:underline"
                >
                  <Instagram className="h-4 w-4" aria-hidden="true" />
                  {handle}
                </a>
              ) : null}
            </div>
          ) : null}
        </header>

        {roles.length > 1 ? (
          <div role="tablist" aria-label="Roles" className="mb-3 flex gap-1 border-b border-border">
            {roles.map((r) => (
              <button
                key={r}
                type="button"
                role="tab"
                id={`tab-${TAB_HASH[r]}`}
                aria-selected={r === active}
                aria-controls={`panel-${TAB_HASH[r]}`}
                onClick={() => selectTab(r)}
                className={`min-h-[44px] flex-1 border-b-2 px-3 text-sm font-semibold ${
                  r === active ? 'border-primary text-foreground' : 'border-transparent text-foreground/70'
                }`}
              >
                {TAB_LABEL[r]}
              </button>
            ))}
          </div>
        ) : null}

        <section
          role={roles.length > 1 ? 'tabpanel' : undefined}
          id={`panel-${TAB_HASH[active]}`}
          aria-labelledby={roles.length > 1 ? `tab-${TAB_HASH[active]}` : undefined}
        >
          <EmbeddedProfileContext.Provider value={true}>
            <Suspense fallback={<Skeleton className="h-48 w-full rounded-xl" />}>
              <BodyComponent key={active} publicPage={active === 'dancer' ? publicPage : null} embedded />
            </Suspense>
          </EmbeddedProfileContext.Provider>
          <Link
            to={rolePagePath(active, slugOrId)}
            className="mt-3 inline-flex min-h-[44px] items-center text-sm font-medium text-primary underline-offset-2 hover:underline"
          >
            {FULL_PAGE_LABEL[active]}
          </Link>
        </section>
      </div>
    </GlobalLayout>
  );
}
