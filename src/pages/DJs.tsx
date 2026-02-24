import { motion, useScroll, useSpring } from 'framer-motion';
import { 
  Heart, Music, Star, Sparkles, Disc3
} from 'lucide-react';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Link } from 'react-router-dom';
import { ScrollReveal, StaggerContainer, StaggerItem } from '@/components/ScrollReveal';
import { FloatingElements } from '@/components/FloatingElements';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import Footer from '@/components/Footer';
import PageBreadcrumb from '@/components/PageBreadcrumb';

const heroWidgets = [
  { emoji: "🔍", title: "Find A DJ", desc: "Browse directory", sectionId: "directory" },
  { emoji: "✍️", title: "Get Listed", desc: "Join as DJ", sectionId: "get-listed" },
];

const DJs = () => {
  const { scrollYProgress } = useScroll();
  const scaleX = useSpring(scrollYProgress, { stiffness: 100, damping: 30 });
  const { toast } = useToast();
  
  // Fetch DJs from entities table
  const { data: djs, isLoading } = useQuery({
    queryKey: ['dj-entities'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('entities')
        .select('*')
        .eq('type', 'dj')
        .order('name');
      
      if (error) throw error;
      return data ?? [];
    },
  });
  
  const [formData, setFormData] = useState({
    name: '',
    public_email: '',
    style: '',
    bio: '',
    instagram: ''
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);

  const scrollToSection = (sectionId: string) => {
    document.getElementById(sectionId)?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.name || !formData.style) {
      toast({
        title: "Missing information",
        description: "Please fill in all required fields.",
        variant: "destructive"
      });
      return;
    }

    setIsSubmitting(true);
    await new Promise(resolve => setTimeout(resolve, 1500));
    setIsSubmitting(false);
    setIsSubmitted(true);
    
    toast({
      title: "Application submitted!",
      description: "We'll review your profile and get back to you soon.",
    });
  };

  return (
    <div className="min-h-screen text-foreground overflow-x-hidden pb-20">
      {/* Progress Bar */}
      <motion.div 
        className="fixed top-0 left-0 right-0 h-1 bg-gradient-to-r from-primary via-festival-pink to-festival-purple z-40 origin-left"
        style={{ scaleX }}
      />

      <FloatingElements count={15} />

      {/* HERO */}
      <section className="pt-20 pb-24 px-4 relative overflow-hidden mb-12">
        <motion.div 
          className="absolute inset-0 bg-gradient-to-br from-primary/20 via-festival-purple/10 to-festival-pink/20"
          animate={{ backgroundPosition: ['0% 0%', '100% 100%'] }}
          transition={{ duration: 10, repeat: Infinity, repeatType: 'reverse' }}
          style={{ backgroundSize: '200% 200%' }}
        />
        
        <div className="relative z-10">
          <PageBreadcrumb items={[{ label: 'Parties', path: '/parties' }, { label: 'DJs' }]} />
        </div>

        {/* Floating Icons */}
        {[Disc3, Star, Heart, Music, Sparkles].map((Icon, i) => (
          <motion.div
            key={i}
            className="absolute text-primary/30"
            style={{ left: `${10 + i * 18}%`, top: `${20 + (i % 3) * 25}%` }}
            animate={{ y: [0, -30, 0], rotate: [0, 360], scale: [1, 1.2, 1] }}
            transition={{ duration: 4 + i, repeat: Infinity, delay: i * 0.5 }}
          >
            <Icon size={30 + i * 10} />
          </motion.div>
        ))}

        <div className="max-w-4xl mx-auto text-center relative z-10">
          <ScrollReveal animation="scale">
            <motion.div 
              className="text-7xl mb-8"
              animate={{ y: [0, -10, 0] }}
              transition={{ duration: 2, repeat: Infinity }}
            >
              §
            </motion.div>
          </ScrollReveal>

          <ScrollReveal animation="fadeUp" delay={0.2}>
            <h1 className="text-5xl md:text-7xl lg:text-8xl font-black mb-6 tracking-tight">
              Bachata{' '}
              <motion.span
                className="gradient-text inline-block"
                animate={{ scale: [1, 1.05, 1], rotate: [-1, 1, -1] }}
                transition={{ duration: 2, repeat: Infinity }}
              >
                DJs
              </motion.span>
            </h1>
          </ScrollReveal>

          {/* Hero Widgets */}
          <ScrollReveal animation="scale" delay={0.6}>
            <div className="flex justify-center gap-4 mt-8">
              {heroWidgets.map((widget, index) => (
                <motion.div
                  key={widget.title}
                  onClick={() => scrollToSection(widget.sectionId)}
                  className="cursor-pointer p-4 md:p-6 bg-gradient-to-br from-surface/80 to-surface/40 backdrop-blur-sm rounded-2xl border border-primary/30 shadow-lg"
                  style={{
                    transformStyle: 'preserve-3d',
                    transform: `perspective(1000px) rotateY(${index === 0 ? -8 : 8}deg)`,
                  }}
                  whileHover={{ 
                    scale: 1.1, 
                    rotateY: 0,
                    boxShadow: '0 20px 40px rgba(0,0,0,0.3)',
                    z: 50
                  }}
                  whileTap={{ scale: 0.95 }}
                >
                  <span className="text-3xl md:text-4xl block mb-2">{widget.emoji}</span>
                  <h3 className="font-bold text-sm md:text-base text-foreground">{widget.title}</h3>
                  <p className="text-xs text-muted-foreground">{widget.desc}</p>
                </motion.div>
              ))}
            </div>
          </ScrollReveal>
        </div>
      </section>

      {/* DJs Directory */}
      <section id="directory" className="px-4 mb-16 max-w-7xl mx-auto">
        <ScrollReveal animation="fadeUp">
          <h2 className="text-3xl md:text-4xl font-black text-center mb-12">
            <span className="text-foreground">Our </span>
            <span className="text-primary">DJs</span>
          </h2>
        </ScrollReveal>

        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {[...Array(6)].map((_, i) => (
              <Card key={i} className="bg-surface/50 border-primary/20">
                <CardContent className="p-6">
                  <div className="flex flex-col items-center gap-4">
                    <Skeleton className="h-16 w-16 rounded-full" />
                    <Skeleton className="h-5 w-32" />
                    <Skeleton className="h-4 w-24" />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : djs && djs.length > 0 ? (
          <StaggerContainer className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {djs.map((dj) => (
              <StaggerItem key={dj.id}>
                <Link to={`/djs/${dj.id}`}>
                  <motion.div
                    whileHover={{ y: -8, scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    <Card className="bg-surface/50 backdrop-blur-sm border-primary/20 overflow-hidden h-full">
                      <CardContent className="p-6">
                        <div className="text-center mb-4">
                          <Avatar className="w-16 h-16 mx-auto mb-3 border border-primary/20">
                            <AvatarImage src={dj.avatar_url || undefined} alt={dj.name} />
                            <AvatarFallback className="bg-primary/10 text-primary text-xl">
                              {dj.name?.charAt(0) || '§'}
                            </AvatarFallback>
                          </Avatar>
                          <h3 className="font-bold text-lg text-foreground">{dj.name}</h3>
                          <p className="text-muted-foreground text-sm">DJ</p>
                        </div>
                        
                        {dj.bio && (
                          <p className="text-muted-foreground text-sm mb-4 text-center line-clamp-2">
                            {dj.bio}
                          </p>
                        )}
                      </CardContent>
                    </Card>
                  </motion.div>
                </Link>
              </StaggerItem>
            ))}
          </StaggerContainer>
        ) : (
          <div className="text-center py-12">
            <p className="text-muted-foreground">No DJs listed yet.</p>
          </div>
        )}
      </section>

      {/* Get Listed Section */}
      <section id="get-listed" className="px-4 mb-16 max-w-2xl mx-auto">
        <ScrollReveal animation="fadeUp">
          <Card className="bg-gradient-to-br from-primary/20 via-festival-purple/10 to-festival-pink/20 border-primary/30 p-8">
            <div className="text-center mb-8">
              <motion.span 
                className="text-5xl block mb-4"
                animate={{ rotate: [0, -5, 5, 0] }}
                transition={{ duration: 2, repeat: Infinity }}
              >
                ✍️
              </motion.span>
              <h2 className="text-2xl md:text-3xl font-bold mb-2">
                <span className="text-foreground">Get </span>
                <span className="text-primary">Listed</span>
              </h2>
              <p className="text-muted-foreground">Join our DJ directory and reach more events</p>
            </div>

            {isSubmitted ? (
              <motion.div 
                className="text-center py-8"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
              >
                <span className="text-6xl block mb-4">🎉</span>
                <h3 className="text-xl font-bold text-primary mb-2">Application Submitted!</h3>
                <p className="text-muted-foreground">We'll be in touch soon.</p>
              </motion.div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                <Input
                  placeholder="Your DJ name *"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="bg-background/50"
                />
                <Input
                  type="email"
                  placeholder="Public contact email (optional)"
                  value={formData.public_email}
                  onChange={(e) => setFormData({ ...formData, public_email: e.target.value })}
                  className="bg-background/50"
                />
                <Input
                  placeholder="Music style (e.g., Sensual, Tradicional) *"
                  value={formData.style}
                  onChange={(e) => setFormData({ ...formData, style: e.target.value })}
                  className="bg-background/50"
                />
                <Input
                  placeholder="Instagram handle"
                  value={formData.instagram}
                  onChange={(e) => setFormData({ ...formData, instagram: e.target.value })}
                  className="bg-background/50"
                />
                <Textarea
                  placeholder="Tell us about your DJ experience..."
                  value={formData.bio}
                  onChange={(e) => setFormData({ ...formData, bio: e.target.value })}
                  className="bg-background/50 min-h-[100px]"
                />
                <Button 
                  type="submit" 
                  className="w-full"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? (
                    <motion.span
                      animate={{ rotate: 360 }}
                      transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                    >
                      ⏳
                    </motion.span>
                  ) : (
                    <>
                      <Disc3 className="w-4 h-4 mr-2" />
                      Submit Application
                    </>
                  )}
                </Button>
              </form>
            )}
          </Card>
        </ScrollReveal>
      </section>

      {/* Footer */}
      <Footer />
    </div>
  );
};

export default DJs;


