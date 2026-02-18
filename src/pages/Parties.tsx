import { motion, useScroll, useSpring } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { MapPin, Users, GraduationCap, Ticket, Tent, CalendarPlus, ChevronRight, Calendar, ArrowDown, ArrowRight, PartyPopper } from 'lucide-react';
import PageHero from '@/components/PageHero';
import { ScrollReveal } from '@/components/ScrollReveal';
import { FloatingElements } from '@/components/FloatingElements';
import { EventCalendar } from '@/components/EventCalendar';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Footer from '@/components/Footer';
import PageBreadcrumb from '@/components/PageBreadcrumb';

const Parties = () => {
  const navigate = useNavigate();
  const { scrollYProgress } = useScroll();
  const scaleX = useSpring(scrollYProgress, { stiffness: 100, damping: 30 });

  const scrollToSection = (sectionId: string) => {
    document.getElementById(sectionId)?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <div className="min-h-screen text-foreground overflow-x-hidden pb-20">
      {/* Progress Bar */}
      <motion.div 
        className="fixed top-0 left-0 right-0 h-1 bg-gradient-to-r from-primary via-festival-pink to-festival-purple z-40 origin-left"
        style={{ scaleX }}
      />
      {/* Global Background from Classes */}
      <motion.div 
        className="fixed inset-0 bg-gradient-to-br from-primary/20 via-festival-purple/10 to-festival-pink/20 -z-10 pointer-events-none"
        animate={{ 
          backgroundPosition: ['0% 0%', '100% 100%'],
        }}
        transition={{ duration: 10, repeat: Infinity, repeatType: 'reverse' }}
        style={{ backgroundSize: '200% 200%' }}
      />

      <div className="fixed inset-0 z-0 pointer-events-none overflow-hidden">
         <FloatingElements count={20} />
      </div>

      {/* HERO - Parties */}
      <PageHero
        emoji=''
        titleWhite='Find Your'
        titleOrange='Next Party'
        subtitle=''
        largeTitle={true}
        hideBackground={true}
        breadcrumbItems={[{ label: 'Parties' }]}
        floatingIcons={[MapPin, Users, Ticket, Tent, Calendar, PartyPopper]}
        topPadding='pt-20'
      />

      {/* What's On Section */}
      <section id="calendar" className="px-4 mb-8">
        <ScrollReveal animation="fadeUp">
          <h2 className="text-3xl md:text-4xl font-black text-center mb-8">
            <span className="text-foreground">What's </span>
            <span className="text-primary">On</span>
          </h2>
        </ScrollReveal>
        
        <EventCalendar defaultCategory="parties" />
      </section>

      {/* Main Action Bento Grid */}
      <section className="relative z-10 px-4 mb-14">
        <ScrollReveal animation="fadeUp" delay={0.2}>
          <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-12 gap-4 text-left">
            <motion.button
              type="button"
              onClick={() => scrollToSection('calendar')}
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.98 }}
              className="md:col-span-6 lg:col-span-7 h-28 md:h-32 rounded-2xl border border-primary/20 bg-gradient-to-br from-primary/20 via-festival-purple/10 to-festival-pink/10 p-5 flex items-center justify-between overflow-hidden relative"
            >
              <div>
                <div className="flex items-center gap-3 text-primary">
                  <Calendar className="w-6 h-6" />
                  <p className="text-sm font-semibold uppercase tracking-[0.2em]">Browse Schedule</p>
                </div>
                <p className="mt-1 text-sm text-muted-foreground">View below</p>
              </div>
              <Calendar className="w-10 h-10 text-primary/30" />
            </motion.button>

            <motion.button
              type="button"
              onClick={() => scrollToSection('venues')}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className="md:col-span-3 lg:col-span-2 h-28 md:h-32 rounded-2xl border border-primary/15 bg-surface/60 p-4 flex flex-col justify-center items-center gap-2"
            >
              <MapPin className="w-7 h-7 text-primary" />
              <h3 className="text-sm font-bold text-center">Top Venues</h3>
            </motion.button>

            <motion.button
              type="button"
              onClick={() => scrollToSection('organisers')}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className="md:col-span-3 lg:col-span-3 h-28 md:h-32 rounded-2xl border border-primary/15 bg-surface/60 p-4 flex flex-col justify-center items-center gap-2"
            >
              <Users className="w-7 h-7 text-festival-purple" />
              <h3 className="text-sm font-bold text-center">Event Hosts</h3>
            </motion.button>

            <motion.button
              type="button"
              onClick={() => navigate('/festivals')}
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.98 }}
              className="md:col-span-6 lg:col-span-6 h-28 md:h-32 rounded-2xl border border-primary/15 bg-surface/60 p-5 flex items-center justify-between"
            >
              <div>
                <div className="flex items-center gap-3 text-festival-purple">
                  <Tent className="w-6 h-6" />
                  <p className="text-sm font-semibold">Bachata Festivals</p>
                </div>
                <p className="mt-1 text-sm text-muted-foreground">International events</p>
              </div>
              <Tent className="w-10 h-10 text-festival-purple/30" />
            </motion.button>

            <motion.button
              type="button"
              onClick={() => navigate('/discounts')}
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.98 }}
              className="md:col-span-6 lg:col-span-6 h-28 md:h-32 rounded-2xl border border-dashed border-primary/40 bg-primary/5 p-5 flex items-center justify-between"
            >
              <div>
                <div className="flex items-center gap-3 text-primary">
                  <Ticket className="w-6 h-6" />
                  <p className="text-sm font-semibold">Promo Codes</p>
                </div>
                <p className="mt-1 text-sm text-muted-foreground">Save on entry fees</p>
              </div>
              <ArrowRight className="w-6 h-6 text-primary" />
            </motion.button>
          </div>
        </ScrollReveal>
      </section>

      {/* Plan Your Night Section */}
      <section className="px-4 mb-16 max-w-4xl mx-auto">
        <ScrollReveal animation="fadeUp">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card 
              className="p-6 cursor-pointer hover:border-primary/50 transition-all bg-card/50 backdrop-blur-sm group"
              onClick={() => navigate('/classes')}
            >
              <div className="flex items-start gap-4">
                <div className="p-3 rounded-full bg-primary/10 text-primary group-hover:bg-primary/20 transition-colors">
                  <GraduationCap className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-lg font-bold mb-1 group-hover:text-primary transition-colors">Warm Up First</h3>
                  <p className="text-sm text-muted-foreground mb-3">
                    New to dancing? Join a pre-party class to learn the basics.
                  </p>
                  <div className="flex items-center text-xs font-medium text-primary">
                    Find Classes <ChevronRight className="w-3 h-3 ml-1 group-hover:translate-x-1 transition-transform" />
                  </div>
                </div>
              </div>
            </Card>

            <Card 
              className="p-6 cursor-pointer hover:border-festival-pink/50 transition-all bg-card/50 backdrop-blur-sm group"
              onClick={() => navigate('/discounts')}
            >
              <div className="flex items-start gap-4">
                <div className="p-3 rounded-full bg-festival-pink/10 text-festival-pink group-hover:bg-festival-pink/20 transition-colors">
                  <Ticket className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-lg font-bold mb-1 group-hover:text-festival-pink transition-colors">Party for Less</h3>
                  <p className="text-sm text-muted-foreground mb-3">
                    Save on entry fees with our exclusive promo codes.
                  </p>
                  <div className="flex items-center text-xs font-medium text-festival-pink">
                    Get Discounts <ChevronRight className="w-3 h-3 ml-1 group-hover:translate-x-1 transition-transform" />
                  </div>
                </div>
              </div>
            </Card>
          </div>
        </ScrollReveal>
      </section>

      {/* Festival Upsell */}
      <section className="px-4 mb-16 max-w-4xl mx-auto">
        <ScrollReveal animation="fadeUp">
          <Card 
            className="p-6 md:p-8 bg-gradient-to-br from-festival-purple/20 via-background to-festival-pink/10 border-festival-purple/30 cursor-pointer group"
            onClick={() => navigate('/festivals')}
          >
            <div className="flex flex-col md:flex-row items-center gap-6 text-center md:text-left">
              <div className="p-4 rounded-full bg-festival-purple/10 text-festival-purple group-hover:scale-110 transition-transform">
                <Tent className="w-10 h-10" />
              </div>
              <div className="flex-1">
                <h2 className="text-2xl font-bold mb-2">Ready for the Big Stage?</h2>
                <p className="text-muted-foreground">
                  Explore international bachata festivals and weekenders.
                </p>
              </div>
              <Button variant="outline" className="group-hover:bg-festival-purple/10 border-festival-purple/50">
                View Festivals
              </Button>
            </div>
          </Card>
        </ScrollReveal>
      </section>

      {/* Venues Showcase */}
      <section id="venues" className="px-4 mb-16 max-w-4xl mx-auto">
        <ScrollReveal animation="fadeUp">
          <Card className="p-6 md:p-8 bg-gradient-to-br from-primary/20 via-festival-purple/10 to-festival-pink/20 border-primary/30">
            <div className="flex flex-col md:flex-row items-start md:items-center gap-4 mb-6">
              <MapPin className="w-12 h-12 text-primary" />
              <div className="flex-1">
                <h2 className="text-2xl md:text-3xl font-bold">
                  <span className="text-foreground">Explore </span>
                  <span className="text-primary">Venues</span>
                </h2>
                <p className="text-muted-foreground">
                  Discover the best dance venues across London for bachata socials and events.
                </p>
              </div>
            </div>
            
            <Button onClick={() => navigate('/venues')} size="lg">
              <MapPin className="w-4 h-4 mr-2" />
              Browse All Venues
            </Button>
          </Card>
        </ScrollReveal>
      </section>

      {/* Organisers Showcase */}
      <section id="organisers" className="px-4 mb-16 max-w-4xl mx-auto">
        <ScrollReveal animation="fadeUp">
          <Card className="p-6 md:p-8 bg-gradient-to-br from-festival-pink/20 via-purple-500/10 to-primary/20 border-primary/30">
            <div className="flex flex-col md:flex-row items-start md:items-center gap-4 mb-6">
              <Users className="w-12 h-12 text-festival-pink" />
              <div className="flex-1">
                <h2 className="text-2xl md:text-3xl font-bold">
                  <span className="text-foreground">Meet the </span>
                  <span className="text-primary">Organisers</span>
                </h2>
                <p className="text-muted-foreground">
                  The amazing people who bring London's best bachata events to life.
                </p>
              </div>
            </div>
            
            <div className="flex flex-col sm:flex-row gap-4 mt-6">
              <Button onClick={() => navigate('/organisers')} size="lg" className="flex-1">
                <Users className="w-4 h-4 mr-2" />
                Browse Organisers
              </Button>
              <Button 
                onClick={() => navigate('/create-event')} 
                variant="outline" 
                size="lg"
                className="flex-1 hover:bg-primary/10 hover:text-primary hover:border-primary/50"
              >
                <CalendarPlus className="w-4 h-4 mr-2" />
                List Your Event
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

export default Parties;










