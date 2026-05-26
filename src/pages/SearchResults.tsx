import { useMemo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Calendar, Building2, GraduationCap, Music, User, MapPin } from 'lucide-react';
import GlobalLayout from '@/components/layout/GlobalLayout';
import { buildBreadcrumbs } from '@/lib/breadcrumbs';
import { useCity } from '@/contexts/CityContext';
import { useSearchResults } from '@/hooks/useSearchResults';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

type PersonLike = {
  first_name: string | null;
  surname: string | null;
  display_name: string | null;
};

const personName = (p: PersonLike) =>
  p.display_name || [p.first_name, p.surname].filter(Boolean).join(' ') || 'Profile';

const firstVenuePhoto = (urls: string[] | null) =>
  urls && urls.length > 0 ? urls[0] : null;

type ResultCardProps = {
  to: string;
  image: string | null;
  title: string;
  subtitle?: string;
  fallbackIcon: React.ReactNode;
};

const ResultCard = ({ to, image, title, subtitle, fallbackIcon }: ResultCardProps) => (
  <Link to={to} className="block group">
    <Card className="overflow-hidden border-primary/15 hover:border-primary/40 transition-colors h-full">
      <div className="aspect-[4/3] bg-muted/50 relative">
        {image ? (
          <img src={image} alt={title} className="w-full h-full object-cover" loading="lazy" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-muted-foreground/40">
            {fallbackIcon}
          </div>
        )}
      </div>
      <div className="p-3">
        <h3 className="text-sm font-bold text-foreground line-clamp-2 group-hover:text-primary transition-colors">
          {title}
        </h3>
        {subtitle && (
          <p className="text-xs text-muted-foreground line-clamp-1 mt-1">{subtitle}</p>
        )}
      </div>
    </Card>
  </Link>
);

const SectionHeader = ({
  icon,
  title,
  count,
}: {
  icon: React.ReactNode;
  title: string;
  count: number;
}) => (
  <div className="flex items-center gap-2 mb-3">
    {icon}
    <h2 className="text-base font-bold text-foreground">{title}</h2>
    <span className="text-xs text-muted-foreground">({count})</span>
  </div>
);

const SectionGrid = ({ children }: { children: React.ReactNode }) => (
  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">{children}</div>
);

const SearchResults = () => {
  const [params] = useSearchParams();
  const query = (params.get('q') ?? '').trim();
  const { citySlug } = useCity();
  const { data, isLoading, error } = useSearchResults(query, citySlug);

  const breadcrumbs = useMemo(
    () =>
      buildBreadcrumbs('search.results', {
        entityName: query ? `"${query}"` : undefined,
        isLoading: query.length > 0 && isLoading,
      }),
    [query, isLoading],
  );

  const summaryParts: string[] = [];
  if (data) {
    if (data.events.length) summaryParts.push(`${data.events.length} events`);
    if (data.organisers.length) summaryParts.push(`${data.organisers.length} organisers`);
    if (data.djs.length) summaryParts.push(`${data.djs.length} DJs`);
    if (data.teachers.length) summaryParts.push(`${data.teachers.length} teachers`);
    if (data.dancers.length) summaryParts.push(`${data.dancers.length} dancers`);
    if (data.venues.length) summaryParts.push(`${data.venues.length} venues`);
  }

  return (
    <GlobalLayout breadcrumbs={breadcrumbs}>
      <section className="px-4 py-6 max-w-5xl mx-auto">
        <header className="mb-6">
          <h1 className="text-2xl md:text-3xl font-black text-foreground">
            {query ? (
              <>
                Results for <span className="text-primary">&ldquo;{query}&rdquo;</span>
              </>
            ) : (
              'Search'
            )}
          </h1>
          {data && data.total_count > 0 && summaryParts.length > 0 && (
            <p className="text-sm text-muted-foreground mt-1">
              {summaryParts.join(' \u00B7 ')}
            </p>
          )}
        </header>

        {!query && (
          <div className="rounded-xl border border-primary/15 bg-card/40 p-6 text-center">
            <p className="text-sm text-muted-foreground">Type a word to search the site.</p>
          </div>
        )}

        {query && isLoading && (
          <div className="space-y-6">
            {[0, 1].map((i) => (
              <div key={i} className="space-y-3">
                <Skeleton className="h-5 w-32" />
                <SectionGrid>
                  {[0, 1, 2, 3].map((j) => (
                    <Skeleton key={j} className="h-40 w-full rounded-xl" />
                  ))}
                </SectionGrid>
              </div>
            ))}
          </div>
        )}

        {query && error && (
          <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-6 text-center">
            <p className="text-sm text-destructive">
              Couldn&rsquo;t load results. Try again in a moment.
            </p>
          </div>
        )}

        {query && data && data.total_count === 0 && (
          <div className="rounded-xl border border-primary/15 bg-card/40 p-6 text-center">
            <p className="text-sm text-muted-foreground">
              No results for &ldquo;{query}&rdquo;. Try a different word.
            </p>
          </div>
        )}

        {query && data && data.total_count > 0 && (
          <div className="space-y-8">
            {data.events.length > 0 && (
              <section>
                <SectionHeader
                  icon={<Calendar className="w-4 h-4 text-primary" />}
                  title="Events"
                  count={data.events.length}
                />
                <SectionGrid>
                  {data.events.map((e) => (
                    <ResultCard
                      key={e.id}
                      to={`/event/${e.id}`}
                      image={e.poster_url}
                      title={e.name}
                      subtitle={e.city_slug ?? undefined}
                      fallbackIcon={<Calendar className="w-8 h-8" />}
                    />
                  ))}
                </SectionGrid>
              </section>
            )}

            {data.organisers.length > 0 && (
              <section>
                <SectionHeader
                  icon={<Building2 className="w-4 h-4 text-primary" />}
                  title="Organisers"
                  count={data.organisers.length}
                />
                <SectionGrid>
                  {data.organisers.map((o) => (
                    <ResultCard
                      key={o.id}
                      to={`/organisers/${o.id}`}
                      image={o.avatar_url}
                      title={o.name ?? 'Organiser'}
                      fallbackIcon={<Building2 className="w-8 h-8" />}
                    />
                  ))}
                </SectionGrid>
              </section>
            )}

            {data.teachers.length > 0 && (
              <section>
                <SectionHeader
                  icon={<GraduationCap className="w-4 h-4 text-primary" />}
                  title="Teachers"
                  count={data.teachers.length}
                />
                <SectionGrid>
                  {data.teachers.map((t) => (
                    <ResultCard
                      key={t.id}
                      to={`/teachers/${t.id}`}
                      image={t.photo_url ?? t.avatar_url}
                      title={personName(t)}
                      fallbackIcon={<GraduationCap className="w-8 h-8" />}
                    />
                  ))}
                </SectionGrid>
              </section>
            )}

            {data.djs.length > 0 && (
              <section>
                <SectionHeader
                  icon={<Music className="w-4 h-4 text-primary" />}
                  title="DJs"
                  count={data.djs.length}
                />
                <SectionGrid>
                  {data.djs.map((d) => (
                    <ResultCard
                      key={d.id}
                      to={`/djs/${d.id}`}
                      image={d.photo_url ?? d.avatar_url}
                      title={personName(d)}
                      fallbackIcon={<Music className="w-8 h-8" />}
                    />
                  ))}
                </SectionGrid>
              </section>
            )}

            {data.dancers.length > 0 && (
              <section>
                <SectionHeader
                  icon={<User className="w-4 h-4 text-primary" />}
                  title="Dancers"
                  count={data.dancers.length}
                />
                <SectionGrid>
                  {data.dancers.map((d) => (
                    <ResultCard
                      key={d.id}
                      to={`/dancers/${d.id}`}
                      image={d.avatar_url ?? d.photo_url}
                      title={personName(d)}
                      fallbackIcon={<User className="w-8 h-8" />}
                    />
                  ))}
                </SectionGrid>
              </section>
            )}

            {data.venues.length > 0 && (
              <section>
                <SectionHeader
                  icon={<MapPin className="w-4 h-4 text-primary" />}
                  title="Venues"
                  count={data.venues.length}
                />
                <SectionGrid>
                  {data.venues.map((v) => (
                    <ResultCard
                      key={v.id}
                      to={`/venue-entity/${v.id}`}
                      image={firstVenuePhoto(v.photo_url)}
                      title={v.name ?? 'Venue'}
                      subtitle={v.address ?? undefined}
                      fallbackIcon={<MapPin className="w-8 h-8" />}
                    />
                  ))}
                </SectionGrid>
              </section>
            )}
          </div>
        )}
      </section>
    </GlobalLayout>
  );
};

export default SearchResults;
