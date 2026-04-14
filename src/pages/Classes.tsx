import { motion, useScroll, useSpring } from 'framer-motion';
import { Star, Sparkles } from 'lucide-react';
import PageHero from '@/components/PageHero';
import { ScrollReveal } from '@/components/ScrollReveal';
import { FloatingElements } from '@/components/FloatingElements';
import { EventCalendar } from '@/components/EventCalendar';

const Classes = () => {
  const { scrollYProgress } = useScroll();
  const scaleX = useSpring(scrollYProgress, { stiffness: 100, damping: 30 });

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
        emoji='🎓'
        titleWhite='Learn'
        titleOrange='Bachata'
        subtitle=''
        largeTitle={true}
        hideBackground={true}
        breadcrumbItems={[{ label: 'Classes' }]}
        floatingIcons={[Star, Sparkles]}
        topPadding='pt-20'
      />

      {/* Class Schedule */}
      <section id="calendar" className="px-4 mb-8">
        <EventCalendar defaultCategory="classes" />
      </section>

    </div>
  );
};

export default Classes;











