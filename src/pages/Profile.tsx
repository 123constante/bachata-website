import { useEffect, useState, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth, type SignOutOutcome } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { useUserIds, UserRole } from '@/hooks/useUserIds';
import { ProfileEntryRouter } from '@/components/profile/ProfileEntryRouter';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import GlobalLayout from '@/components/layout/GlobalLayout';

import { buildBreadcrumbs } from '@/lib/breadcrumbs';
const LAST_ACTIVE_ROLE_KEY = 'profile_last_active_role';

const Profile = () => {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const { user, signOut } = useAuth();
    const { toast } = useToast();
    const { dancerId, dancerProfileComplete, organiserId, teacherId, videographerId, vendorId, loading, refetch } = useUserIds();
    const [activeRole, setActiveRole] = useState<UserRole>('dancer');
    const [isSignOutOpen, setIsSignOutOpen] = useState(false);
    const [isSigningOut, setIsSigningOut] = useState(false);
    
    // Determine available roles. The dancer slot is gated on the profile being
    // SET UP, not merely present: the signup trigger mints a stub for everyone,
    // so `dancerId` alone would route every brand-new user straight into the
    // dancer dashboard with a blank profile and hide the "create one" path.
    const availableRoles: UserRole[] = useMemo(() => [
        dancerProfileComplete ? 'dancer' : null,
        organiserId ? 'organiser' : null,
        teacherId ? 'teacher' : null,
        videographerId ? 'videographer' : null,
        vendorId ? 'vendor' : null
    ].filter(Boolean) as UserRole[], [dancerProfileComplete, organiserId, teacherId, videographerId, vendorId]);

    const requestedRole = searchParams.get('role') as UserRole | null;
    const availableRolesKey = availableRoles.join('|');

    // Resolve active role with deterministic precedence: URL -> storage -> first available
    useEffect(() => {
        if (loading || availableRoles.length === 0) return;
        const storedRole = localStorage.getItem(LAST_ACTIVE_ROLE_KEY) as UserRole | null;

        const nextRole =
            (requestedRole && availableRoles.includes(requestedRole) ? requestedRole : null) ||
            (storedRole && availableRoles.includes(storedRole) ? storedRole : null) ||
            availableRoles[0];

        setActiveRole((prev) => (prev === nextRole ? prev : nextRole));
    }, [loading, availableRolesKey, requestedRole]);

    useEffect(() => {
        if (!loading && availableRoles.includes(activeRole)) {
            localStorage.setItem(LAST_ACTIVE_ROLE_KEY, activeRole);
        }
    }, [loading, availableRolesKey, activeRole]);

    /* ORDERING IS THE FIX HERE, not the toast. This used to clear local storage
     * and navigate('/') BEFORE awaiting signOut(), so the UI committed to
     * "signed out" while the request was still in flight -- and since the old
     * signOut() reported nothing, it stayed committed even when the session was
     * still live. Now nothing is discarded and nowhere is navigated to until the
     * outcome is known. */
    const handleConfirmSignOut = async () => {
        setIsSigningOut(true);
        setIsSignOutOpen(false);
        let outcome: SignOutOutcome = 'failed';
        try {
            outcome = await signOut();
        } finally {
            setIsSigningOut(false);
        }

        if (outcome === 'failed') {
            // Deliberately NO navigation. Dropping them on a signed-out-looking
            // home page with a live session is the precise lie being removed.
            toast({
                title: 'Sign-out failed',
                description: 'You are still signed in. Check your connection and try again.',
                variant: 'destructive',
            });
            return;
        }

        // Only now: the role preferences are the user's, and a failed sign-out
        // must not cost them.
        localStorage.removeItem('profile_entry_role');
        localStorage.removeItem(LAST_ACTIVE_ROLE_KEY);
        if (outcome === 'signed-out-locally') {
            toast({
                title: 'Signed out on this device',
                description: 'We could not reach the server, so you may still be signed in elsewhere.',
            });
        }
        navigate('/', { replace: true });
    };

    const ids = {
        dancerId,
        dancerProfileComplete,
        organiserId,
        teacherId,
        videographerId,
        vendorId,
    };

    const handleSelectRole = (role: UserRole) => {
        setActiveRole(role);
        localStorage.setItem(LAST_ACTIVE_ROLE_KEY, role);
        navigate(`/profile?role=${role}`, { replace: true });
    };

    return (
        <GlobalLayout breadcrumbs={buildBreadcrumbs('profile')}>
            <ProfileEntryRouter
                user={user}
                loading={loading}
                ids={ids}
                availableRoles={availableRoles}
                activeRole={activeRole}
                onSelectRole={handleSelectRole}
                onRefreshRoles={refetch}
                onSignOut={() => setIsSignOutOpen(true)}
            />
        <Dialog open={isSignOutOpen} onOpenChange={setIsSignOutOpen}>
            <DialogContent className="sm:max-w-sm">
                <DialogHeader className="pb-1">
                    <DialogTitle>Sign out?</DialogTitle>
                    <DialogDescription>
                        You can sign back in any time.
                    </DialogDescription>
                </DialogHeader>
                <DialogFooter className="pt-2">
                    <Button variant="ghost" className="focus-visible:ring-2 focus-visible:ring-primary/60" onClick={() => setIsSignOutOpen(false)} disabled={isSigningOut} autoFocus>
                        Cancel
                    </Button>
                    <Button variant="destructive" className="focus-visible:ring-2 focus-visible:ring-red-400/50" onClick={handleConfirmSignOut} disabled={isSigningOut}>
                        {isSigningOut ? 'Signing out...' : 'Sign Out'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
        </GlobalLayout>
    );
};

export default Profile;
