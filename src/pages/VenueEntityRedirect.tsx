import { useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

/**
 * Redirect /venue-entity/:id (entity UUID) → /venue/:venueId (venues UUID).
 * Falls back to /venues if no matching venue row is found.
 */
const VenueEntityRedirect = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const { data: venueId, isLoading } = useQuery({
    queryKey: ['venue-entity-redirect', id],
    queryFn: async () => {
      const { data } = await supabase
        .from('venues')
        .select('id')
        .eq('entity_id', id!)
        .limit(1)
        .single();
      return data?.id ?? null;
    },
    enabled: !!id,
  });

  useEffect(() => {
    if (isLoading) return;
    if (venueId) {
      navigate(`/venue/${venueId}`, { replace: true });
    } else {
      navigate('/venues', { replace: true });
    }
  }, [venueId, isLoading, navigate]);

  return (
    <div className="p-6 text-center text-muted-foreground">Redirecting…</div>
  );
};

export default VenueEntityRedirect;
