import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Users, Heart, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { AuthPromptModal } from '@/components/AuthPromptModal';
import { attendanceQueryKeys, useAttendance, type AttendanceStatus } from '@/hooks/useAttendance';

interface EventAttendanceButtonsProps {
  eventId: string;
}

export const EventAttendanceButtons = ({ eventId }: EventAttendanceButtonsProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [clickedStatus, setClickedStatus] = useState<AttendanceStatus | null>(null);
  const { currentStatus: userStatus, setStatus, isLoading, error } = useAttendance(eventId);

  // Fetch engagement counts using RPC
  const { data: engagement } = useQuery({
    queryKey: attendanceQueryKeys.engagement(eventId),
    queryFn: async () => {
      const { data, error } = await supabase
        .rpc('get_event_engagement', { p_event_id: eventId });
      
      if (error) throw error;
      return data?.[0] ?? { interested_count: 0, going_count: 0 };
    },
    enabled: !!eventId,
  });

  useEffect(() => {
    if (!error) return;
    toast({
      title: 'Something went wrong',
      description: error,
      variant: 'destructive',
    });
  }, [error, toast]);

  const handleClick = async (status: AttendanceStatus) => {
    if (!user) {
      setShowAuthModal(true);
      return;
    }

    setClickedStatus(status);
    try {
      await setStatus(status);
    } finally {
      setClickedStatus(null);
    }
  };

  const interestedCount = engagement?.interested_count ?? 0;
  const goingCount = engagement?.going_count ?? 0;
  return (
    <>
      <div className="flex gap-3">
        <Button
          variant={userStatus === 'interested' ? 'default' : 'outline'}
          className="flex-1"
          onClick={() => void handleClick('interested')}
          disabled={isLoading}
        >
          {isLoading && clickedStatus === 'interested' ? (
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          ) : (
            <Heart className={`w-4 h-4 mr-2 ${userStatus === 'interested' ? 'fill-current' : ''}`} />
          )}
          Interested ({interestedCount})
        </Button>
        <Button
          variant={userStatus === 'going' ? 'default' : 'outline'}
          className="flex-1"
          onClick={() => void handleClick('going')}
          disabled={isLoading}
        >
          {isLoading && clickedStatus === 'going' ? (
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
