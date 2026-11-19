import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { AuthGuard } from '@/components/auth/AuthGuard';
import { useAuth } from '@/hooks/useAuth';
import { useNoindexMeta } from '@/hooks/useNoindexMeta';
import { Door } from '../DoorScreen';
import { fetchMySeatName } from './doorJoinApi';

/**
 * /door/:seriesId -- the door screen for a door-seat holder (organiser R4 slice a): Scan | Search only,
 * no organiser header, no tab bar, every way out to the site's home page. Live whatever the organiser
 * flags. Who may scan, and for which night, is the database's call (the seat covers one night and
 * ends 12 hours after it); this page grants nothing and checks no role.
 */
export default function SeatDoorPage() {
  useNoindexMeta(true);
  return <AuthGuard><SeatDoor /></AuthGuard>;
}

function SeatDoor() {
  const { seriesId = '' } = useParams();
  const { user } = useAuth();
  const name = useQuery({
    queryKey: ['door-seat-name', user?.id ?? null, seriesId] as const,
    queryFn: () => fetchMySeatName(seriesId),
    enabled: !!user?.id && !!seriesId,
    staleTime: 60_000,
    retry: false,
  });
  return <Door seriesId={seriesId} nightName={name.data ?? null} r4 seatOnly />;
}
