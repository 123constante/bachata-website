import { useState } from 'react';
import { motion, useScroll, useSpring, AnimatePresence } from 'framer-motion';
import { 
  Crown, CheckCircle, Sparkles, Zap, ArrowRight, Star, Gift, Heart, ChevronLeft, ChevronRight
} from 'lucide-react';
import { ScrollReveal, StaggerContainer, StaggerItem } from '@/components/ScrollReveal';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import PageHero from '@/components/PageHero';
import { FloatingElements } from '@/components/FloatingElements';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { SavingsCalculator } from '@/components/SavingsCalculator';
import { DiscountPartners } from '@/components/DiscountPartners';
import { LiveDiscounts } from '@/components/LiveDiscounts';
import { TonightSavingsAlert } from '@/components/TonightSavingsAlert';
import { CommunitySpotlight } from '@/components/CommunitySpotlight';
import { RecentSignupsTicker } from '@/components/RecentSignupsTicker';
import { useAuth } from '@/hooks/useAuth';
import { useNavigate } from 'react-router-dom';

const testimonials = [
  { quote: "Best £20 I spend each month. I've saved over £200 on events already!", name: "Maria", since: "2023", emoji: "💃" },
  { quote: "The guest list alone is worth it. No more queuing or filling forms!", name: "James", since: "2024", emoji: "🕺" },
  { quote: "I go to 3-4 events a month now because the discounts make it so affordable.", name: "Sofia", since: "2023", emoji: "✨" },
  { quote: "Priority access to sold-out events has been a game changer for me.", name: "Marcus", since: "2024", emoji: "🔥" },
  { quote: "Cancelled other subscriptions to keep this one. It's that good!", name: "Lucia", since: "2023", emoji: "💖" },
  { quote: "Made so many friends at exclusive members-only events!", name: "Daniel", since: "2024", emoji: "🥂" },
];

const faqs = [
  { question: "How do I use my VIP discount?", answer: "Simply say your name at the door or when booking online. Your membership is linked to your profile, so no codes or forms needed." },
  { question: "Can I cancel anytime?", answer: "Yes! There's no commitment. You can cancel your membership at any time from your profile settings." },
  { question: "Which events are included?", answer: "All partner events in London are included. This covers most major bachata socials, parties, and workshops in the city." },
  { question: "How much will I actually save?", answer: "Most members save £50-200+ per month depending on how often they go out. If you attend 2+ events per month, you'll definitely save money." },
  { question: "What is guest list entry?", answer: "You get guaranteed entry at every partner event - just say your name at the door. No need to fill in guest list forms or worry about capacity." },
];

const Discounts = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { scrollYProgress } = useScroll();
  const scaleX = useSpring(scrollYProgress, { stiffness: 100, damping: 30 });
  const [currentTestimonialPage, setCurrentTestimonialPage] = useState(0);
  const testimonialsPerPage = 3;
  const totalPages = Math.ceil(testimonials.length / testimonialsPerPage);

  const benefits = [
    "Biggest discounts for any event in London",
    "Guaranteed guest list entry - just say your name",
    "No forms to fill in, no hassle",
    "Works at every partner event",
    "Priority access to sold-out events",
    "Exclusive members-only events",
  ];

  const heroWidgets = [
    { emoji: "💰", title: "Best Discounts", desc: "Unbeatable prices", sectionId: "benefits" },
    { emoji: "📋", title: "Guest List", desc: "Say your name", sectionId: "benefits" },
    { emoji: "👑", title: "VIP Treatment", desc: "Priority access", sectionId: "join" },
  ];

  const floatingIcons = [Crown, Star, Zap, Gift, Sparkles, Heart];

  const nextPage = () => setCurrentTestimonialPage((prev) => (prev + 1) % totalPages);
  const prevPage = () => setCurrentTestimonialPage((prev) => (prev - 1 + totalPages) % totalPages);

  const visibleTestimonials = testimonials.slice(
    currentTestimonialPage * testimonialsPerPage,
    (currentTestimonialPage + 1) * testimonialsPerPage
  );

  const handleJoinClick = () => {
    if (user) {
      navigate('/profile');
    } else {
      navigate('/auth');
    }
  };

  return (
    <div className="min-h-screen text-foreground overflow-x-hidden pb-24">
      {/* Scroll Progress Bar */}
      <motion.div
        className="fixed top-0 left-0 right-0 h-1 bg-gradient-to-r from-primary via-festival-pink to-festival-purple z-50 origin-left"
        style={{ scaleX }}
      />

      {/* Floating Elements Background */}
      <FloatingElements count={20} />

      {/* Hero Section */}
      <PageHero
        emoji=''
        titleWhite='VIP'
        titleOrange='Membership'
        subtitle='£20/month. Best discounts in London. Guest list at every event. Just say your name.'
        widgets={heroWidgets}
        gradientFrom='amber-500'
        floatingIcons={floatingIcons}
        breadcrumbItems={[{ label: 'Discounts' }]}
        topPadding='pt-20'
        largeTitle={true}
      />

      {/* Tonight's Event Alert */}
      <TonightSavingsAlert />

      {/* Recent Activity Ticker */}
      <RecentSignupsTicker />

      {/* Interactive Savings Calculator */}
      <ScrollReveal animation="fadeUp" duration={0.8}>
        <SavingsCalculator />
      </ScrollReveal>

      {/* Live Discounts - Gated Access */}
      <LiveDiscounts />

      {/* Benefits Section */}
      <ScrollReveal animation="fadeUp" duration={0.8} delay={0.1}>
        <section id="benefits" className="px-4 mb-16">
          <Card className="p-6 md:p-8 bg-gradient-to-br from-amber-500/10 via-orange-500/5 to-red-500/10 border-amber-500/20 relative overflow-hidden">
            {/* Decorative elements */}
            <div className="absolute top-0 right-0 w-40 h-40 bg-gradient-to-bl from-amber-400/10 to-transparent rounded-full blur-3xl" />
            <div className="absolute bottom-0 left-0 w-32 h-32 bg-gradient-to-tr from-orange-400/10 to-transparent rounded-full blur-2xl" />
            
            <div className="relative z-10">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-12 h-12 rounded-xl bg-amber-500/20 flex items-center justify-center">
                  <Crown className="w-6 h-6 text-amber-400" />
                </div>
                <div>
                  <h2 className="text-2xl md:text-3xl font-bold text-foreground">Why Join?</h2>
                  <p className="text-xs text-amber-400">Everything you get as a VIP member</p>
                </div>
              </div>
              
              <StaggerContainer staggerDelay={0.1} className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-8">
                {benefits.map((benefit, i) => (
                  <StaggerItem key={i}>
                    <motion.div
                      whileHover={{ x: 4 }}
                      className="flex items-center gap-3 bg-background/30 backdrop-blur-sm rounded-lg p-3 border border-amber-500/10"
                    >
                      <CheckCircle className="w-5 h-5 text-green-400 flex-shrink-0" />
                      <span className="text-sm text-foreground">{benefit}</span>
                    </motion.div>
                  </StaggerItem>
                ))}
              </StaggerContainer>
            </div>
          </Card>
        </section>
      </ScrollReveal>

      {/* Join CTA Section */}
      <ScrollReveal animation="scale" duration={0.8} delay={0.2}>
        <section id="join" className="px-4 mb-16">
          <Card className="p-8 md:p-12 bg-gradient-to-br from-primary/20 via-primary/10 to-primary/5 border-primary/30 relative overflow-hidden text-center">
            {/* Animated background */}
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
              className="absolute inset-0 bg-gradient-conic from-primary/5 via-transparent to-primary/5"
            />
            
            {/* Sparkle effects */}
            <motion.div
              animate={{ scale: [1, 1.5, 1], opacity: [0.3, 0.6, 0.3] }}
              transition={{ duration: 2, repeat: Infinity }}
              className="absolute top-8 right-12"
            >
              <Zap className="w-8 h-8 text-amber-400" />
            </motion.div>
            <motion.div
              animate={{ scale: [1.2, 0.8, 1.2], opacity: [0.4, 0.7, 0.4] }}
              transition={{ duration: 2.5, repeat: Infinity, delay: 0.5 }}
              className="absolute bottom-12 left-8"
            >
              <Sparkles className="w-6 h-6 text-primary" />
            </motion.div>
            
            <div className="relative z-10">
              <motion.div
                animate={{ scale: [1, 1.05, 1] }}
                transition={{ duration: 2, repeat: Infinity }}
                className="text-5xl mb-4"
              >
                🤔
              </motion.div>
              
              <h2 className="text-3xl md:text-4xl font-black text-foreground mb-2">
                Join for <span className="text-primary">£20/month</span>
              </h2>
              
              <p className="text-muted-foreground mb-8 max-w-md mx-auto text-sm">
                Nobody will have a better discount than you. Guaranteed guest list on every event. Just say your name.
              </p>
              
              <div className="flex items-center justify-center mb-8">
                 <CommunitySpotlight />
                 <div className="text-left ml-4">
                  <span className="text-sm font-medium text-foreground block">500+ VIP members</span>
                  <span className="text-xs text-muted-foreground">Already enjoying the perks</span>
                </div>
              </div>
              
              <motion.div
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.98 }}
              >
                <Button
                  size="lg"
                  onClick={handleJoinClick}
                  className="bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white font-bold text-lg px-10 py-6 rounded-full shadow-lg shadow-amber-500/30"
                >
                  <Crown className="w-5 h-5 mr-2" />
                  {user ? "View My Membership" : "Join for £20/month"}
                  <ArrowRight className="w-5 h-5 ml-2" />
                </Button>
              </motion.div>
              
              <p className="text-xs text-muted-foreground mt-4">
                Cancel anytime. No commitment.
              </p>
            </div>
          </Card>
        </section>
      </ScrollReveal>

      {/* Active Partners */}
      <DiscountPartners />

      {/* Testimonials Carousel */}
      <ScrollReveal animation="fadeUp" duration={0.8} delay={0.3}>
        <section className="px-4 mb-16">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold text-foreground">What Members Say</h2>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="icon"
                onClick={prevPage}
                className="h-8 w-8 rounded-full border-border/50"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="icon"
                onClick={nextPage}
                className="h-8 w-8 rounded-full border-border/50"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <AnimatePresence mode="wait">
              {visibleTestimonials.map((testimonial, i) => (
                <motion.div
                  key={`${currentTestimonialPage}-${i}`}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  transition={{ duration: 0.3, delay: i * 0.1 }}
                >
                  <Card className="p-4 bg-card/50 backdrop-blur-sm border-border/50 h-full">
                    <div className="flex gap-1 mb-3">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <Star key={star} className="w-3 h-3 text-amber-400 fill-amber-400" />
                      ))}
                    </div>
                    <blockquote className="text-sm text-foreground italic mb-4 line-clamp-3">
                      "{testimonial.quote}"
                    </blockquote>
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-sm">
                        {testimonial.emoji}
                      </div>
                      <div>
                        <span className="text-xs font-medium text-foreground block">{testimonial.name}</span>
                        <span className="text-[10px] text-muted-foreground">Member since {testimonial.since}</span>
                      </div>
                    </div>
                  </Card>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
          
          {/* Page indicators */}
          <div className="flex justify-center gap-2 mt-4">
            {Array.from({ length: totalPages }).map((_, i) => (
              <button
                key={i}
                onClick={() => setCurrentTestimonialPage(i)}
                className={`w-2 h-2 rounded-full transition-colors ${
                  i === currentTestimonialPage ? 'bg-primary' : 'bg-border'
                }`}
              />
            ))}
          </div>
        </section>
      </ScrollReveal>

      {/* FAQ Section */}
      <ScrollReveal animation="fadeUp" duration={0.8} delay={0.4}>
        <section className="px-4 mb-24">
          <h2 className="text-xl font-bold text-foreground mb-6">Frequently Asked Questions</h2>
          <Card className="p-4 bg-card/50 backdrop-blur-sm border-border/50">
            <Accordion type="single" collapsible className="w-full">
              {faqs.map((faq, i) => (
                <AccordionItem key={i} value={`item-${i}`} className="border-border/30">
                  <AccordionTrigger className="text-sm font-medium text-foreground hover:text-primary py-3">
                    {faq.question}
                  </AccordionTrigger>
                  <AccordionContent className="text-sm text-muted-foreground pb-3">
                    {faq.answer}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </Card>
        </section>
      </ScrollReveal>
    </div>
  );
};

export default Discounts;



