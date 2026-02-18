import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

interface EventPermissionsResult {
  canEdit: boolean;
  canPublish: boolean;
  isLoading: boolean;
}

/**
 * Hook to check if the current user has edit permissions for a specific event.
 * 
 * Permission model (V1):
 * - canEdit: user is admin, OR user is event.created_by, OR user has event_permissions row
 * - canPublish: user is admin, OR user is event.created_by
 * 
 * IMPORTANT: Profile claiming does NOT grant event editing rights.
 */
export const useEventPermissions = (eventId: string | undefined, createdBy: string | null | undefined): EventPermissionsResult => {
  const { user } = useAuth();

  // Check if user is admin
  const { data: userProfile, isLoading: profileLoading } = useQuery({
    queryKey: ['profile-admin', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const { data, error } = await supabase
        .from('profiles')
        .select('is_admin')
        .eq('id', user.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!user?.id,
  });

  // Check if user has explicit event_permissions row
  const { data: eventPermission, isLoading: permissionLoading } = useQuery({
    queryKey: ['event-permission', eventId, user?.id],
    queryFn: async () => {
      if (!user?.id || !eventId) return null;
      const { data, error } = await supabase
        .from('event_permissions')
        .select('role')
        .eq('event_id', eventId)
        .eq('user_id', user.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!user?.id && !!eventId,
  });

  const isAdmin = userProfile?.is_admin === true;
  const isCreator = !!(user?.id && createdBy && user.id === createdBy);
  const hasExplicitPermission = !!eventPermission?.role;

  return {
    canEdit: isAdmin || isCreator || hasExplicitPermission,
    canPublish: isAdmin || isCreator,
    isLoading: profileLoading || permissionLoading,
  };
};
