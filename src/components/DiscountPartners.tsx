import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Card } from '@/components/ui/card';
import { ScrollReveal } from '@/components/ScrollReveal';
import { Badge } from '@/components/ui/badge';
import { Ticket, MapPin, CalendarDays } from 'lucide-react';
import { useCity } from '@/contexts/CityContext';
import { resolveEventImage } from '@/lib/utils';

interface PartnerWithEvent {
  id: string;
  name: string;
  photo_url: string[] | null;
  city: string | null;
  instagram: string | null;
  next_event_name?: string | null;
  next_event_date?: string | null;
}

export const DiscountPartners = () => {
  const { citySlug } = useCity();
  const { data: partners, isLoading } = useQuery({
    queryKey: ['discount-partners-with-events', citySlug],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_discount_partners_with_next_event' as any, {
        p_city_slug: citySlug,
      });

      if (error) throw error;
      return (data as PartnerWithEvent[]) || [];
    },
    enabled: !!citySlug,
  });

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const today = new Date();
    const isToday = date.getDate() === today.getDate() && date.getMonth() === today.getMonth();
    const isTomorrow = new Date(today.setDate(today.getDate() + 1)).getDate() === date.getDate();
    
    // Reset today for comparison
    today.setDate(today.getDate() - 1);

    if (isToday) return "Today";
    // Basic Tomorrow check (simplified)
    // Precise:
    const t = new Date();
    const d = new Date(dateStr);
    if(t.toDateString() === d.toDateString()) return "Today";
    t.setDate(t.getDate() + 1);
    if(t.toDateString() === d.toDateString()) return "Tomorrow";

    return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
  };

  if (isLoading) {
    return (
      <section className="py-12 px-4 mb-16">
        <div className="max-w-6xl mx-auto text-center">
            <p className="text-muted-foreground animate-pulse">Loading partners...</p>
        </div>
      </section>
    )
  }

  if (!partners || partners.length === 0) return null;

  return (
    <section className="py-12 px-4 mb-16">
      <div className="max-w-6xl mx-auto">
        <ScrollReveal animation="fadeUp">
          <div className="text-center mb-10">
            <h2 className="text-3xl font-bold mb-4">Partnering with London's Best</h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              We work with the top promoters and studios to bring you exclusive per-event savings.
              Subject to availability. More partners added monthly.
            </p>
          </div>
        </ScrollReveal>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
          {partners.map((partner, i) => (
            <ScrollReveal key={partner.id} animation="scale" delay={i * 0.05}>
              <Card className="group relative overflow-hidden p-6 hover:shadow-lg transition-all border-primary/10 bg-gradient-to-br from-card to-card/50 hover:from-primary/5 hover:to-primary/10 h-full flex flex-col items-center text-center">
                 
                 {/* Next Event Badge - Dynamic Utility */}
                 {partner.next_event_date && (
                    <div className="absolute top-0 right-0 left-0 bg-primary/10 border-b border-primary/10 py-1 flex items-center justify-center gap-1.5 backdrop-blur-md z-10">
                        <CalendarDays className="w-3 h-3 text-primary" />
                        <span className="text-[10px] font-bold text-primary uppercase tracking-wide">
                      Next: {formatDate(partner.next_event_date)}
                        </span>
                    </div>
                 )}

                <div className="mt-6 flex flex-col items-center w-full flex-1">
                  {/* Avatar with Glow */}
                  <div className="relative mb-4">
                    <div className="absolute -inset-1 bg-gradient-to-r from-primary to-festival-pink rounded-full opacity-0 group-hover:opacity-75 blur transition duration-500" />
                    <Avatar className="w-24 h-24 border-4 border-background relative">
                      <AvatarImage
                        src={resolveEventImage(partner.photo_url, null) || ''}
                        alt={partner.name}
                        className="object-cover"
                      />
                      <AvatarFallback className="text-xl bg-primary/10 text-primary font-bold">
                        {partner.name.substring(0, 2).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                  </div>

                  <h3 className="font-bold text-lg mb-1 leading-tight line-clamp-1 w-full">{partner.name}</h3>
                  
                  {/* Meta Info */}
                  <div className="flex items-center gap-1 text-xs text-muted-foreground mb-4">
                    <MapPin className="w-3 h-3" />
                    <span>{partner.city || 'London'}</span>
                  </div>

                  {/* Render 'Next Event Name' or Generic Benefit */}
                  <div className="mt-auto w-full">
                        {partner.next_event_name ? (
                          <div className="bg-background/80 backdrop-blur-sm border border-primary/20 rounded-lg px-2 py-2 flex flex-col items-center">
                              <span className="text-[10px] text-muted-foreground uppercase tracking-widest font-bold mb-0.5">Upcoming</span>
                            <span className="text-xs font-semibold text-foreground line-clamp-1">{partner.next_event_name}</span>
                          </div>
                      ) : (
                        <div className="bg-background/80 backdrop-blur-sm border border-primary/10 rounded-full px-3 py-1.5 flex items-center justify-center gap-2">
                            <Ticket className="w-3 h-3 text-gray-500" />
                            <span className="text-xs font-medium text-gray-400">
                            Check calendar
                            </span>
                        </div>
                      )}
                  </div>
                </div>
              </Card>
            </ScrollReveal>
          ))}
        </div>
      </div>
    </section>
  );
};
