import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  GraduationCap, Star, Heart, Music, Sparkles, Search, X,
  ChevronDown, Check, MapPin, Users, User, Instagram, Globe, RefreshCw,
} from 'lucide-react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import GlobalLayout from '@/components/layout/GlobalLayout';
import { useSeo, buildSeoForRoute } from '@/lib/seo';
import { ScrollReveal, StaggerContainer, StaggerItem } from '@/components/ScrollReveal';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import ListingRequestForm from '@/components/ListingRequestForm';
import { cn } from '@/lib/utils';
import { buildFullName } from '@/lib/name-utils';
import { buildCityPath } from '@/lib/cityPath';
import {
  DEFAULT_TEACHERS_CITY, TELL_US_LABEL, resolveTeachersCity, teachersCityCopy, teachersPath, type CityRow,
} from '@/modules/teachers-directory/teachersCity';
import { emitProfileView } from '@/lib/profileViewEmit';
import { optimizedImageUrl } from '@/lib/imageCdn';
import { NationalityFlag } from '@/components/people/NationalityFlag';

type Teacher = {
  id: string;
  first_name: string | null;
  surname: string | null;
  photo_url: string | null;
  teaching_styles: string[] | null;
  years_teaching: number | null;
  offers_group: boolean | null;
  offers_private: boolean | null;
  instagram: string | null;
  website: string | null;
  languages: string[] | null;
  nationality: string | null;
  nationality_code: string | null;
  hide_surname: boolean | null;
  city: { name: string } | null;
};

type FilterType = 'all' | 'name' | 'style';

// 44px tap height in px, not rem: the phone html font-size is ~13.5px.
const TAP = 'min-h-[44px]';

const Teachers = () => {
  const navigate = useNavigate();
  const { slug } = useParams<{ slug: string }>();
  const wantedSlug = (slug ?? '').toLowerCase();

  // The switcher's list and the "is this slug active" test are one read:
  // cities with is_active = true (anon SELECT, policy "Public read").
  const activeCitiesQuery = useQuery({
    queryKey: ['teachers-directory-active-cities'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('cities')
        .select('name, slug')
        .eq('is_active', true)
        .order('name');
      if (error) throw error;
      return (data ?? []) as CityRow[];
    },
    staleTime: 10 * 60 * 1000,
  });
  const activeCities = activeCitiesQuery.data;
  const isActiveSlug = !!activeCities?.some((c) => c.slug === wantedSlug);

  // Only for a slug that is not active: its name, so the note can say "Madrid".
  const requestedQuery = useQuery({
    queryKey: ['teachers-directory-city-name', wantedSlug],
    enabled: !!activeCities && !isActiveSlug && !!wantedSlug,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('cities')
        .select('name, slug')
        .eq('slug', wantedSlug)
        .limit(1);
      if (error) throw error;
      return ((data ?? [])[0] ?? null) as CityRow | null;
    },
    staleTime: 10 * 60 * 1000,
  });

  const citiesSettled = !!activeCities && (isActiveSlug || !wantedSlug || !requestedQuery.isLoading);
  const view = citiesSettled
    ? resolveTeachersCity(wantedSlug, activeCities ?? [], requestedQuery.data ?? null)
    : null;

  // Fetched IN PARALLEL with the cities read, on the URL's own slug (almost
  // always an active city, so the key does not change when the view settles).
  // An inactive or unknown slug then switches the key to London's list.
  const listSlug = view?.listSlug ?? (wantedSlug || DEFAULT_TEACHERS_CITY.slug);
  const teachersQuery = useQuery({
    queryKey: ['teacher-profiles-directory', listSlug],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_public_teachers_list_v1', {
        p_city_slug: listSlug,
        p_limit: 200,
        p_offset: 0,
      });

      if (error) throw error;
      return (data ?? []).map((row: {
        entity_id: string;
        first_name: string | null;
        surname: string | null;
        photo_url: string | null;
        city: string | null;
        nationality: string | null;
        nationality_code?: string | null;
        years_teaching: number | null;
        teaching_styles: string[] | null;
        offers_group: boolean | null;
        offers_private: boolean | null;
        hide_surname: boolean | null;
        languages: string[] | null;
        instagram: string | null;
        website: string | null;
      }) => ({
        id: row.entity_id,
        first_name: row.first_name,
        surname: row.surname,
        photo_url: row.photo_url,
        teaching_styles: row.teaching_styles,
        years_teaching: row.years_teaching,
        offers_group: row.offers_group,
        offers_private: row.offers_private,
        instagram: row.instagram,
        website: row.website,
        languages: row.languages,
        nationality: row.nationality,
        nationality_code: row.nationality_code ?? null,
        hide_surname: row.hide_surname,
        city: row.city ? { name: row.city } : null,
      })) as Teacher[];
    },
    staleTime: 5 * 60 * 1000,
  });
  const teachers = useMemo(() => teachersQuery.data ?? [], [teachersQuery.data]);
  const isLoading = !view || teachersQuery.isLoading;
  const loadError = activeCitiesQuery.isError || requestedQuery.isError || teachersQuery.isError;
  const retry = () => {
    if (activeCitiesQuery.isError) void activeCitiesQuery.refetch();
    if (requestedQuery.isError) void requestedQuery.refetch();
    if (teachersQuery.isError) void teachersQuery.refetch();
  };

  const copy = view ? teachersCityCopy(view, teachersQuery.isSuccess ? teachers.length : null) : null;
  useSeo(buildSeoForRoute('teachers', copy?.seo ?? { canonicalPath: teachersPath(DEFAULT_TEACHERS_CITY.slug) }));
  const classesPath = buildCityPath(listSlug, 'classes');
  const [switcherOpen, setSwitcherOpen] = useState(false);
  const [tellUsOpen, setTellUsOpen] = useState(false);

  // Filter state
  const [activeFilter, setActiveFilter] = useState<FilterType>('all');
  const [searchName, setSearchName] = useState('');
  const [selectedStyle, setSelectedStyle] = useState<string | null>(null);

  // A city change is a new list: close the sheet and "Tell us", drop the Name/Style
  // filters, so Manchester never opens on London's choice. Reset during render
  // (React's "adjust state when a prop changes" pattern), not in an effect, so
  // the new city never paints one frame with the old state.
  const [stateSlug, setStateSlug] = useState(wantedSlug);
  if (stateSlug !== wantedSlug) {
    setStateSlug(wantedSlug);
    setSwitcherOpen(false);
    setTellUsOpen(false);
    setActiveFilter('all');
    setSearchName('');
    setSelectedStyle(null);
  }

  const uniqueStyles = useMemo(
    () => [...new Set(teachers.flatMap((t) => t.teaching_styles || []))].sort(),
    [teachers],
  );

  const filteredTeachers = useMemo(() => {
    return teachers.filter((t) => {
      if (activeFilter === 'name' && searchName) {
        const full = buildFullName(t.first_name ?? '', t.hide_surname ? null : t.surname);
        return full.toLowerCase().includes(searchName.toLowerCase());
      }
      if (activeFilter === 'style' && selectedStyle) {
        return t.teaching_styles?.includes(selectedStyle);
      }
      return true;
    });
  }, [teachers, activeFilter, searchName, selectedStyle]);

  const clearFilters = () => {
    setActiveFilter('all');
    setSearchName('');
    setSelectedStyle(null);
  };

  const getDisplayName = (t: Teacher) =>
    buildFullName(t.first_name ?? '', t.hide_surname ? null : t.surname);

  const getExperienceLabel = (years: number | null) => {
    if (!years) return null;
    if (years >= 10) return '10+ yrs';
    return `${years} yr${years > 1 ? 's' : ''}`;
  };

  const filterTabs: { value: FilterType; label: string; icon: string }[] = [
    { value: 'all', label: 'All', icon: '✨' },
    { value: 'name', label: 'Name', icon: '🔍' },
    { value: 'style', label: 'Style', icon: '💃' },
  ];

  return (
    <GlobalLayout
      showSubheader={false}
      floatingCount={15}
      hero={{
        emoji: '🎓',
        titleWhite: 'Find',
        titleOrange: 'Teachers',
        subtitle: '',
        largeTitle: true,
        floatingIcons: [GraduationCap, Star, Heart, Music, Sparkles],
      }}
    >
      <section className="mx-auto max-w-3xl px-4 pt-3">
        <p className="text-sm sm:text-base leading-relaxed text-muted-foreground">
          {copy?.subtitle ?? 'Bachata teachers - find an instructor, browse their classes, learn their style.'}{' '}
          Use the filters below to narrow by name or style. New to bachata? Start with the{' '}
          <Link to={classesPath} className="text-primary underline">classes page</Link>{' '}
          for beginner-friendly rooms.
        </p>
      </section>

      {/* Hero Widgets */}
      <div className="relative z-10 px-4 -mt-6 mb-16">
        <ScrollReveal animation="scale" delay={0.6}>
          <div className="flex flex-wrap justify-center gap-3 md:gap-4 mt-8">
            <motion.div
              onClick={() => document.getElementById('directory')?.scrollIntoView({ behavior: 'smooth' })}
              className="cursor-pointer p-4 md:p-5 bg-gradient-to-br from-surface/80 to-surface/40 backdrop-blur-sm rounded-2xl border border-primary/30 shadow-lg w-[140px] md:w-[160px]"
              whileHover={{ scale: 1.05, boxShadow: '0 20px 40px rgba(0,0,0,0.3)' }}
              whileTap={{ scale: 0.95 }}
            >
              <span className="text-3xl md:text-4xl block mb-2">{'🔍'}</span>
              <h3 className="font-bold text-xs md:text-sm text-foreground">Browse Teachers</h3>
            </motion.div>
            <motion.div
              onClick={() => navigate(classesPath)}
              className="cursor-pointer p-4 md:p-5 bg-gradient-to-br from-blue-500/20 to-cyan-500/10 backdrop-blur-sm rounded-2xl border border-blue-500/30 shadow-lg w-[140px] md:w-[160px]"
              whileHover={{ scale: 1.05, boxShadow: '0 20px 40px rgba(0,0,0,0.3)' }}
              whileTap={{ scale: 0.95 }}
            >
              <span className="text-3xl md:text-4xl block mb-2">{'📚'}</span>
              <h3 className="font-bold text-xs md:text-sm text-foreground">Find Classes</h3>
            </motion.div>
          </div>
        </ScrollReveal>
      </div>

      {/* Directory */}
      <section id="directory" className="px-4 mb-16">
        <ScrollReveal animation="fadeUp">
          <h2 className="text-2xl md:text-4xl font-black text-center mb-2" data-testid="teachers-city-heading">
            {copy ? copy.heading : 'Bachata Teachers'}
          </h2>
        </ScrollReveal>
        <div className="flex justify-center mb-4">
          <Button
            variant="outline"
            onClick={() => setSwitcherOpen(true)}
            disabled={!activeCities}
            className={cn(TAP, 'rounded-full px-3 text-sm')}
            data-testid="teachers-city-switcher"
          >
            <MapPin className="w-4 h-4 mr-1" />
            {view ? view.cityName : 'Loading cities'}
            <span className="ml-1 text-muted-foreground">&middot; Change city</span>
            <ChevronDown className="h-4 w-4 ml-1 opacity-60" />
          </Button>
        </div>

        <Sheet open={switcherOpen} onOpenChange={setSwitcherOpen}>
          <SheetContent side="bottom" className="p-3 max-h-[80vh] overflow-y-auto" data-testid="teachers-city-sheet">
            <SheetHeader className="text-left">
              <SheetTitle className="text-base">Choose a city</SheetTitle>
              <SheetDescription className="text-sm">
                Teacher directories we list. More cities are on the way.
              </SheetDescription>
            </SheetHeader>
            <ul className="mt-3 space-y-1">
              {(activeCities ?? []).map((c) => {
                const current = view?.mode === 'active' && view.listSlug === c.slug;
                return (
                  <li key={c.slug}>
                    <button
                      type="button"
                      onClick={() => {
                        setSwitcherOpen(false);
                        if (!current) navigate(teachersPath(c.slug));
                      }}
                      aria-current={current ? 'page' : undefined}
                      className={cn(
                        TAP,
                        'w-full flex items-center gap-2 rounded-lg px-3 py-2 text-left text-sm',
                        current ? 'bg-primary/15 text-foreground font-semibold' : 'hover:bg-muted text-foreground',
                      )}
                    >
                      <Check className={cn('h-4 w-4 shrink-0', current ? 'opacity-100 text-primary' : 'opacity-0')} />
                      {c.name}
                    </button>
                  </li>
                );
              })}
            </ul>
          </SheetContent>
        </Sheet>

        {copy?.note && (
          <div className="max-w-md mx-auto mb-4 rounded-lg border border-primary/30 bg-surface/60 p-3 text-sm" data-testid="teachers-city-note">
            <p className="text-foreground">
              {copy.note}{' '}
              {!tellUsOpen && (
                <button
                  type="button"
                  onClick={() => setTellUsOpen(true)}
                  className={cn(TAP, 'inline-flex items-center font-semibold text-primary underline px-1')}
                >
                  {TELL_US_LABEL}
                </button>
              )}
            </p>
            {copy.fallbackLine && <p className="mt-1 text-muted-foreground">{copy.fallbackLine}</p>}
            {tellUsOpen && (
              <div className="mt-3">
                <ListingRequestForm
                  section="teachers_directory"
                  variant="teacher"
                  cityName={view && view.mode !== 'unknown' ? view.requestedName : null}
                />
              </div>
            )}
          </div>
        )}

        {/* Filter Tabs */}
        <div className="max-w-7xl mx-auto mb-6 px-2">
          <motion.div
            className="grid grid-cols-3 md:flex md:justify-center gap-2"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            {filterTabs.map((tab, index) => (
              <motion.div
                key={tab.value}
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: index * 0.05, type: 'spring', stiffness: 300 }}
              >
                <Button
                  variant={activeFilter === tab.value ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => {
                    setActiveFilter(tab.value);
                    if (tab.value !== 'name') setSearchName('');
                    if (tab.value !== 'style') setSelectedStyle(null);
                  }}
                  className={cn(
                    TAP, 'w-full rounded-full text-xs md:text-sm transition-all duration-300',
                    activeFilter === tab.value &&
                      'ring-2 ring-primary/50 ring-offset-1 ring-offset-background shadow-lg shadow-primary/20',
                  )}
                >
                  <motion.span
                    animate={{
                      scale: activeFilter === tab.value ? [1, 1.3, 1] : 1,
                      rotate: activeFilter === tab.value ? [0, -10, 10, 0] : 0,
                    }}
                    transition={{ duration: 0.4 }}
                    className="mr-1"
                  >
                    {tab.icon}
                  </motion.span>
                  {tab.label}
                </Button>
              </motion.div>
            ))}
          </motion.div>

          {/* Sub-filters */}
          <AnimatePresence mode="wait">
            {activeFilter === 'name' && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="mt-4"
              >
                <div className="relative max-w-md mx-auto">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    placeholder="Search by name..."
                    value={searchName}
                    onChange={(e) => setSearchName(e.target.value)}
                    className="pl-10 pr-10"
                    autoFocus
                  />
                  {searchName && (
                    <button
                      onClick={() => setSearchName('')}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </motion.div>
            )}

            {activeFilter === 'style' && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="mt-4 flex justify-center"
              >
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="w-full max-w-xs justify-between rounded-full">
                      {selectedStyle || 'Select a style...'}
                      <ChevronDown className="h-4 w-4 ml-2 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-72 p-0" align="center">
                    <Command>
                      <CommandInput placeholder="Search styles..." />
                      <CommandList>
                        <CommandEmpty>No style found.</CommandEmpty>
                        <CommandGroup>
                          {uniqueStyles.map((style) => (
                            <CommandItem
                              key={style}
                              onSelect={() => setSelectedStyle(selectedStyle === style ? null : style)}
                              className="cursor-pointer"
                            >
                              <Check className={cn('h-4 w-4 mr-2', selectedStyle === style ? 'opacity-100' : 'opacity-0')} />
                              {style}
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
              </motion.div>
            )}

          </AnimatePresence>

          {/* Results count & clear */}
          {activeFilter !== 'all' && (
            <div className="flex items-center justify-between mt-4">
              <span className="text-sm text-muted-foreground">
                {filteredTeachers.length} teacher{filteredTeachers.length !== 1 ? 's' : ''} found
              </span>
              <Button variant="ghost" size="sm" onClick={clearFilters}>
                Clear filters
              </Button>
            </div>
          )}
        </div>

        {/* Teacher Cards */}
        {loadError ? (
          <div className="text-center py-10" data-testid="teachers-load-error">
            <p className="text-muted-foreground text-sm mb-3">
              We couldn&rsquo;t load the teachers. Check your connection and try again.
            </p>
            <Button variant="outline" onClick={retry} className={cn(TAP, 'px-3')}>
              <RefreshCw className="w-4 h-4 mr-1" /> Try again
            </Button>
          </div>
        ) : isLoading ? (
          <div className="max-w-7xl mx-auto grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6 px-2">
            {[...Array(6)].map((_, i) => (
              <Card key={i} className="p-5 bg-surface/50 border-primary/20">
                <div className="flex items-start gap-4">
                  <Skeleton className="h-14 w-14 rounded-full shrink-0" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-5 w-32" />
                    <Skeleton className="h-4 w-24" />
                    <div className="flex gap-2">
                      <Skeleton className="h-5 w-16 rounded-full" />
                      <Skeleton className="h-5 w-20 rounded-full" />
                    </div>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        ) : teachers.length === 0 ? (
          // The empty-city note above already carries the "Tell us" action; this
          // offers the other way on: a city that has teachers.
          <div className="text-center py-8" data-testid="teachers-empty">
            <GraduationCap className="w-8 h-8 text-muted-foreground/40 mx-auto mb-2" />
            <Button variant="outline" onClick={() => setSwitcherOpen(true)} className={cn(TAP, 'px-3')}>
              <MapPin className="w-4 h-4 mr-1" /> See another city
            </Button>
          </div>
        ) : filteredTeachers.length === 0 ? (
          <div className="text-center py-10">
            <GraduationCap className="w-8 h-8 text-muted-foreground/40 mx-auto mb-2" />
            <p className="text-muted-foreground text-sm mb-3">No teachers match your filters.</p>
            <Button variant="outline" onClick={clearFilters} className={cn(TAP, 'px-3')}>
              Clear filters
            </Button>
          </div>
        ) : (
          <StaggerContainer className="max-w-7xl mx-auto grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6 px-2">
            {filteredTeachers.map((teacher) => {
              const name = getDisplayName(teacher);
              const expLabel = getExperienceLabel(teacher.years_teaching);
              return (
                <StaggerItem key={teacher.id}>
                  <motion.div whileHover={{ y: -6, scale: 1.02 }} whileTap={{ scale: 0.98 }} transition={{ duration: 0.25 }}>
                    <Card
                      data-testid="teacher-card"
                      className="p-5 h-full bg-gradient-to-br from-surface to-background border-primary/20 hover:border-primary/50 transition-all duration-300 cursor-pointer group"
                      onClick={() => {
                        emitProfileView({ personId: teacher.id, profileType: 'teacher', context: 'listing:teachers' });
                        navigate(`/teachers/${teacher.id}`);
                      }}
                    >
                      {/* Top row: avatar + name/meta */}
                      <div className="flex items-start gap-4 mb-3">
                        <div className="relative shrink-0">
                          <Avatar className="w-14 h-14 border-2 border-primary/20 group-hover:border-primary/60 transition-colors shrink-0">
                            <AvatarImage src={optimizedImageUrl(teacher.photo_url || '', 160) || undefined} alt={name} />
                            <AvatarFallback className="bg-primary/10 text-primary text-lg font-bold">
                              {(teacher.first_name ?? '?').charAt(0).toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <NationalityFlag code={teacher.nationality_code} size={56} />
                        </div>
                        <div className="min-w-0 flex-1">
                          <h3 className="font-bold text-base text-foreground group-hover:text-primary transition-colors truncate">
                            {name}
                          </h3>
                          {teacher.city?.name && (
                            <p className="text-sm text-muted-foreground flex items-center gap-1 mt-0.5">
                              <MapPin className="w-3 h-3 shrink-0" />
                              {teacher.city.name}
                            </p>
                          )}
                          {expLabel && (
                            <p className="text-xs text-muted-foreground mt-0.5">
                              {expLabel} teaching experience
                            </p>
                          )}
                        </div>
                      </div>

                      {/* Styles badges */}
                      {teacher.teaching_styles && teacher.teaching_styles.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 mb-3">
                          {teacher.teaching_styles.slice(0, 3).map((style) => (
                            <Badge key={style} variant="secondary" className="text-[10px] px-2 py-0.5 bg-primary/10 text-primary border-primary/20">
                              {style}
                            </Badge>
                          ))}
                          {teacher.teaching_styles.length > 3 && (
                            <Badge variant="secondary" className="text-[10px] px-2 py-0.5 bg-muted text-muted-foreground">
                              +{teacher.teaching_styles.length - 3}
                            </Badge>
                          )}
                        </div>
                      )}

                      {/* Bottom row: lesson types + social icons */}
                      <div className="flex items-center justify-between pt-2 border-t border-border/40">
                        <div className="flex gap-2">
                          {teacher.offers_group && (
                            <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground">
                              <Users className="w-3 h-3" /> Group
                            </span>
                          )}
                          {teacher.offers_private && (
                            <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground">
                              <User className="w-3 h-3" /> Private
                            </span>
                          )}
                        </div>
                        <div className="flex gap-2">
                          {teacher.instagram && (
                            <Instagram className="w-3.5 h-3.5 text-muted-foreground group-hover:text-festival-pink transition-colors" />
                          )}
                          {teacher.website && (
                            <Globe className="w-3.5 h-3.5 text-muted-foreground group-hover:text-festival-teal transition-colors" />
                          )}
                        </div>
                      </div>
                    </Card>
                  </motion.div>
                </StaggerItem>
              );
            })}
          </StaggerContainer>
        )}
      </section>

    </GlobalLayout>
  );
};

export default Teachers;
