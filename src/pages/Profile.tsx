import { useEffect, useState, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useUserIds, UserRole } from '@/hooks/useUserIds';
import { ProfileEntryRouter } from '@/components/profile/ProfileEntryRouter';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';

const LAST_ACTIVE_ROLE_KEY = 'profile_last_active_role';

const Profile = () => {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const { user, signOut } = useAuth();
    const { dancerId, organiserId, teacherId, djId, videographerId, vendorId, loading, refetch } = useUserIds();
    const [activeRole, setActiveRole] = useState<UserRole>('dancer');
    const [isSignOutOpen, setIsSignOutOpen] = useState(false);
    const [isSigningOut, setIsSigningOut] = useState(false);
    
    // Determine available roles (Strictly defined by presence of ID)
    const availableRoles: UserRole[] = useMemo(() => [
        dancerId ? 'dancer' : null,
        organiserId ? 'organiser' : null,
        teacherId ? 'teacher' : null,
        djId ? 'dj' : null,
        videographerId ? 'videographer' : null,
        vendorId ? 'vendor' : null
    ].filter(Boolean) as UserRole[], [dancerId, organiserId, teacherId, djId, videographerId, vendorId]);

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

    const handleConfirmSignOut = async () => {
        setIsSigningOut(true);
        setIsSignOutOpen(false);
        localStorage.removeItem('profile_entry_role');
        localStorage.removeItem(LAST_ACTIVE_ROLE_KEY);
        navigate('/', { replace: true });
        try {
            await signOut();
        } finally {
            setIsSigningOut(false);
        }
    };

    const ids = {
        dancerId,
        organiserId,
        teacherId,
        djId,
        videographerId,
        vendorId,
    };

    const handleSelectRole = (role: UserRole) => {
        setActiveRole(role);
        localStorage.setItem(LAST_ACTIVE_ROLE_KEY, role);
        navigate(`/profile?role=${role}`, { replace: true });
    };

    return (
        <>
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
        </>
    );
};

export default Profile;
