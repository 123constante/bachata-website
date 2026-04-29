import { useEffect, useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import { DancerDashboard } from '@/components/profile/DancerDashboard';
import { OrganiserDashboard } from '@/components/profile/OrganiserDashboard';
import { TeacherDashboard } from '@/components/profile/TeacherDashboard';
import { DJDashboard } from '@/components/profile/DJDashboard';
import { VendorDashboard } from '@/components/profile/VendorDashboard';
import { VideographerDashboard } from '@/components/profile/VideographerDashboard';
import { ProfileSelector } from '@/components/profile/ProfileSelector';
import { ManageProfilesHub } from '@/components/profile/ManageProfilesHub';
import { UserRole } from '@/hooks/useUserIds';
import { trackAnalyticsEvent } from '@/lib/analytics';
import { Skeleton } from '@/components/ui/skeleton';

const ROLE_CREATE_ROUTES: Record<string, string> = {
  organiser: '/create-organiser-profile',
  teacher: '/create-teacher-profile',
  dj: '/create-dj-profile',
  videographer: '/create-videographer-profile',
};

interface ProfileEntryIds {
  dancerId: string | null;
  organiserId: string | null;
  teacherId: string | null;
  djId: string | null;
  videographerId: string | null;
  vendorId: string | null;
}

interface ProfileEntryRouterProps {
  user: unknown | null;
  loading: boolean;
  ids: ProfileEntryIds;
  availableRoles: UserRole[];
  activeRole: UserRole;
  onSelectRole: (role: UserRole) => void;
  onRefreshRoles: () => void;
  onSignOut: () => void;
}

export const ProfileEntryRouter = ({
  user,
  loading,
  ids,
  availableRoles,
  activeRole,
  onSelectRole,
  onRefreshRoles,
  onSignOut,
}: ProfileEntryRouterProps) => {
  const navigate = useNavigate();

  const [autoResolving, setAutoResolving] = useState(false);
  const [autoResolveFailed, setAutoResolveFailed] = useState(false);
  const autoResolveRan = useRef(false);

  const handleSelectRole = (role: UserRole, source: 'selector' = 'selector') => {
    trackAnalyticsEvent('profile_role_switched', { role, source });
    onSelectRole(role);
  };

  // Auto-resolve zero-roles state: redirect to onboarding
  useEffect(() => {
    if (loading || !user || availableRoles.length > 0 || autoResolveRan.current) return;
    autoResolveRan.current = true;
    navigate('/onboarding', { replace: true });
  }, [loading, user, availableRoles.length, navigate]);
  useEffect(() => {
    if (loading) return;
    trackAnalyticsEvent('profile_entry_opened', { source: 'profile_page' });
    const state = !user
      ? 'unauthenticated'
      : availableRoles.length === 0
        ? 'zero_roles'
        : availableRoles.length === 1
          ? 'single_role'
          : 'multi_role';
    trackAnalyticsEvent('profile_entry_state_detected', { state });
  }, [loading, user, availableRoles.length]);

  useEffect(() => {
    if (!loading && !user) {
      navigate('/auth?mode=signin&returnTo=/profile', { replace: true });
    }
  }, [loading, user, navigate]);

  if (loading || !user) {
    return (
      <div className='min-h-screen pt-20 px-4'>
        <div className='max-w-md mx-auto space-y-4'>
          <Skeleton className='h-12 w-full' />
          <Skeleton className='h-64 w-full' />
        </div>
      </div>
    );
  }

  if (availableRoles.length === 0) {
    // Show loading while auto-resolving, fallback to hub only if it fails
    if (autoResolving || !autoResolveFailed) {
      return (
        <div className='min-h-screen pt-20 px-4'>
          <div className='max-w-md mx-auto space-y-4'>
            <Skeleton className='h-12 w-full' />
            <Skeleton className='h-64 w-full' />
          </div>
        </div>
      );
    }

    return (
      <div className='min-h-screen bg-background relative overflow-hidden'>
        <div className='pointer-events-none absolute top-16 -left-16 h-56 w-56 rounded-full bg-festival-teal/20 blur-3xl' />
        <div className='pt-24'>
          <div className='max-w-sm mx-auto px-4 text-center space-y-4'>
            <h1 className='text-xl font-semibold text-foreground'>Something went wrong loading your profile</h1>
            <p className='text-sm text-muted-foreground'>This is usually temporary. Try again or sign out and back in.</p>
            <div className='flex flex-col gap-2 pt-2'>
              <Button
                onClick={() => {
                  setAutoResolveFailed(false);
                  autoResolveRan.current = false;
                  onRefreshRoles();
                }}
              >
                Try Again
              </Button>
              <Button variant='ghost' onClick={onSignOut}>
                Sign Out
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const isDashboardBright = activeRole === 'vendor';

  return (
    <div className={`min-h-screen bg-background relative overflow-hidden ${isDashboardBright ? 'dashboard-bright' : ''}`}>
      <div className='pointer-events-none absolute top-16 -left-20 h-64 w-64 rounded-full bg-festival-teal/15 blur-3xl' />
      <div className='pointer-events-none absolute bottom-24 -right-20 h-72 w-72 rounded-full bg-cyan-500/10 blur-3xl' />

      {availableRoles.length > 1 && (
        <div className='sticky top-[60px] z-40 px-4 py-2 pointer-events-none'>
          <div className='pointer-events-auto max-w-lg mx-auto'>
            <ProfileSelector
              availableRoles={availableRoles}
              currentRole={activeRole}
              onSelectRole={(role) => handleSelectRole(role, 'selector')}
            />
          </div>
        </div>
      )}

      <div className={availableRoles.length > 1 ? 'pt-2' : ''}>
        {activeRole === 'dancer' && <DancerDashboard />}
        {activeRole === 'organiser' && <OrganiserDashboard />}
        {activeRole === 'teacher' && <TeacherDashboard />}
        {activeRole === 'dj' && <DJDashboard />}
        {activeRole === 'videographer' && <VideographerDashboard />}
        {activeRole === 'vendor' && <VendorDashboard />}

        <div className='pt-0 pb-0'>
          <ManageProfilesHub ids={ids} onRefreshRoles={onRefreshRoles} onSignOut={onSignOut} mode='strip' />
        </div>
      </div>
    </div>
  );
};
