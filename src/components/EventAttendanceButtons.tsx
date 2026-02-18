import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Users, Heart, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { AuthPromptModal } from '@/components/AuthPromptModal';

interface EventAttendanceButtonsProps {
  eventId: string;
}

export const EventAttendanceButtons = ({ eventId }: EventAttendanceButtonsProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [showAuthModal, setShowAuthModal] = useState(false);

  // Fetch engagement counts using RPC
  const { data: engagement } = useQuery({
    queryKey: ['event-engagement', eventId],
    queryFn: async () => {
      const { data, error } = await supabase
        .rpc('get_event_engagement', { p_event_id: eventId });
      
      if (error) throw error;
      return data?.[0] ?? { interested_count: 0, going_count: 0 };
    },
    enabled: !!eventId,
  });

  // Fetch current user's participation status
  const { data: userStatus, isLoading: statusLoading } = useQuery({
    queryKey: ['event-participation', eventId, user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      
      const { data, error } = await supabase
        .from('event_participants')
        .select('status')
        .eq('event_id', eventId)
        .eq('user_id', user.id)
        .maybeSingle();
      
      if (error) throw error;
      return data?.status as 'interested' | 'going' | null;
    },
    enabled: !!eventId && !!user?.id,
  });

  // Mutation to update participation
  const participationMutation = useMutation({
    mutationFn: async (newStatus: 'interested' | 'going') => {
      if (!user?.id) throw new Error('Not authenticated');

      // If same status, remove participation
      if (userStatus === newStatus) {
        const { error } = await supabase
          .from('event_participants')
          .delete()
          .eq('event_id', eventId)
          .eq('user_id', user.id);
        
        if (error) throw error;
        return null;
      }

      // Upsert participation
      const { error } = await supabase
        .from('event_participants')
        .upsert(
          {
            event_id: eventId,
            user_id: user.id,
            status: newStatus,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'event_id,user_id' }
        );
      
      if (error) throw error;
      return newStatus;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['event-engagement', eventId] });
      queryClient.invalidateQueries({ queryKey: ['event-participation', eventId, user?.id] });
    },
    onError: (error) => {
      console.error('Participation error:', error);
      toast({
        title: 'Something went wrong',
        description: 'Could not update your attendance. Please try again.',
        variant: 'destructive',
      });
    },
  });

  const handleClick = (status: 'interested' | 'going') => {
    if (!user) {
      setShowAuthModal(true);
      return;
    }
    participationMutation.mutate(status);
  };

  const interestedCount = engagement?.interested_count ?? 0;
  const goingCount = engagement?.going_count ?? 0;
  const isUpdating = participationMutation.isPending;

  return (
    <>
      <div className="flex gap-3">
        <Button
          variant={userStatus === 'interested' ? 'default' : 'outline'}
          className="flex-1"
          onClick={() => handleClick('interested')}
          disabled={isUpdating || statusLoading}
        >
          {isUpdating && userStatus !== 'interested' ? (
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          ) : (
            <Heart className={`w-4 h-4 mr-2 ${userStatus === 'interested' ? 'fill-current' : ''}`} />
          )}
          Interested ({interestedCount})
        </Button>
        <Button
          variant={userStatus === 'going' ? 'default' : 'outline'}
          className="flex-1"
          onClick={() => handleClick('going')}
          disabled={isUpdating || statusLoading}
        >
          {isUpdating && userStatus !== 'going' ? (
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          ) : (
            <Users className={`w-4 h-4 mr-2 ${userStatus === 'going' ? 'fill-current' : ''}`} />
          )}
          Going ({goingCount})
        </Button>
      </div>

      <AuthPromptModal
        open={showAuthModal}
        onOpenChange={setShowAuthModal}
        title="Sign in Required"
        description="Sign in to mark your attendance for this event."
      />
    </>
  );
};
