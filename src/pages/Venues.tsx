import { useState } from 'react';
import { motion, useScroll, useSpring } from 'framer-motion';
import { MapPin, Star, Building, Instagram, Heart, Music, Sparkles, Clock, PartyPopper } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import PageHero from '@/components/PageHero';
import PageBreadcrumb from '@/components/PageBreadcrumb';
import { ScrollReveal, StaggerContainer, StaggerItem } from '@/components/ScrollReveal';
import { FloatingElements } from '@/components/FloatingElements';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';

const heroWidgets = [
  {
    emoji: '🔍',
    title: 'Find A Venue',
    desc: 'Browse all venues',
    sectionId: 'directory',
  },
  {
    emoji: '“',
    title: 'List Your Venue',
    desc: 'Join the directory',
    sectionId: 'get-listed',
  },
];

const floatingIcons = [MapPin, Star, Building, Music, Sparkles, Heart];


const venues = [
  {
    id: 'salsa-street-studio',
    name: 'Salsa Street Studio',
    location: 'Soho, London',
    rating: 4.8,
    reviewCount: 124,
    features: ['Sprung Floor', 'Bar', 'AC'],
    description: 'Premium dance studio in the heart of Soho with excellent sound system.',
    avatar: '¢',
    website: 'https://example.com',
    instagram: '@salsastreetstudio',
  },
  {
    id: 'dance-avenue',
    name: 'Dance Avenue',
    location: 'Shoreditch, London',
    rating: 4.6,
    reviewCount: 89,
    features: ['Multiple Rooms', 'Parking', 'Cafe'],
    description: 'Spacious venue with multiple rooms for classes and socials.',
    avatar: '›ï¸',
    website: 'https://example.com',
    instagram: '@danceavenue',
  },
  {
    id: 'rhythm-road',
    name: 'Rhythm Road',
    location: 'Brixton, London',
    rating: 4.9,
    reviewCount: 156,
    features: ['VIP Area', 'Two Floors', 'Late License'],
    description: 'The go-to venue for late night bachata socials with amazing vibes.',
    avatar: 'ª',
    website: 'https://example.com',
    instagram: '@rhythmroad',
  },
  {
    id: 'festival-lane',
    name: 'Festival Lane',
    location: 'Camden, London',
    rating: 4.7,
    reviewCount: 98,
    features: ['Stage', 'Outdoor Space', 'Live Music'],
    description: 'Unique venue with outdoor terrace perfect for summer socials.',
    avatar: 'Ÿï¸',
    website: 'https://example.com',
    instagram: '@festivallane',
  },
  {
    id: 'latin-quarter',
    name: 'Latin Quarter',
    location: 'Elephant & Castle, London',
    rating: 4.5,
    reviewCount: 67,
    features: ['Authentic Vibe', 'Latin Food', 'Salsa Room'],
    description: 'Traditional Latin venue with authentic atmosphere and great food.',
    avatar: '­',
    website: 'https://example.com',
    instagram: '@latinquarter',
  },
  {
    id: 'move-studio',
    name: 'Move Studio',
    location: 'Angel, London',
    rating: 4.8,
    reviewCount: 112,
    features: ['Mirrors', 'Recording', 'Private Hire'],
    description: 'Modern studio space ideal for workshops and private lessons.',
    avatar: '’ƒ',
    website: 'https://example.com',
    instagram: '@movestudio',
  },
  {
    id: 'groove-central',
    name: 'Groove Central',
    location: 'Hackney, London',
    rating: 4.7,
    reviewCount: 134,
    features: ['Sound System', 'Lighting', 'Bar'],
    description: 'Underground venue known for its incredible sound and atmosphere.',
    avatar: 'µ',
    website: 'https://example.com',
    instagram: '@groovecentral',
  },
  {
    id: 'steps-ahead',
    name: 'Steps Ahead',
    location: 'Clapham, London',
    rating: 4.6,
    reviewCount: 78,
    features: ['Beginner Friendly', 'Workshops', 'Social Area'],
    description: 'Welcoming venue perfect for beginners and social dancers alike.',
    avatar: 'ŒŸ',
    website: 'https://example.com',
    instagram: '@stepsahead',
  },
];

const Venues = () => {
  const { scrollYProgress } = useScroll();
  const scaleX = useSpring(scrollYProgress, { stiffness: 100, damping: 30 });
  const navigate = useNavigate();
  const { toast } = useToast();
  const [formData, setFormData] = useState({
    name: '',
    contactNumber: '',
  });

  const scrollToSection = (sectionId: string) => {
    document.getElementById(sectionId)?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    toast({
      title: "Submission Received!",
      description: "We'll contact you within 2 hours.",
    });
    setFormData({ name: '', contactNumber: '' });
  };

  return (
    <div className="min-h-screen text-foreground overflow-x-hidden pb-20">
      {/* Progress Bar */}
      <motion.div 
        className="fixed top-0 left-0 right-0 h-1 bg-gradient-to-r from-primary via-festival-pink to-festival-purple z-40 origin-left"
        style={{ scaleX }}
      />

      <FloatingElements count={20} />

      <PageBreadcrumb items={[{ label: 'Home', path: '/' }, { label: 'Venues' }]} />
      {/* Hero Section */}
      <PageHero
        emoji="🔍"
        titleWhite="Dance"
        titleOrange="Venues"
        subtitle=""
        widgets={heroWidgets}
        gradientFrom="primary"
        floatingIcons={floatingIcons}
        largeTitle={true}
      />


      {/* Venues Directory */}
      <section id="directory" className="px-4 mb-16">
        <ScrollReveal animation="fadeUp">
          <h2 className="text-3xl md:text-4xl font-black text-center mb-12">
            <span className="text-foreground">Browse </span>
            <span className="text-primary">Venues</span>
          </h2>
        </ScrollReveal>

        <StaggerContainer className="max-w-7xl mx-auto grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {venues.map((venue) => (
            <StaggerItem key={venue.id}>
              <motion.div whileHover={{ y: -8, scale: 1.02 }} transition={{ duration: 0.3 }}>
                <Card className="p-6 h-full bg-gradient-to-br from-surface to-background border-primary/20 hover:border-primary/50 transition-all duration-300 group">
                  {/* Avatar & Rating */}
                  <div className="flex items-start justify-between mb-4">
                    <motion.div
                      className="text-5xl"
                      whileHover={{ scale: 1.2, rotate: 10 }}
                      transition={{ type: 'spring', stiffness: 300 }}
                    >
                      {venue.avatar}
                    </motion.div>
                    <div className="flex items-center gap-1 bg-primary/10 px-2 py-1 rounded-full">
                      <Star className="w-3 h-3 text-primary fill-primary" />
                      <span className="text-xs font-bold text-primary">{venue.rating}</span>
                    </div>
                  </div>

                  {/* Info */}
                  <h3 className="text-lg font-bold text-foreground mb-1 group-hover:text-primary transition-colors">
                    {venue.name}
                  </h3>
                  <div className="flex items-center gap-1 text-muted-foreground text-sm mb-2">
                    <MapPin className="w-3 h-3" />
                    <span>{venue.location}</span>
                  </div>
                  <p className="text-sm text-muted-foreground mb-3 line-clamp-2">
                    {venue.description}
                  </p>

                  {/* Features */}
                  <div className="flex flex-wrap gap-1 mb-4">
                    {venue.features.slice(0, 3).map((feature, i) => (
                      <span
                        key={i}
                        className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full"
                      >
                        {feature}
                      </span>
                    ))}
                  </div>

                  {/* Actions */}
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      className="flex-1"
                      onClick={() => navigate(`/venues/${venue.id}`)}
                    >
                      View Details
                    </Button>
                    <motion.a
                      href={`https://instagram.com/${venue.instagram?.replace('@', '')}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-2 rounded-lg bg-primary/10 hover:bg-primary/20 transition-colors"
                      whileHover={{ scale: 1.1 }}
                      whileTap={{ scale: 0.95 }}
                    >
                      <Instagram className="w-4 h-4 text-primary" />
                    </motion.a>
                  </div>
                </Card>
              </motion.div>
            </StaggerItem>
          ))}
        </StaggerContainer>
      </section>

      {/* Get Listed Section */}
      <section id="get-listed" className="px-4 mb-16">
        <div className="max-w-md mx-auto">
          <ScrollReveal animation="fadeUp">
            <Card className="p-8 bg-gradient-to-br from-primary/20 via-festival-purple/10 to-festival-pink/20 border-primary/30">
              <div className="text-center mb-8">
                <motion.span
                  className="text-6xl inline-block mb-4"
                  animate={{ rotate: [-5, 5, -5] }}
                  transition={{ duration: 2, repeat: Infinity }}
                >
                  “
                </motion.span>
                <h2 className="text-3xl font-black mb-2">
                  <span className="text-foreground">List Your </span>
                  <span className="text-primary">Venue</span>
                </h2>
                <p className="text-muted-foreground">
                  Have a venue perfect for dance events? We'd love to hear from you.
                </p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="text-sm font-medium mb-1 block">Your Name *</label>
                  <Input
                    placeholder="Enter your name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    required
                  />
                </div>
                <div>
                  <label className="text-sm font-medium mb-1 block">Contact Number *</label>
                  <Input
                    type="tel"
                    placeholder="Your phone number"
                    value={formData.contactNumber}
                    onChange={(e) => setFormData({ ...formData, contactNumber: e.target.value })}
                    required
                  />
                </div>
                <Button type="submit" className="w-full" size="lg">
                  <Building className="w-4 h-4 mr-2" />
                  Submit
                </Button>
                <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground pt-2">
                  <Clock className="w-4 h-4 text-primary" />
                  <span>We'll contact you within 2 hours</span>
                </div>
              </form>
            </Card>
          </ScrollReveal>
        </div>
      </section>

      {/* Footer */}
    </div>
  );
};

export default Venues;

