import { useState, useEffect, useMemo } from 'react';
import { motion, useScroll, useSpring, AnimatePresence } from 'framer-motion';
import { Heart, Music, Star, Sparkles, Users, Search, Loader2, X, ChevronDown, Check, Camera } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import PageHero from '@/components/PageHero';
import { ScrollReveal, StaggerContainer, StaggerItem } from '@/components/ScrollReveal';
import { FloatingElements } from '@/components/FloatingElements';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import Footer from '@/components/Footer';
import PageBreadcrumb from '@/components/PageBreadcrumb';
import { cn, getPhotoUrl, getNationalityCode } from '@/lib/utils';
import { buildFullName } from '@/lib/name-utils';
import { useCity } from '@/contexts/CityContext';

type Dancer = {
  id: string;
  first_name: string;
  surname: string | null;
  favorite_styles: string[] | null;
  years_dancing: string | null;
  photo_url: string | null;
  looking_for_partner: boolean | null;
  city: string | null;
  nationality: string | null;
  partner_role: string | null;
  hide_surname: boolean | null;
};

type FilterType = 'all' | 'name' | 'role' | 'style' | 'nationality' | 'city';

const Dancers = () => {
  const { scrollYProgress } = useScroll();
  const scaleX = useSpring(scrollYProgress, { stiffness: 100, damping: 30 });
  const navigate = useNavigate();
  const { citySlug } = useCity();
  const { toast } = useToast();
    const practicePartnersPath = citySlug ? `/${citySlug}/practice-partners` : '/practice-partners';
  const [dancers, setDancers] = useState<Dancer[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  // Filter state
  const [activeFilter, setActiveFilter] = useState<FilterType>('all');
  const [searchName, setSearchName] = useState('');
  const [selectedStyle, setSelectedStyle] = useState<string | null>(null);
  const [selectedNationality, setSelectedNationality] = useState<string | null>(null);
  const [selectedCity, setSelectedCity] = useState<string | null>(null);
  const [selectedRole, setSelectedRole] = useState<string | null>(null);

  useEffect(() => {
    const fetchDancers = async () => {
      try {
        const { data, error } = await supabase
          .from('dancers')
          .select('id, first_name, surname, favorite_styles, years_dancing, photo_url, looking_for_partner, city, nationality, partner_role, hide_surname')
          .order('created_at', { ascending: false });

        if (error) throw error;
        setDancers(data || []);
      } catch (error: any) {
        toast({
          title: 'Error loading dancers',
          description: error.message,
          variant: 'destructive',
        });
      } finally {
        setIsLoading(false);
      }
    };

    fetchDancers();
  }, [toast]);

  // Extract unique styles and nationalities for filters
  const uniqueStyles = useMemo(() => 
    [...new Set(dancers.flatMap(d => d.favorite_styles || []))].sort(),
    [dancers]
  );
  
  const uniqueNationalities = useMemo(() => 
    [...new Set(dancers.map(d => d.nationality).filter(Boolean) as string[])].sort(),
    [dancers]
  );

  const uniqueCities = useMemo(() => 
    [...new Set(dancers.map(d => d.city).filter(Boolean) as string[])].sort(),
    [dancers]
  );

  // Filter dancers based on active filter
  const filteredDancers = useMemo(() => {
    return dancers.filter(dancer => {
      if (activeFilter === 'name' && searchName) {
        const fullName = buildFullName(dancer.first_name, dancer.surname);
        return fullName.toLowerCase().includes(searchName.toLowerCase());
      }
      if (activeFilter === 'role' && selectedRole) {
        return dancer.partner_role === selectedRole;
      }
      if (activeFilter === 'style' && selectedStyle) {
        return dancer.favorite_styles?.includes(selectedStyle);
      }
      if (activeFilter === 'nationality' && selectedNationality) {
        return dancer.nationality === selectedNationality;
      }
      if (activeFilter === 'city' && selectedCity) {
        return dancer.city === selectedCity;
      }
      return true;
    });
  }, [dancers, activeFilter, searchName, selectedRole, selectedStyle, selectedNationality, selectedCity]);

  const clearFilters = () => {
    setActiveFilter('all');
    setSearchName('');
    setSelectedRole(null);
    setSelectedStyle(null);
    setSelectedNationality(null);
    setSelectedCity(null);
  };

  const getAvatarEmoji = (name: string) => {
    const hash = name.charCodeAt(0) % 2;
    return hash === 0 ? '??' : '??';
  };

  const getDisplayName = (dancer: Dancer) => {
    if (dancer.hide_surname && dancer.surname) {
      return `${dancer.first_name} ${dancer.surname.charAt(0)}.`;
    }
    return buildFullName(dancer.first_name, dancer.surname);
  };

  const filterTabs: { value: FilterType; label: string; icon: string }[] = [
    { value: 'all', label: 'All', icon: '?' },
    { value: 'name', label: 'Name', icon: '??' },
    { value: 'role', label: 'Role', icon: '??' },
    { value: 'style', label: 'Style', icon: '??' },
    { value: 'nationality', label: 'Country', icon: '??' },
    { value: 'city', label: 'City', icon: '???' },
  ];

  return (
    <div className="min-h-screen text-foreground overflow-x-hidden pb-20">
      {/* Progress Bar */}
      <motion.div 
        className="fixed top-0 left-0 right-0 h-1 bg-gradient-to-r from-primary via-festival-pink to-festival-purple z-40 origin-left"
        style={{ scaleX }}
      />

      <FloatingElements count={20} />

      {/* HERO - Dancers */}
      <PageHero
        emoji=''
        titleWhite='Meet'
        titleOrange='Dancers'
        subtitle=''
        largeTitle={true}
        breadcrumbItems={[{ label: 'Dancers' }]}
        floatingIcons={[Users, Star, Heart, Music, Sparkles, Search]}
        topPadding='pt-20'
      />

      {/* Hero Widgets */}
      <div className='relative z-10 px-4 -mt-6 mb-16'>
          {/* Hero Widgets - 2 small cards */}
          <ScrollReveal animation="scale" delay={0.6}>
            <div className="flex flex-wrap justify-center gap-3 md:gap-4 mt-8">
              {/* Find Practice Partners Widget */}
              <motion.div
                onClick={() => navigate(practicePartnersPath)}
                className="cursor-pointer p-4 md:p-5 bg-gradient-to-br from-surface/80 to-surface/40 backdrop-blur-sm rounded-2xl border border-primary/30 shadow-lg w-[140px] md:w-[160px]"
                whileHover={{ 
                  scale: 1.05, 
                  boxShadow: '0 20px 40px rgba(0,0,0,0.3)',
                }}
                whileTap={{ scale: 0.95 }}
              >
                <span className="text-3xl md:text-4xl block mb-2">??</span>
                <h3 className="font-bold text-xs md:text-sm text-foreground">Find Practice Partners</h3>
              </motion.div>
              
              {/* Create A Profile Widget */}
              <motion.div
                onClick={() => navigate('/create-dancers-profile')}
                className="cursor-pointer p-4 md:p-5 bg-gradient-to-br from-surface/80 to-surface/40 backdrop-blur-sm rounded-2xl border border-festival-pink/30 shadow-lg w-[140px] md:w-[160px]"
                whileHover={{ 
                  scale: 1.05, 
                  boxShadow: '0 20px 40px rgba(0,0,0,0.3)',
                }}
                whileTap={{ scale: 0.95 }}
              >
                <span className="text-3xl md:text-4xl block mb-2">?</span>
                <h3 className="font-bold text-xs md:text-sm text-foreground">Create a Profile</h3>
              </motion.div>

              {/* Book Media Widget */}
              <motion.div
                onClick={() => navigate('/photographers')}
                className="cursor-pointer p-4 md:p-5 bg-gradient-to-br from-blue-500/20 to-cyan-500/10 backdrop-blur-sm rounded-2xl border border-blue-500/30 shadow-lg w-[140px] md:w-[160px]"
                whileHover={{ 
                  scale: 1.05, 
                  boxShadow: '0 20px 40px rgba(0,0,0,0.3)',
                }}
                whileTap={{ scale: 0.95 }}
              >
                <span className="text-3xl md:text-4xl block mb-2">??</span>
                <h3 className="font-bold text-xs md:text-sm text-foreground">Book a Photoshoot</h3>
              </motion.div>
            </div>
          </ScrollReveal>

      </div>

      {/* Browse Dancers Directory */}
      <section id="directory" className="px-4 mb-16">
        <ScrollReveal animation="fadeUp">
          <h2 className="text-3xl md:text-4xl font-black text-center mb-6">
            <span className="text-foreground">Browse </span>
            <span className="text-primary">Dancers</span>
          </h2>
        </ScrollReveal>

        {/* Filter Tabs - 3x2 grid on mobile, single row on desktop */}
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
                    if (tab.value !== 'role') setSelectedRole(null);
                    if (tab.value !== 'style') setSelectedStyle(null);
                    if (tab.value !== 'nationality') setSelectedNationality(null);
                    if (tab.value !== 'name') setSearchName('');
                    if (tab.value !== 'city') setSelectedCity(null);
                  }}
                  className={cn(
                    "w-full rounded-full text-xs md:text-sm transition-all duration-300",
                    activeFilter === tab.value && "ring-2 ring-primary/50 ring-offset-1 ring-offset-background shadow-lg shadow-primary/20"
                  )}
                >
                  <motion.span
                    animate={{ 
                      scale: activeFilter === tab.value ? [1, 1.3, 1] : 1,
                      rotate: activeFilter === tab.value ? [0, -10, 10, 0] : 0
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

            {activeFilter === 'role' && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="mt-4 flex justify-center"
              >
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="w-full max-w-xs justify-between rounded-full">
                      {selectedRole || "Select a role..."}
                      <ChevronDown className="h-4 w-4 ml-2 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-72 p-0" align="center">
                    <Command>
                      <CommandInput placeholder="Search roles..." />
                      <CommandList>
                        <CommandEmpty>No role found.</CommandEmpty>
                        <CommandGroup>
                          {['Leader', 'Follower', 'Both'].map((role) => (
                            <CommandItem
                              key={role}
                              onSelect={() => setSelectedRole(selectedRole === role ? null : role)}
                              className="cursor-pointer"
                            >
                              <Check className={cn("h-4 w-4 mr-2", selectedRole === role ? "opacity-100" : "opacity-0")} />
                              {role}
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
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
                      {selectedStyle || "Select a dance style..."}
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
                              <Check className={cn("h-4 w-4 mr-2", selectedStyle === style ? "opacity-100" : "opacity-0")} />
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

            {activeFilter === 'nationality' && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="mt-4 flex justify-center"
              >
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="w-full max-w-xs justify-between rounded-full">
                      {selectedNationality ? (
                        <span className="flex items-center gap-2">
                          {getNationalityCode(selectedNationality) && (
                            <img 
                              src={`https://flagcdn.com/w20/${getNationalityCode(selectedNationality)}.png`} 
                              alt="" 
                              className="w-5 h-4 object-cover rounded-sm" 
                            />
                          )}
                          {selectedNationality}
                        </span>
                      ) : "Select a country..."}
                      <ChevronDown className="h-4 w-4 ml-2 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-72 p-0" align="center">
                    <Command>
                      <CommandInput placeholder="Search countries..." />
                      <CommandList>
                        <CommandEmpty>No country found.</CommandEmpty>
                        <CommandGroup>
                          {uniqueNationalities.map((nationality) => (
                            <CommandItem
                              key={nationality}
                              onSelect={() => setSelectedNationality(selectedNationality === nationality ? null : nationality)}
                              className="cursor-pointer flex items-center gap-2"
                            >
                              <Check className={cn("h-4 w-4", selectedNationality === nationality ? "opacity-100" : "opacity-0")} />
                              {getNationalityCode(nationality) && (
                                <img 
                                  src={`https://flagcdn.com/w20/${getNationalityCode(nationality)}.png`} 
                                  alt="" 
                                  className="w-5 h-4 object-cover rounded-sm" 
                                />
                              )}
                              {nationality}
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
                          <span>???</span>
                          {selectedCity}
                        </span>
                      ) : "Select a city..."}
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
                              <Check className={cn("h-4 w-4 mr-2", selectedCity === city ? "opacity-100" : "opacity-0")} />
                              <span>???</span>
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
                {filteredDancers.length} dancer{filteredDancers.length !== 1 ? 's' : ''} found
              </span>
              <Button variant="ghost" size="sm" onClick={clearFilters}>
                Clear filters
              </Button>
            </div>
          )}
        </div>

        {isLoading ? (
          <div className="flex justify-center items-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : filteredDancers.length === 0 ? (
          <div className="text-center py-20">
            <p className="text-muted-foreground text-lg mb-4">
              {dancers.length === 0 
                ? "No dancers yet. Be the first to join!" 
                : "No dancers match your filters."}
            </p>
            {dancers.length === 0 ? (
              <Button onClick={() => navigate('/create-dancers-profile')}>
                Create Your Profile
              </Button>
            ) : (
              <Button variant="outline" onClick={clearFilters}>
                Clear filters
              </Button>
            )}
          </div>
        ) : (
          <StaggerContainer className="max-w-7xl mx-auto grid grid-cols-4 gap-2 md:gap-4 px-2">
            {filteredDancers.map((dancer) => (
              <StaggerItem key={dancer.id}>
                <motion.div whileHover={{ y: -4, scale: 1.02 }} transition={{ duration: 0.3 }}>
                  <Card 
                    className="p-2 md:p-4 h-full bg-gradient-to-br from-surface to-background border-primary/20 hover:border-primary/50 transition-all duration-300 group cursor-pointer"
                    onClick={() => navigate(`/dancers/${dancer.id}`)}
                  >
                    {/* Avatar */}
                    <div className="flex justify-center mb-1 md:mb-2">
                      <motion.div
                        className="text-2xl md:text-4xl"
                        whileHover={{ scale: 1.2, rotate: 10 }}
                        transition={{ type: 'spring', stiffness: 300 }}
                      >
                        {getPhotoUrl(dancer.photo_url) ? (
                          <img src={getPhotoUrl(dancer.photo_url)!} alt={getDisplayName(dancer)} className="w-8 h-8 md:w-12 md:h-12 rounded-full object-cover" />
                        ) : (
                          getAvatarEmoji(dancer.first_name)
                        )}
                      </motion.div>
                    </div>

                    {/* Info */}
                    <h3 className="text-[10px] md:text-sm font-bold text-foreground text-center group-hover:text-primary transition-colors line-clamp-1">
                      {getDisplayName(dancer)}
                    </h3>
                    <div className="flex flex-col items-center gap-1 mt-1">
                      {dancer.partner_role && (
                        <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-secondary/30 text-secondary-foreground border border-secondary/20">
                          {dancer.partner_role}
                        </span>
                      )}
                      <div className="hidden md:flex flex-wrap items-center justify-center gap-1">
                        {dancer.favorite_styles?.slice(0, 1).map((style) => (
                          <span key={style} className="text-[8px] bg-primary/10 text-primary px-1.5 py-0.5 rounded-full">
                            {style}
                          </span>
                        ))}
                      </div>
                    </div>
                  </Card>
                </motion.div>
              </StaggerItem>
            ))}
          </StaggerContainer>
        )}
      </section>

      {/* Find A Dance Partner CTA */}
      <section id="find-partner" className="px-4 mb-16 max-w-4xl mx-auto">
        <ScrollReveal animation="fadeUp">
          <Card className="p-6 md:p-8 bg-gradient-to-br from-festival-pink/20 via-festival-purple/10 to-primary/20 border-festival-pink/30">
            <div className="flex flex-col md:flex-row items-center gap-4 md:gap-6">
              <motion.span 
                className="text-5xl md:text-6xl"
                animate={{ rotate: [0, -5, 5, 0] }}
                transition={{ duration: 2, repeat: Infinity }}
              >
                ??
              </motion.span>
              <div className="text-center md:text-left flex-1">
                <h2 className="text-2xl md:text-3xl font-bold mb-2">
                  <span className="text-foreground">Find A </span>
                  <span className="text-primary">Dance Partner</span>
                </h2>
                <p className="text-muted-foreground mb-4">Connect with dancers looking for practice partners</p>
                
                {/* Avatar stack */}
                <div className="flex items-center justify-center md:justify-start gap-2 mb-4">
                  <div className="flex -space-x-3">
                    {['??', '??', '??', '??'].map((emoji, i) => (
                      <motion.div 
                        key={i} 
                        className="w-10 h-10 rounded-full bg-surface border-2 border-background flex items-center justify-center text-lg"
                        initial={{ x: -20, opacity: 0 }}
                        animate={{ x: 0, opacity: 1 }}
                        transition={{ delay: i * 0.1 }}
                      >
                        {emoji}
                      </motion.div>
                    ))}
                  </div>
                  <span className="text-sm text-muted-foreground ml-2">200+ looking for partners</span>
                </div>
              </div>
              
              <Button 
                onClick={() => navigate(practicePartnersPath)}
                className="shrink-0"
                size="lg"
              >
                <Heart className="w-4 h-4 mr-2" />
                Find Partners
              </Button>
            </div>
          </Card>
        </ScrollReveal>
      </section>

      {/* Footer */}
      <Footer />
    </div>
  );
};

export default Dancers;



