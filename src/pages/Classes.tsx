import { motion, useScroll, useSpring } from 'framer-motion';
import { 
  Heart, Music, Star, Sparkles, GraduationCap, Zap, ArrowRight, Users, Calendar, ArrowDown, Handshake, Ticket, Tent, PartyPopper
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate, Link } from 'react-router-dom';
import PageHero from '@/components/PageHero';
import { ScrollReveal } from '@/components/ScrollReveal';
import { FloatingElements } from '@/components/FloatingElements';
import { EventCalendar } from '@/components/EventCalendar';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Footer from '@/components/Footer';
import PageBreadcrumb from '@/components/PageBreadcrumb';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { WhyWeExist } from '@/components/WhyWeExist';
import { ComingUpSection } from '@/components/ComingUpSection';
import { useCity } from '@/contexts/CityContext';

const Classes = () => {
  const { scrollYProgress } = useScroll();
  const scaleX = useSpring(scrollYProgress, { stiffness: 100, damping: 30 });
  const navigate = useNavigate();
  const { citySlug } = useCity();
  const practicePartnersPath = citySlug ? `/${citySlug}/practice-partners` : '/practice-partners';

  const { data: teacherCount } = useQuery({
    queryKey: ['teacher-count'],
    queryFn: async () => {
      const { count, error } = await supabase
        .from('entities')
        .select('*', { count: 'exact', head: true })
        .eq('type', 'teacher');
      
      if (error) throw error;
      return count;
    },
  });

  const scrollToSection = (sectionId: string) => {
    const element = document.getElementById(sectionId);
    if (element) {
      const offset = 80;
      
      
      const elementPosition = element.getBoundingClientRect().top + window.pageYOffset;
      const offsetPosition = elementPosition - offset;

      window.scrollTo({
        top: offsetPosition,
        behavior: 'smooth'
      });
    }
  };

  return (
    <div className="min-h-screen text-foreground overflow-x-hidden pb-20">
      {/* Progress Bar */}
      <motion.div 
        className="fixed top-0 left-0 right-0 h-1 bg-gradient-to-r from-primary via-festival-pink to-festival-purple z-40 origin-left"
        style={{ scaleX }}
      />
      {/* Global Background */}
      <motion.div 
        className="fixed inset-0 bg-gradient-to-br from-primary/20 via-festival-purple/10 to-festival-pink/20 -z-10 pointer-events-none"
        animate={{ 
          backgroundPosition: ['0% 0%', '100% 100%'],
        }}
        transition={{ duration: 10, repeat: Infinity, repeatType: 'reverse' }}
        style={{ backgroundSize: '200% 200%' }}
      />
      {/* Fixed Floating Elements Wrapper */}
      <div className="fixed inset-0 z-0 pointer-events-none overflow-hidden">
         <FloatingElements count={20} />
      </div>

      


      {/* HERO - Classes */}
      <PageHero
        emoji=''
        titleWhite='Learn'
        titleOrange='Bachata'
        subtitle=''
        largeTitle={true}
        hideBackground={true}
        breadcrumbItems={[{ label: 'Classes' }]}
        floatingIcons={[GraduationCap, Star, Heart, Music, Sparkles, Zap]}
        topPadding='pt-20'
      />


      {/* Main Action Grid (Bento Style) */}
      <section className="px-4 mb-12">
          <ScrollReveal animation="fadeUp" delay={0.4}>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4 max-w-4xl mx-auto">
              {/* 1. Schedule (Primary - Spans 2 cols on mobile) */}
              <motion.div 
                className="col-span-2 md:col-span-2 aspect-[2/1] md:aspect-auto md:h-40 cursor-pointer group relative overflow-hidden rounded-2xl border border-primary/20 bg-gradient-to-br from-primary/20 to-festival-pink/20 text-white"
                onClick={() => scrollToSection('calendar')}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                 <div className="absolute inset-0 bg-black/10 group-hover:bg-transparent transition-colors" />
                 {/* Optional: Add a subtle background image here if available */}
                 <div className="absolute bottom-0 left-0 p-4 md:p-6 text-left">
                    <Calendar className="w-8 h-8 mb-2" />
                    <h3 className="text-lg md:text-xl font-bold">Browse Schedule</h3>
                    <p className="text-xs md:text-sm opacity-80 flex items-center gap-1">
                      View below <ArrowDown className="w-3 h-3 animate-bounce" />
                    </p>
                 </div>
                 <div className="absolute top-4 right-4 opacity-20 transform rotate-12 group-hover:scale-110 transition-transform">
                    <Calendar size={60} />
                 </div>
              </motion.div>

              {/* 2. Teachers */}
              <motion.div 
                className="col-span-1 md:col-span-1 aspect-square md:aspect-auto md:h-40 cursor-pointer group relative overflow-hidden rounded-2xl border border-primary/10 bg-surface/50 hover:bg-surface/80"
                onClick={() => navigate('/teachers')}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                 <div className="flex flex-col h-full items-center justify-center p-3 text-center">
                    <GraduationCap className="w-8 h-8 mb-2 text-primary" />
                    <h3 className="text-sm font-bold leading-tight">Expert<br/>Teachers</h3>
                 </div>
              </motion.div>

              {/* 3. Student Teams */}
              <motion.div 
                className="col-span-1 md:col-span-1 aspect-square md:aspect-auto md:h-40 cursor-pointer group relative overflow-hidden rounded-2xl border border-primary/10 bg-surface/50 hover:bg-surface/80"
                onClick={() => scrollToSection('performance')}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                  <div className="flex flex-col h-full items-center justify-center p-3 text-center">
                    <Users className="w-8 h-8 mb-2 text-festival-purple" />
                    <h3 className="text-sm font-bold leading-tight">Student<br/>Teams</h3>
                 </div>
              </motion.div>

              {/* 4. Practice Partners (Spans 2 cols on mobile) */}
              <motion.div 
                 className="col-span-2 md:col-span-2 h-20 md:h-40 cursor-pointer group relative overflow-hidden rounded-2xl border border-primary/10 bg-surface/40 hover:bg-surface/60 flex items-center md:flex-col md:items-start md:justify-end p-4 md:p-6"
                  onClick={() => navigate(practicePartnersPath)}
                 whileHover={{ scale: 1.02 }}
                 whileTap={{ scale: 0.98 }}
              >
                  <Handshake className="w-8 h-8 mr-4 md:mr-0 md:mb-2 text-festival-purple" />
                  <div className="text-left">
                     <h3 className="font-bold text-sm md:text-lg">Practice Partners</h3>
                     <p className="text-xs text-muted-foreground hidden md:block">Find a dance buddy</p>
                  </div>
              </motion.div>

               {/* 5. Discounts (Spans 2 cols) */}
              <motion.div 
                 className="col-span-2 md:col-span-2 h-auto py-3 px-4 cursor-pointer group relative overflow-hidden rounded-xl border border-dashed border-primary/30 bg-primary/5 hover:bg-primary/10 flex items-center justify-center gap-3"
                 onClick={() => navigate('/discounts')}
                 whileHover={{ scale: 1.02 }}
                 whileTap={{ scale: 0.98 }}
              >
                  <Ticket className="w-5 h-5 text-primary" />
                  <span className="text-sm font-medium text-primary">Student VIP Discounts available</span>
                  <ArrowRight className="w-4 h-4 text-primary opacity-50" />
              </motion.div>
            </div>
          </ScrollReveal>
      </section>

      {/* What's On Section */}
      <section id="calendar" className="px-4 mb-8">
        <ScrollReveal animation="fadeUp">
          <h2 className="text-3xl md:text-4xl font-black text-center mb-8">
            <span className="text-foreground">Class </span>
            <span className="text-primary">Schedule</span>
          </h2>
        </ScrollReveal>
        
        <EventCalendar defaultCategory="classes" />
      </section>

      {/* Teachers Showcase */}
      <section id="teachers" className="px-4 mb-16 max-w-4xl mx-auto">
        <ScrollReveal animation="fadeUp">
          <Card className="p-6 md:p-8 bg-gradient-to-br from-primary/20 via-festival-purple/10 to-festival-pink/20 border-primary/30">
            <div className="flex flex-col md:flex-row items-center gap-4 md:gap-6">
              <GraduationCap className="w-16 h-16 text-primary" />
              <div className="text-center md:text-left flex-1">
                <h2 className="text-2xl md:text-3xl font-bold mb-2">
                  <span className="text-foreground">Meet Our </span>
                  <span className="text-primary">Teachers</span>
                </h2>
                <p className="text-muted-foreground mb-4">Learn from the best instructors in London</p>
                
                {/* Avatar stack */}
                <div className="flex items-center justify-center md:justify-start gap-2 mb-4">
                  <div className="flex -space-x-3">
                    {[1, 2, 3, 4].map((i) => (
                      <motion.div 
                        key={i} 
                        className="w-10 h-10 rounded-full bg-surface border-2 border-background flex items-center justify-center text-lg overflow-hidden"
                        initial={{ x: -20, opacity: 0 }}
                        animate={{ x: 0, opacity: 1 }}
                        transition={{ delay: i * 0.1 }}
                      >
                         <Users className="w-5 h-5 text-muted-foreground" />
                      </motion.div>
                    ))}
                  </div>
                  <span className="text-sm text-muted-foreground ml-2">{teacherCount ? `${teacherCount}+` : '50+'} verified teachers</span>
                </div>
              </div>
              
              <Button 
                onClick={() => navigate('/teachers')}
                className="shrink-0"
                size="lg"
              >
                <GraduationCap className="w-4 h-4 mr-2" />
                Browse All Teachers
              </Button>
            </div>
          </Card>
        </ScrollReveal>
      </section>

      {/* Student Teams / Performance Courses */}
      <section id="performance" className="px-4 mb-16 max-w-4xl mx-auto">
        <ScrollReveal animation="fadeUp">
          <Card className="p-6 md:p-8 bg-gradient-to-br from-festival-purple/20 via-primary/10 to-transparent border-festival-purple/30 relative overflow-hidden">
            <div className="absolute top-0 right-0 p-8 opacity-10">
              <Sparkles size={120} />
            </div>
            
            <div className="flex flex-col md:flex-row-reverse items-center gap-8 relative z-10">
              <div className="w-full md:w-1/3 aspect-video md:aspect-square bg-black/20 rounded-xl overflow-hidden relative">
                 <img 
                    src="https://images.unsplash.com/photo-1545959570-a9cb993b952f?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80" 
                    alt="Student Team Performance" 
                    className="w-full h-full object-cover"
                 />
                 <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent flex items-end p-4">
                    <span className="text-white text-xs font-bold uppercase tracking-wider">Student Showcase</span>
                 </div>
              </div>

              <div className="text-center md:text-left flex-1 space-y-4">
                <div>
                   <span className="inline-block py-1 px-3 rounded-full bg-festival-purple/20 text-festival-purple text-xs font-bold mb-2">
                     COMING SOON
                   </span>
                   <h2 className="text-3xl md:text-4xl font-black mb-2">
                     Join a <span className="text-festival-purple">Team</span>
                   </h2>
                </div>
                
                <p className="text-muted-foreground text-lg leading-relaxed">
                  Not a pro? No problem. Student performance teams are <strong>choreography courses</strong> designed for amateurs. 
                  Train for 10-12 weeks, make best friends, and perform at a local party.
                </p>

                <div className="flex flex-col sm:flex-row gap-3 justify-center md:justify-start pt-2">
                  <Button size="lg" className="bg-festival-purple hover:bg-festival-purple/90">
                    See Upcoming Auditions
                  </Button>
                </div>
              </div>
            </div>
          </Card>
        </ScrollReveal>
      </section>

      {/* FAQ Section */}
      <section className="px-4 mb-16 max-w-3xl mx-auto">
        <ScrollReveal animation="fadeUp">
          <div className="text-center mb-8">
            <h2 className="text-3xl font-bold mb-3">First Time? No Worries.</h2>
            <p className="text-muted-foreground text-sm md:text-base max-w-xl mx-auto">
              These answers apply to almost every Bachata class across London, regardless of the school or teacher.
            </p>
          </div>
          <Card className="p-4 bg-card/50 backdrop-blur-sm border-primary/20">
            <Accordion type="single" collapsible className="w-full">
              {[
                { q: "Do I need a partner?", a: "No! 90% of people come solo. We rotate partners in class so you meet everyone quickly." },
                { q: "What should I wear?", a: "Comfortable clothes you can move in. Gym shoes or smooth-soled shoes are best. No heels required!" },
                { q: "I have two left feet!", a: "That's why you're here! Beginners classes assume you know nothing. We go slow and step-by-step." },
                { q: "Do I need to book in advance?", a: "It helps, but drop-ins are usually welcome. Check the event details above for specifics." },
                { q: "Is it awkward going alone?", a: "Not at all. Everyone is there to learn and meet new people. The shared activity breaks the ice instantly." }
              ].map((faq, i) => (
                <AccordionItem key={i} value={`item-${i}`} className="border-primary/10">
                  <AccordionTrigger className="text-left font-medium hover:text-primary py-4">
                    {faq.q}
                  </AccordionTrigger>
                  <AccordionContent className="text-muted-foreground pb-4 leading-relaxed">
                    {faq.a}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </Card>
        </ScrollReveal>
      </section>

      {/* Conversion Section: Ready to Party? */}
      <section className="px-4 mb-24 max-w-4xl mx-auto">
        <ScrollReveal animation="fadeUp">
          <Card 
            className="p-8 md:p-12 relative overflow-hidden cursor-pointer group border-festival-pink/30"
            onClick={() => navigate('/parties')}
          >
            {/* Background Gradient */}
            <div className="absolute inset-0 bg-gradient-to-r from-festival-pink/20 via-festival-purple/10 to-transparent group-hover:from-festival-pink/30 transition-colors" />
            
            <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-8 text-center md:text-left">
               <div className="flex-1">
                 <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-festival-pink/10 text-festival-pink text-xs font-bold mb-4 border border-festival-pink/20">
                    <PartyPopper className="w-3 h-3" />
                    NEXT STEP
                 </div>
                 <h2 className="text-3xl md:text-4xl font-black mb-4">
                   Ready to try out your moves?
                 </h2>
                 <p className="text-lg text-muted-foreground max-w-md">
                   Applying what you learn is the fastest way to improve. Find a beginner-friendly party tonight.
                 </p>
               </div>
               
               <Button size="xl" className="bg-festival-pink hover:bg-festival-pink/90 text-white shadow-lg shadow-festival-pink/20 group-hover:scale-105 transition-all text-lg h-14 px-8">
                 Find a Party
                 <ArrowRight className="ml-2 w-5 h-5 group-hover:translate-x-1 transition-transform" />
               </Button>
            </div>
          </Card>
        </ScrollReveal>
      </section>

      {/* Why We Exist */}
      <WhyWeExist />

      {/* Footer */}
      <Footer />
    </div>
  );
};

export default Classes;











