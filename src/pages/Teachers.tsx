import { useState, useMemo } from 'react';
import { motion, useScroll, useSpring, AnimatePresence } from 'framer-motion';
import {
  GraduationCap, Star, Heart, Music, Sparkles, Search, X,
  ChevronDown, Check, MapPin, Users, User, Instagram, Globe,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import PageHero from '@/components/PageHero';
import { ScrollReveal, StaggerContainer, StaggerItem } from '@/components/ScrollReveal';
import { FloatingElements } from '@/components/FloatingElements';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { cn } from '@/lib/utils';
import { buildFullName } from '@/lib/name-utils';
import { useCity } from '@/contexts/CityContext';

type Teacher = {
  id: string;
  first_name: string | null;
  surname: string | null;
  photo_url: string | null;
  bio: string | null;
  teaching_styles: string[] | null;
  years_teaching: number | null;
  offers_group: boolean | null;
  offers_private: boolean | null;
  instagram: string | null;
  website: string | null;
  languages: string[] | null;
  nationality: string | null;
  hide_surname: boolean | null;
  city: { name: string } | null;
};

type FilterType = 'all' | 'name' | 'style' | 'city';

const Teachers = () => {
  const { scrollYProgress } = useScroll();
  const scaleX = useSpring(scrollYProgress, { stiffness: 100, damping: 30 });
  const navigate = useNavigate();
  const { citySlug } = useCity();
  const classesPath = citySlug ? `/${citySlug}/classes` : '/classes';

  const { data: teachers = [], isLoading } = useQuery({
    queryKey: ['teacher-profiles-directory'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('teacher_profiles')
        .select('id, first_name, surname, photo_url, bio, teaching_styles, years_teaching, offers_group, offers_private, instagram, website, languages, nationality, hide_surname, city:cities(name)')
        .not('is_active', 'is', false)
        .order('first_name');

      if (error) throw error;
      return (data ?? []) as unknown as Teacher[];
    },
  });

  // Filter state
  const [activeFilter, setActiveFilter] = useState<FilterType>('all');
  const [searchName, setSearchName] = useState('');
  const [selectedStyle, setSelectedStyle] = useState<string | null>(null);
  const [selectedCity, setSelectedCity] = useState<string | null>(null);

  const uniqueStyles = useMemo(
    () => [...new Set(teachers.flatMap((t) => t.teaching_styles || []))].sort(),
    [teachers],
  );

  const uniqueCities = useMemo(
    () => [...new Set(teachers.map((t) => t.city?.name).filter(Boolean) as string[])].sort(),
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
      if (activeFilter === 'city' && selectedCity) {
        return t.city?.name === selectedCity;
      }
      return true;
    });
  }, [teachers, activeFilter, searchName, selectedStyle, selectedCity]);

  const clearFilters = () => {
    setActiveFilter('all');
    setSearchName('');
    setSelectedStyle(null);
    setSelectedCity(null);
  };

  const getDisplayName = (t: Teacher) =>
    buildFullName(t.first_name ?? '', t.hide_surname ? null : t.surname);

  const getExperienceLabel = (years: number | null) => {
    if (!years) return null;
    if (years >= 10) return '10+ yrs';
    return `${years} yr${years > 1 ? 's' : ''}`;
  };

  const filterTabs: { value: FilterType; label: string; icon: string }[] = [
    { value: 'all', label: 'All', icon: '\u2728' },
    { value: 'name', label: 'Name', icon: '\uD83D\uDD0D' },
    { value: 'style', label: 'Style', icon: '\uD83D\uDC83' },
    { value: 'city', label: 'City', icon: '\uD83C\uDFD9\uFE0F' },
  ];

  return (
    <div className="min-h-screen text-foreground overflow-x-hidden pb-20">
      {/* Progress Bar */}
      <motion.div
        className="fixed top-0 left-0 right-0 h-1 bg-gradient-to-r from-primary via-festival-pink to-festival-purple z-40 origin-left"
        style={{ scaleX }}
      />

      <FloatingElements count={15} />

      {/* Hero */}
      <PageHero
        emoji={'\uD83C\uDF93'}
        titleWhite="Find"
        titleOrange="Teachers"
        subtitle=""
        largeTitle
        breadcrumbItems={[{ label: 'Classes', path: classesPath }, { label: 'Teachers' }]}
        floatingIcons={[GraduationCap, Star, Heart, Music, Sparkles]}
        topPadding="pt-20"
      />

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
              <span className="text-3xl md:text-4xl block mb-2">{'\uD83D\uDD0D'}</span>
              <h3 className="font-bold text-xs md:text-sm text-foreground">Browse Teachers</h3>
            </motion.div>
            <motion.div
              onClick={() => navigate('/create-teacher-profile')}
              className="cursor-pointer p-4 md:p-5 bg-gradient-to-br from-surface/80 to-surface/40 backdrop-blur-sm rounded-2xl border border-festival-pink/30 shadow-lg w-[140px] md:w-[160px]"
              whileHover={{ scale: 1.05, boxShadow: '0 20px 40px rgba(0,0,0,0.3)' }}
              whileTap={{ scale: 0.95 }}
            >
              <span className="text-3xl md:text-4xl block mb-2">{'\u270D\uFE0F'}</span>
              <h3 className="font-bold text-xs md:text-sm text-foreground">Get Listed</h3>
            </motion.div>
            <motion.div
              onClick={() => navigate(classesPath)}
              className="cursor-pointer p-4 md:p-5 bg-gradient-to-br from-blue-500/20 to-cyan-500/10 backdrop-blur-sm rounded-2xl border border-blue-500/30 shadow-lg w-[140px] md:w-[160px]"
              whileHover={{ scale: 1.05, boxShadow: '0 20px 40px rgba(0,0,0,0.3)' }}
              whileTap={{ scale: 0.95 }}
            >
              <span className="text-3xl md:text-4xl block mb-2">{'\uD83D\uDCDA'}</span>
              <h3 className="font-bold text-xs md:text-sm text-foreground">Find Classes</h3>
            </motion.div>
          </div>
        </ScrollReveal>
      </div>

      {/* Directory */}
      <section id="directory" className="px-4 mb-16">
        <ScrollReveal animation="fadeUp">
          <h2 className="text-3xl md:text-4xl font-black text-center mb-6">
            <span className="text-foreground">Browse </span>
            <span className="text-primary">Teachers</span>
          </h2>
        </ScrollReveal>

        {/* Filter Tabs */}
        <div className="max-w-7xl mx-auto mb-6 px-2">
          <motion.div
            className="grid grid-cols-4 md:flex md:justify-center gap-2"
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
                    if (tab.value !== 'city') setSelectedCity(null);
                  }}
                  className={cn(
                    'w-full rounded-full text-xs md:text-sm transition-all duration-300',
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

            {activeFilter === 'city' && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="mt-4 flex justify-center"
              >
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="w-full max-w-xs justify-between rounded-full">
                      {selectedCity ? (
                        <span className="flex items-center gap-2">
                          <MapPin className="w-4 h-4" />
                          {selectedCity}
                        </span>
                      ) : (
                        'Select a city...'
                      )}
                      <ChevronDown className="h-4 w-4 ml-2 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-72 p-0" align="center">
                    <Command>
                      <CommandInput placeholder="Search cities..." />
                      <CommandList>
                        <CommandEmpty>No city found.</CommandEmpty>
                        <CommandGroup>
                          {uniqueCities.map((city) => (
                            <CommandItem
                              key={city}
                              onSelect={() => setSelectedCity(selectedCity === city ? null : city)}
                              className="cursor-pointer"
                            >
                              <Check className={cn('h-4 w-4 mr-2', selectedCity === city ? 'opacity-100' : 'opacity-0')} />
                              <MapPin className="w-4 h-4 mr-1 text-muted-foreground" />
                              {city}
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
        {isLoading ? (
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
        ) : filteredTeachers.length === 0 ? (
          <div className="text-center py-20">
            <GraduationCap className="w-12 h-12 text-muted-foreground/40 mx-auto mb-4" />
            <p className="text-muted-foreground text-lg mb-4">
              {teachers.length === 0 ? 'No teachers listed yet. Be the first!' : 'No teachers match your filters.'}
            </p>
            {teachers.length === 0 ? (
              <Button onClick={() => navigate('/create-teacher-profile')}>Create Your Profile</Button>
            ) : (
              <Button variant="outline" onClick={clearFilters}>
                Clear filters
              </Button>
            )}
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
                      className="p-5 h-full bg-gradient-to-br from-surface to-background border-primary/20 hover:border-primary/50 transition-all duration-300 cursor-pointer group"
                      onClick={() => navigate(`/teachers/${teacher.id}`)}
                    >
                      {/* Top row: avatar + name/meta */}
                      <div className="flex items-start gap-4 mb-3">
                        <Avatar className="w-14 h-14 border-2 border-primary/20 group-hover:border-primary/60 transition-colors shrink-0">
                          <AvatarImage src={teacher.photo_url || undefined} alt={name} />
                          <AvatarFallback className="bg-primary/10 text-primary text-lg font-bold">
                            {(teacher.first_name ?? '?').charAt(0).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
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

                      {/* Bio */}
                      {teacher.bio && (
                        <p className="text-sm text-muted-foreground line-clamp-2 mb-3">{teacher.bio}</p>
                      )}

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

      {/* CTA Banner */}
      <section className="px-4 mb-16 max-w-3xl mx-auto">
        <ScrollReveal animation="fadeUp">
          <Card className="relative overflow-hidden bg-gradient-to-br from-primary/20 via-festival-purple/10 to-festival-pink/20 border-primary/30">
            <div className="p-8 md:p-12 text-center">
              <motion.div
                animate={{ rotate: [0, -5, 5, 0] }}
                transition={{ duration: 3, repeat: Infinity }}
                className="text-5xl mb-4 inline-block"
              >
                {'\uD83C\uDF93'}
              </motion.div>
              <h2 className="text-2xl md:text-3xl font-bold mb-3">
                <span className="text-foreground">Are you a </span>
                <span className="text-primary">Teacher?</span>
              </h2>
              <p className="text-muted-foreground mb-6 max-w-md mx-auto">
                Create your profile, list your classes, and connect with students in your city.
              </p>
              <Button size="lg" onClick={() => navigate('/create-teacher-profile')} className="shadow-lg shadow-primary/20">
                <GraduationCap className="w-5 h-5 mr-2" />
                Create Your Profile
              </Button>
            </div>
          </Card>
        </ScrollReveal>
      </section>
    </div>
  );
};

export default Teachers;
