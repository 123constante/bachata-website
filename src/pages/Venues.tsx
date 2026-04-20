import { Building2, MapPin, Users, Music, Layers, Lightbulb } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { Skeleton } from '@/components/ui/skeleton';
import { StaggerContainer, StaggerItem } from '@/components/ScrollReveal';
import PageLayout from '@/components/PageLayout';
import { fetchPublicVenuesList } from '@/services/venuePublicService';
import { VenueCard } from '@/components/venue/VenueCard';

const Venues = () => {
  const { data: venues = [], isLoading } = useQuery({
    queryKey: ['venues-directory'],
    queryFn: fetchPublicVenuesList,
    staleTime: 5 * 60 * 1000,
  });

  return (
    <PageLayout
      emoji="🏛️"
      titleWhite="Dance"
      titleOrange="Venues"
      subtitle="Find the perfect space for bachata — studios, clubs, and event halls."
      floatingIcons={[Building2, MapPin, Users, Music, Layers, Lightbulb]}
      breadcrumbLabel="Venues"
    >
      <div className="max-w-6xl mx-auto px-4">
        {isLoading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
            {Array.from({ length: 10 }).map((_, i) => (
              <div key={i} className="rounded-2xl border border-border/40 bg-card overflow-hidden">
                <Skeleton className="aspect-[4/3] w-full" />
                <div className="p-3 space-y-1.5">
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-3 w-1/2" />
                  <Skeleton className="h-3 w-2/3" />
                </div>
              </div>
            ))}
          </div>
        ) : venues.length === 0 ? (
          <div className="text-center py-12">
            <Building2 className="w-8 h-8 mx-auto mb-2 text-muted-foreground/30" />
            <p className="text-xs text-muted-foreground">No venues yet.</p>
          </div>
        ) : (
          <StaggerContainer className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
            {venues.map((venue) => (
              <StaggerItem key={venue.id}>
                <VenueCard venue={venue} />
              </StaggerItem>
            ))}
          </StaggerContainer>
        )}
      </div>
    </PageLayout>
  );
};

export default Venues;
