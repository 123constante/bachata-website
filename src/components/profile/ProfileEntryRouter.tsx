import { useEffect } from 'react';
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

  const handleSelectRole = (role: UserRole, source: 'selector' = 'selector') => {
    trackAnalyticsEvent('profile_role_switched', { role, source });
    onSelectRole(role);
  };

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
    return (
      <div className='min-h-screen bg-background relative overflow-hidden'>
        <div className='pointer-events-none absolute top-16 -left-16 h-56 w-56 rounded-full bg-festival-teal/20 blur-3xl' />
        <div className='pointer-events-none absolute bottom-10 -right-20 h-64 w-64 rounded-full bg-cyan-500/15 blur-3xl' />
        <div className='pt-24'>
          <div className='max-w-lg mx-auto px-4 space-y-2'>
            <h1 className='text-3xl font-bold'>Set up your profile</h1>
            <p className='text-muted-foreground'>Choose what you want to do on Bachata Calendar.</p>
          </div>

          <ManageProfilesHub ids={ids} onRefreshRoles={onRefreshRoles} onSignOut={onSignOut} />
        </div>
      </div>
    );
  }

  const isDashboardBright = activeRole === 'dancer' || activeRole === 'vendor';

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
