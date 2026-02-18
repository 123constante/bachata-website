import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Building2 } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollReveal } from '@/components/ScrollReveal';
import PageBreadcrumb from '@/components/PageBreadcrumb';

const VenueDirectory = () => {
  const { data: venues, isLoading } = useQuery({
    queryKey: ['venue-entities'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('entities')
        .select('id, name, avatar_url, city')
        .eq('type', 'venue')
        .order('name');

      if (error) throw error;
      return data ?? [];
    },
  });

  return (
    <div className="min-h-screen pt-20 pb-24">
      <PageBreadcrumb items={[{ label: 'Venues' }]} />
      <div className="max-w-6xl mx-auto px-4">
        {/* Hero */}
        <ScrollReveal animation="fadeUp">
          <div className="text-center mb-12">
            <div className="text-6xl mb-4">›ï¸</div>
            <h1 className="text-4xl md:text-5xl font-bold text-foreground mb-3">
              <span className="text-foreground">Bachata</span>{' '}
              <span className="text-primary">Venues</span>
            </h1>
            <p className="text-sm text-muted-foreground max-w-md mx-auto">
              Explore dance venues hosting bachata events in London
            </p>
          </div>
        </ScrollReveal>

        {/* Directory Grid */}
        <ScrollReveal animation="fadeUp" delay={0.1}>
          {isLoading ? (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {Array.from({ length: 8 }).map((_, i) => (
                <Card key={i} className="overflow-hidden">
                  <CardContent className="p-4">
                    <Skeleton className="w-16 h-16 rounded-full mx-auto mb-3" />
                    <Skeleton className="h-5 w-3/4 mx-auto mb-2" />
                    <Skeleton className="h-4 w-1/2 mx-auto" />
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : venues && venues.length > 0 ? (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {venues.map((venue) => (
                <Link key={venue.id} to={`/venue-entity/${venue.id}`}>
                  <Card className="overflow-hidden hover:border-primary/50 transition-colors h-full">
                    <CardContent className="p-4 text-center">
                      <Avatar className="w-16 h-16 mx-auto mb-3 border border-primary/20">
                        <AvatarImage src={venue.avatar_url || undefined} alt={venue.name} />
                        <AvatarFallback className="bg-primary/10 text-primary">
                          <Building2 className="w-6 h-6" />
                        </AvatarFallback>
                      </Avatar>
                      <p className="font-medium text-foreground truncate">{venue.name}</p>
                      {venue.city && (
                        <p className="text-sm text-muted-foreground truncate">{venue.city}</p>
                      )}
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          ) : (
            <div className="text-center py-12">
              <Building2 className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">No venues listed yet</p>
            </div>
          )}
        </ScrollReveal>
      </div>
    </div>
  );
};

export default VenueDirectory;


