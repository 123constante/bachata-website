import { motion } from 'framer-motion';
import { Headphones } from 'lucide-react';
import { useMemo } from 'react';
import { flags } from '@/lib/featureFlags';
import { usePeopleBadges } from '@/modules/person-page/badges';
import { djTile, sortDjsUpcomingFirst } from '@/components/dj/djListModel';
import { Link } from 'react-router-dom';
import { emitProfileView } from '@/lib/profileViewEmit';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Skeleton } from '@/components/ui/skeleton';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { StaggerContainer, StaggerItem } from '@/components/ScrollReveal';
import GlobalLayout from '@/components/layout/GlobalLayout';
import { useSeo, buildSeoForRoute } from '@/lib/seo';
import { renderPublicName } from '@/lib/publicName';
import { NationalityFlag } from '@/components/people/NationalityFlag';

type DJCard = {
  id: string;
  display_name: string | null;
  dj_name: string | null;
  first_name: string | null;
  surname: string | null;
  photo_url: string | string[] | null;
  bio: string | null;
  genres: string[] | null;
  nationality: string | null;
  nationality_code?: string | null;
  city_id: string | null;
  city_name: string | null;
  city_slug: string | null;
  person_entity_id: string | null;
  has_upcoming_gig?: boolean | null;
  next_gig_date?: string | null;
};

const DJs = () => {
  useSeo(buildSeoForRoute('djs'));
  const { data: djs = [], isLoading } = useQuery({
    queryKey: ['dj-profiles-directory'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('list_public_djs_v1', {
        p_city_id: null,
        p_limit: 200,
      });
      if (error) throw error;
      return ((data ?? []) as unknown) as DJCard[];
    },
    staleTime: 5 * 60 * 1000,
  });

  const teacherPagesOpen = flags.teacherDetail;
  const sorted = useMemo(() => sortDjsUpcomingFirst(djs), [djs]);
  const { badges } = usePeopleBadges(useMemo(() => djs.map((d) => d.id), [djs]));

  return (
    <GlobalLayout
      showSubheader={false}
      gradientPalette="dj"
      hero={{
        emoji: '\u{1F3A7}',
        titleWhite: 'Bachata',
        titleOrange: 'DJs',
        subtitle: 'Discover the DJs behind the music — sensual, traditional, and everything in between.',
      }}
    >
      <div className="max-w-6xl mx-auto px-4">
        {/* Grid */}
        {isLoading ? (
          <div className="grid grid-cols-3 lg:grid-cols-4 gap-2">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="rounded-2xl border border-border/40 bg-card p-4 space-y-3">
                <Skeleton className="h-16 w-16 rounded-full mx-auto" />
                <Skeleton className="h-4 w-24 mx-auto" />
                <Skeleton className="h-3 w-16 mx-auto" />
              </div>
            ))}
          </div>
        ) : djs.length === 0 ? (
          <div className="text-center py-16">
            <Headphones className="w-10 h-10 mb-3 mx-auto text-muted-foreground" />
            <p className="text-muted-foreground">No DJs yet.</p>
          </div>
        ) : (
          <StaggerContainer className="grid grid-cols-3 lg:grid-cols-4 gap-2">
            {sorted.map((dj) => {
              // Measured on prod 2026-09-01: list_public_djs_v1 returns a UUID-shaped
              // display_name for 2 of its 37 rows, the same id fallback
              // get_public_dj_v1 carries. A UUID is truthy, so the old `||` chain
              // rendered it as the card label -- linking to a detail page that now
              // correctly refuses to. Same resolver as the detail page and /dancers.
              const tile = djTile(dj, renderPublicName(dj, 'DJ'), badges.get(dj.id), teacherPagesOpen);
              const displayName = tile.name;
              const coverPhoto = Array.isArray(dj.photo_url)
                ? (dj.photo_url[0] ?? null)
                : ((dj.photo_url as string | null) ?? null);
              const cityName = dj.city_name;

              return (
                <StaggerItem key={dj.id}>
                  <Link
                  to={tile.href ?? `/djs/${dj.id}`}
                  data-testid="dj-tile"
                  onClick={() => emitProfileView({ personId: dj.id, profileType: 'dj', context: 'listing:djs' })}
                >
                    <motion.div
                      whileHover={{ y: -4, scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      className="rounded-xl p-2 text-center hover:bg-white/5 transition-colors h-full flex flex-col"
                    >
                      <div className="relative mx-auto mb-3 w-fit">
                        <Avatar className="w-16 h-16 border border-primary/10">
                          <AvatarImage src={coverPhoto || undefined} alt={displayName} className="object-cover" />
                          <AvatarFallback className="bg-primary/10 text-primary text-xl font-black">
                            {displayName.charAt(0)}
                          </AvatarFallback>
                        </Avatar>
                        <NationalityFlag code={dj.nationality_code} size={64} />
                      </div>

                      <p className="font-bold text-sm text-foreground leading-tight mb-0.5 break-words">{displayName}</p>
                      {tile.playingSoon && (
                        <p className="text-[12px] font-semibold text-amber-300 mb-0.5" data-testid="playing-soon">Playing soon</p>
                      )}
                      {cityName && (
                        <p className="text-xs text-muted-foreground mb-2 line-clamp-1">{cityName}</p>
                      )}

                      <div className="mt-auto pt-1 h-[26px] box-content flex items-center justify-center gap-1.5 overflow-hidden" data-testid="role-labels">
                        {tile.tags.map((t) => (
                          <span key={t.role} className="text-[12px] leading-none text-muted-foreground">{t.label}</span>
                        ))}
                      </div>
                    </motion.div>
                  </Link>
                </StaggerItem>
              );
            })}
          </StaggerContainer>
        )}

        {!isLoading && djs.length > 0 && (
          <p className="text-center text-xs text-muted-foreground mt-8">
            {djs.length} DJ{djs.length !== 1 ? 's' : ''}
          </p>
        )}
      </div>
    </GlobalLayout>
  );
};

export default DJs;
