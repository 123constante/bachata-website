import { useParams, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, MapPin, Clock, Phone, Globe, Star } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollReveal } from '@/components/ScrollReveal';
import { useCity } from '@/contexts/CityContext';

// Mock venue data - will be replaced with real data later
const venueData: Record<string, {
  name: string;
  address: string;
  description: string;
  image: string;
  phone?: string;
  website?: string;
  openingHours: string;
  rating: number;
  features: string[];
}> = {
  'salsa-street-studio': {
    name: 'Salsa Street Studio',
    address: '123 Salsa Street, London W1D 3AJ',
    description: 'A vibrant dance studio in the heart of London, known for its amazing atmosphere and top-notch sound system. Perfect for bachata socials and latin dance events.',
    image: '/placeholder.svg',
    phone: '+44 20 1234 5678',
    website: 'https://salsastreetstudio.com',
    openingHours: 'Mon-Sun: 18:00 - 04:00',
    rating: 4.8,
    features: ['Wooden Dance Floor', 'Professional Sound System', 'Bar', 'Air Conditioning', 'Coat Check']
  },
  'dance-avenue': {
    name: 'Dance Avenue',
    address: '45 Dance Avenue, London EC1V 2NX',
    description: 'Modern dance studio with state-of-the-art facilities. Ideal for dance classes and workshops with experienced instructors.',
    image: '/placeholder.svg',
    phone: '+44 20 9876 5432',
    website: 'https://danceavenue.co.uk',
    openingHours: 'Mon-Sat: 10:00 - 22:00',
    rating: 4.6,
    features: ['Multiple Rooms', 'Mirrors', 'Changing Rooms', 'Free WiFi', 'Parking Available']
  },
  'rhythm-road': {
    name: 'Rhythm Road',
    address: '78 Rhythm Road, London SE1 8XX',
    description: 'Underground club atmosphere with the best weekend parties. Known for hosting international DJs and live performances.',
    image: '/placeholder.svg',
    openingHours: 'Fri-Sat: 21:00 - 05:00',
    rating: 4.9,
    features: ['VIP Area', 'Two Dance Floors', 'Premium Bar', 'Photo Booth', 'Smoking Terrace']
  },
  'festival-lane': {
    name: 'Festival Lane',
    address: '99 Festival Lane, London NW1 5TH',
    description: 'Large event space perfect for themed parties and special occasions. Capacity for over 500 dancers.',
    image: '/placeholder.svg',
    phone: '+44 20 5555 1234',
    website: 'https://festivallane.com',
    openingHours: 'Event-based',
    rating: 4.7,
    features: ['Huge Dance Floor', 'Stage', 'Multiple Bars', 'Outdoor Space', 'Private Hire Available']
  },
  'bachata-boulevard': {
    name: 'Bachata Boulevard',
    address: '12 Bachata Boulevard, London E2 7DJ',
    description: 'Intimate venue dedicated to bachata and latin dance. Cozy atmosphere with a focus on authentic sensual bachata.',
    image: '/placeholder.svg',
    website: 'https://bachataboulevard.co.uk',
    openingHours: 'Tue-Sun: 19:00 - 02:00',
    rating: 4.5,
    features: ['Intimate Setting', 'Great Acoustics', 'Cocktail Bar', 'Dance Workshops', 'Beginner Friendly']
  }
};

const Venue = () => {
  const { slug } = useParams<{ slug: string }>();
  const { citySlug } = useCity();
  const partiesPath = citySlug ? `/${citySlug}/parties` : '/parties';
  const venue = slug ? venueData[slug] : null;

  if (!venue) {
    return (
      <div className="min-h-screen flex items-center justify-center pt-20">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">Venue Not Found</h1>
          <Link to={partiesPath} className="text-primary hover:underline">
            â† Back to Events
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen pt-20 pb-24 overflow-x-hidden">
      {/* Hero Section */}
      <div className="relative h-[40vh] bg-gradient-to-b from-primary/20 to-background">
        <div className="absolute inset-0 bg-[url('/placeholder.svg')] bg-cover bg-center opacity-20" />
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/50 to-transparent" />
        
        {/* Back Button */}
        <div className="absolute top-6 left-6 z-10">
          <Link to={partiesPath}>
            <Button variant="outline" size="sm" className="backdrop-blur-sm bg-background/50">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Events
            </Button>
          </Link>
        </div>

        {/* Venue Name */}
        <div className="absolute bottom-8 left-0 right-0 px-6">
          <div className="max-w-4xl mx-auto">
            <motion.h1 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-5xl md:text-6xl lg:text-7xl font-black mb-4 tracking-tight"
            >
              {venue.name}
            </motion.h1>
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="flex items-center gap-2 text-muted-foreground"
            >
              <MapPin className="w-4 h-4" />
              <span>{venue.address}</span>
            </motion.div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-4xl mx-auto px-6 py-20">
        <div className="grid md:grid-cols-3 gap-8">
          {/* Main Content */}
          <div className="md:col-span-2 space-y-16">
            {/* Description */}
            <ScrollReveal animation="fadeUp" duration={0.8}>
              <div>
                <h2 className="text-2xl md:text-3xl font-bold mb-6">About This Venue</h2>
                <p className="text-sm text-muted-foreground leading-relaxed max-w-lg">
                  {venue.description}
                </p>
              </div>
            </ScrollReveal>

            {/* Features */}
            <ScrollReveal animation="fadeUp" duration={0.8} delay={0.1}>
              <div className="mt-16">
                <h2 className="text-2xl md:text-3xl font-bold mb-6">Features & Amenities</h2>
                <div className="flex flex-wrap gap-2">
                  {venue.features.map((feature, i) => (
                    <span 
                      key={i}
                      className="px-3 py-1.5 bg-primary/10 text-primary rounded-full text-sm"
                    >
                      {feature}
                    </span>
                  ))}
                </div>
              </div>
            </ScrollReveal>
          </div>

          {/* Sidebar */}
          <ScrollReveal animation="fadeRight" duration={0.8} delay={0.2}>
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
              className="space-y-8"
            >
              {/* Rating */}
              <div className="bg-surface/50 rounded-xl p-5 border border-primary/10">
                <div className="flex items-center gap-2 mb-2">
                  <Star className="w-5 h-5 text-yellow-500 fill-yellow-500" />
                  <span className="text-2xl font-bold">{venue.rating}</span>
                  <span className="text-muted-foreground">/ 5</span>
                </div>
                <p className="text-sm text-muted-foreground">Based on dancer reviews</p>
              </div>

              {/* Quick Info */}
              <div className="bg-surface/50 rounded-xl p-5 border border-primary/10 space-y-4">
                <div className="flex items-start gap-3">
                  <Clock className="w-5 h-5 text-primary mt-0.5" />
                  <div>
                    <p className="font-medium text-sm">Opening Hours</p>
                    <p className="text-muted-foreground text-sm">{venue.openingHours}</p>
                  </div>
                </div>

                {venue.phone && (
                  <div className="flex items-start gap-3">
                    <Phone className="w-5 h-5 text-primary mt-0.5" />
                    <div>
                      <p className="font-medium text-sm">Phone</p>
                      <a href={`tel:${venue.phone}`} className="text-primary text-sm hover:underline">
                        {venue.phone}
                      </a>
                    </div>
                  </div>
                )}

                {venue.website && (
                  <div className="flex items-start gap-3">
                    <Globe className="w-5 h-5 text-primary mt-0.5" />
                    <div>
                      <p className="font-medium text-sm">Website</p>
                      <a 
                        href={venue.website} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="text-primary text-sm hover:underline"
                      >
                        Visit Website
                      </a>
                    </div>
                  </div>
                )}
              </div>

              {/* Map Link */}
              <a
                href={`https://maps.google.com/?q=${encodeURIComponent(venue.address)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="block"
              >
                <Button className="w-full bg-[#F97316] hover:bg-[#EA580C]">
                  <MapPin className="w-4 h-4 mr-2" />
                  View on Google Maps
                </Button>
              </a>
            </motion.div>
          </ScrollReveal>
        </div>
      </div>
    </div>
  );
};

export default Venue;

