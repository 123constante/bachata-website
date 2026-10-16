import { Link, Navigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import { DELETION_STATUS_KEY, fetchDeletionStatus } from '@/lib/accountDeletion';
import { AuthGuard } from '@/components/auth/AuthGuard';
import { useNoindexMeta } from '@/hooks/useNoindexMeta';
import { signInLanding } from '@/lib/accountRouting';
import { SideAvatar, sideKind, sideTitle } from './SideAvatar';
import { useProfileSides } from './useProfileSides';

/**
 * /account/continue -- where a sign-in with no returnTo lands (lib/auth-otp-routing).
 * lib/accountRouting's signInLanding() decides: one side -> straight there
 * (replace, so Back does not return here); two or more -> "Continue as...", one
 * large button per side, organisers first and visually primary. Shown on every
 * sign-in; never to a single-side person.
 */
export const ContinueAsScreen = () => {
  const { facts } = useProfileSides();
  const { user } = useAuth();
  // A deleted (= hidden) account is read first (lib/accountDeletion); a failed read is null, never a block.
  const deletion = useQuery({
    queryKey: [DELETION_STATUS_KEY, user?.id ?? null],
    queryFn: fetchDeletionStatus,
    enabled: Boolean(user?.id),
    staleTime: 0,
    retry: false,
  });
  const landing = signInLanding({ ...facts, deletion: deletion.isLoading ? 'loading' : (deletion.data ?? null) }, null);
  if (landing.kind === 'go') return <Navigate to={landing.to} replace />;
  if (landing.kind === 'wait') {
    return (
      <div className="mx-auto w-full max-w-md px-4 pt-6" aria-busy="true" data-testid="continue-as-loading">
        <p className="text-sm text-muted-foreground">Signing you in&hellip;</p>
      </div>
    );
  }
  return (
    <div className="mx-auto w-full max-w-md px-4 pb-24 pt-4" data-testid="continue-as">
      <h1 className="text-lg font-bold text-foreground">Continue as&hellip;</h1>
      <p className="mt-1 text-sm text-muted-foreground">You can switch any time from the picture at the top right.</p>
      <ul className="mt-3 space-y-3">
        {landing.sides.map((side) => {
          const primary = side.kind === 'organiser';
          return (
            <li key={side.key}>
              <Link
                to={side.to}
                replace
                data-testid={`continue-as-${side.key}`}
                className={`flex min-h-[72px] w-full items-center gap-3 rounded-xl border p-3 ${
                  primary ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-card text-foreground'
                }`}
              >
                <SideAvatar side={side} size={48} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-base font-bold">{sideTitle(side)}</span>
                  <span className={`block text-sm ${primary ? 'opacity-90' : 'text-muted-foreground'}`}>{sideKind(side)}</span>
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
};

const ContinueAsPage = () => {
  useNoindexMeta(true);
  return (
    <AuthGuard>
      <ContinueAsScreen />
    </AuthGuard>
  );
};

export default ContinueAsPage;
