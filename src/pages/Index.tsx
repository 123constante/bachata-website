import React, { Suspense, lazy } from 'react';
import { motion } from 'framer-motion';
import { 
  Flame, MapPin, 
  Users, Ticket, 
  ChevronRight, ArrowRight,
  Loader2,
  Star,
  Sparkles
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import PageHero from '@/components/PageHero';
import { HorizontalEventSlider } from '@/components/HorizontalEventSlider';
import { PartnersMarquee } from '@/components/PartnersMarquee';
import Footer from '@/components/Footer';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { useCity } from '@/contexts/CityContext';

// Lazy load the heavy calendar component
const EventCalendar = lazy(() => import('@/components/EventCalendar').then(module => ({ default: module.EventCalendar })));

const Index = () => {
  const navigate = useNavigate();
  useCity();
  const heroCityName = 'London';
  const calendarCityName = 'London';

  const categories = [
    { 
      label: 'Parties', 
      icon: Flame, 
      color: 'text-orange-500', 
      bg: 'bg-orange-500/10',
      desc: 'Socials & Club Nights',
      path: '/parties' 
    },
    { 
      label: 'Classes', 
      icon: Users, 
      color: 'text-blue-500', 
      bg: 'bg-blue-500/10',
      desc: 'Workshops & Courses',
      path: '/classes' 
    },
    { 
      label: 'Festivals', 
      icon: Ticket, 
      color: 'text-purple-500', 
      bg: 'bg-purple-500/10',
      desc: 'International Events',
      path: '/festivals' 
    },
    { 
      label: 'Venues', 
      icon: MapPin, 
      color: 'text-pink-500', 
      bg: 'bg-pink-500/10',
      desc: 'Dance Locations',
      path: '/venues' 
    }
  ];

  return (
    <div className="min-h-screen text-foreground overflow-x-hidden">
      
      {/* 1. HERO SECTION - High performance, no heavy JS animations */}
      <PageHero
        emoji=''
        titleWhite='Bachata'
        titleOrange={heroCityName}
        subtitle={`The most comprehensive calendar for Bachata classes, socials, and festivals in ${calendarCityName}.`}
        largeTitle={true}
        floatingIcons={[Flame, MapPin, Users, Ticket, Star, Sparkles]}
        topPadding='pt-20'
      />
      
      {/* 2. CATEGORY NAVIGATION - Core routing */}
      <section className="py-12 bg-card/50 border-b border-white/5">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {categories.map((item) => (
              <motion.div
                key={item.label}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => navigate(item.path)}
                className="cursor-pointer group relative overflow-hidden rounded-2xl bg-card border border-white/5 p-6 hover:border-primary/50 transition-colors shadow-sm"
              >
                <div className={`w-12 h-12 rounded-xl ${item.bg} flex items-center justify-center mb-4 transition-colors group-hover:bg-primary/20`}>
                  <item.icon className={`w-6 h-6 ${item.color} group-hover:text-primary transition-colors`} />
                </div>
                <h3 className="font-bold text-lg mb-1">{item.label}</h3>
                <p className="text-sm text-muted-foreground">{item.desc}</p>
                
                <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity">
                  <ChevronRight className="w-5 h-5 text-muted-foreground" />
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* 3. UPCOMING EVENTS SLIDER - Discovery */}
      <section className="py-16">
        <div className="container mx-auto px-4 mb-8">
          <div className="flex items-end justify-between">
             <div>
              <h2 className="text-3xl font-black mb-2">Upcoming Events</h2>
              <p className="text-muted-foreground">Don't miss the next big thing</p>
             </div>
             <button onClick={() => navigate('/events')} className="hidden md:flex items-center gap-2 text-primary hover:text-primary/80 transition-colors font-semibold">
               View All <ArrowRight className="w-4 h-4" />
             </button>
          </div>
        </div>
        <ErrorBoundary>
          <HorizontalEventSlider />
        </ErrorBoundary>
      </section>

      {/* 4. EVENT CALENDAR - The Core Utility (Lazy Loaded) */}
      <section className="py-16 bg-surface/30 border-y border-white/5 min-h-[600px]">
        <div className="container mx-auto px-4">
          <div className="mb-10 text-center max-w-2xl mx-auto">
            <h2 className="text-3xl md:text-4xl font-black mb-4">Event Calendar</h2>
            <p className="text-muted-foreground">
              Browse all confirmed bachata events in {calendarCityName}. Filter by style, level, or location to find exactly what you're looking for.
            </p>
          </div>
          
          <Suspense fallback={
            <div className="flex flex-col items-center justify-center h-[400px] w-full text-muted-foreground">
              <Loader2 className="w-8 h-8 animate-spin mb-4 text-primary" />
              <p>Loading calendar...</p>
            </div>
          }>
            <ErrorBoundary>
              <EventCalendar />
            </ErrorBoundary>
          </Suspense>
        </div>
      </section>

      {/* 5. PARTNERS MARQUEE - Social Proof */}
      <section className="py-20 overflow-hidden">
        <div className="container mx-auto px-4 mb-10 text-center">
           <h2 className="text-2xl font-bold opacity-50 uppercase tracking-widest">Trusted Partners</h2>
        </div>
        <ErrorBoundary>
          <PartnersMarquee />
        </ErrorBoundary>
      </section>

      {/* 6. SEMANTIC SEO FOOTER - Text Content for Crawlers & Context */}
      <section className="py-16 bg-card border-t border-white/5">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            <div>
              <h4 className="font-bold text-lg mb-4 text-primary">Dance Styles</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><a href="#" className="hover:text-white transition-colors">Bachata Sensual in London</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Dominican Bachata Classes</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Salsa & Bachata Mix</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Kizomba Parties</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Urban Bachata Fusion</a></li>
              </ul>
            </div>
            <div>
              <h4 className="font-bold text-lg mb-4 text-primary">Popular Locations</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><a href="#" className="hover:text-white transition-colors">Latin Parties in Central London</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Dance Classes in Shoreditch</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Bachata Events in Camden</a></li>
                <li><a href="#" className="hover:text-white transition-colors">South London Salsa Clubs</a></li>
                <li><a href="#" className="hover:text-white transition-colors">West End Latin Nights</a></li>
              </ul>
            </div>
             <div>
              <h4 className="font-bold text-lg mb-4 text-primary">For Organisers</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><a href="#" className="hover:text-white transition-colors">List Your Event</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Promote Your School</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Partner With Us</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Organiser Dashboard</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Success Stories</a></li>
              </ul>
            </div>
             <div>
              <h4 className="font-bold text-lg mb-4 text-primary">Community</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><a href="#" className="hover:text-white transition-colors">Dancer Profiles</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Find a Dance Partner</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Community Guidelines</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Safety & Inclusivity</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Contact Support</a></li>
              </ul>
            </div>
          </div>
          <div className="mt-12 pt-8 border-t border-white/5 text-center text-sm text-muted-foreground">
            <p>
              Bachata Calendar London is the leading platform for discovering latin dance events. 
              From beginner workshops to international festivals, we connect the community through dance.
            </p>
          </div>
        </div>
      </section>

      {/* 7. FOOTER */}
      <Footer />
    </div>
  );
};

export default Index;


