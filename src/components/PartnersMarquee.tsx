import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';

// Import all placeholder logos
import placeholder1 from '@/assets/partners/placeholder-1.png';
import placeholder2 from '@/assets/partners/placeholder-2.png';
import placeholder3 from '@/assets/partners/placeholder-3.png';
import placeholder4 from '@/assets/partners/placeholder-4.png';
import placeholder5 from '@/assets/partners/placeholder-5.png';
import placeholder6 from '@/assets/partners/placeholder-6.png';
import placeholder7 from '@/assets/partners/placeholder-7.png';
import placeholder8 from '@/assets/partners/placeholder-8.png';
import placeholder9 from '@/assets/partners/placeholder-9.png';
import placeholder10 from '@/assets/partners/placeholder-10.png';
import placeholder11 from '@/assets/partners/placeholder-11.png';
import placeholder12 from '@/assets/partners/placeholder-12.png';
import placeholder13 from '@/assets/partners/placeholder-13.png';
import placeholder14 from '@/assets/partners/placeholder-14.png';
import placeholder15 from '@/assets/partners/placeholder-15.png';
import placeholder16 from '@/assets/partners/placeholder-16.png';
import placeholder17 from '@/assets/partners/placeholder-17.png';
import placeholder18 from '@/assets/partners/placeholder-18.png';
import placeholder19 from '@/assets/partners/placeholder-19.png';
import placeholder20 from '@/assets/partners/placeholder-20.png';
import placeholder21 from '@/assets/partners/placeholder-21.png';
import placeholder22 from '@/assets/partners/placeholder-22.png';
import placeholder23 from '@/assets/partners/placeholder-23.png';
import placeholder24 from '@/assets/partners/placeholder-24.png';
import placeholder25 from '@/assets/partners/placeholder-25.png';
import placeholder26 from '@/assets/partners/placeholder-26.png';
import placeholder27 from '@/assets/partners/placeholder-27.png';
import placeholder28 from '@/assets/partners/placeholder-28.png';

// Partner data - replace logos later with real ones
const partners = [
  { logo: placeholder1, name: 'Bachata Central' },
  { logo: placeholder9, name: 'Passion Dance' },
  { logo: placeholder2, name: 'Salsa London' },
  { logo: placeholder10, name: 'Heart Rhythm' },
  { logo: placeholder3, name: 'Dance World' },
  { logo: placeholder11, name: 'Royal Dance' },
  { logo: placeholder4, name: 'Latin Arts' },
  { logo: placeholder12, name: 'Vinyl Nights' },
  { logo: placeholder5, name: 'Ritmo Dance' },
  { logo: placeholder13, name: 'Wave Academy' },
  { logo: placeholder6, name: 'Salsa Kings' },
  { logo: placeholder14, name: 'Compass Events' },
  { logo: placeholder7, name: 'Bachata Dreams' },
  { logo: placeholder15, name: 'Moonlight Dance' },
];

const partners2 = [
  { logo: placeholder16, name: 'Hex Studios' },
  { logo: placeholder8, name: 'Latin Nights' },
  { logo: placeholder17, name: 'Butterfly Dance' },
  { logo: placeholder18, name: 'Sunrise Events' },
  { logo: placeholder19, name: 'Ruby Dance' },
  { logo: placeholder20, name: 'Green Moves' },
  { logo: placeholder21, name: 'Electric Steps' },
  { logo: placeholder22, name: 'Infinity Dance' },
  { logo: placeholder23, name: 'Phoenix Rising' },
  { logo: placeholder24, name: 'Cosmic Dance' },
  { logo: placeholder25, name: 'Unity Events' },
  { logo: placeholder26, name: 'Voice Academy' },
  { logo: placeholder27, name: 'Ticket Masters' },
  { logo: placeholder28, name: 'Stage Light' },
];

interface PartnerLogoProps {
  logo: string;
  name: string;
}

const PartnerLogo = ({ logo, name }: PartnerLogoProps) => (
  <div 
    className="flex-shrink-0 w-10 h-10 rounded-lg overflow-hidden mx-2"
    title={name}
  >
    <img 
      src={logo} 
      alt={name} 
      className="w-full h-full object-cover"
    />
  </div>
);

const MarqueeRow = ({ 
  items, 
  direction = 'left',
  duration = 25 
}: { 
  items: typeof partners; 
  direction?: 'left' | 'right';
  duration?: number;
}) => {
  const duplicatedItems = [...items, ...items];
  
  return (
    <div className="overflow-hidden relative">
      {/* Edge fade gradients */}
      <div className="absolute left-0 top-0 bottom-0 w-12 bg-gradient-to-r from-background to-transparent z-10" />
      <div className="absolute right-0 top-0 bottom-0 w-12 bg-gradient-to-l from-background to-transparent z-10" />
      
      <motion.div
        className="flex"
        animate={{ 
          x: direction === 'left' ? ['0%', '-50%'] : ['-50%', '0%'] 
        }}
        transition={{
          x: {
            repeat: Infinity,
            repeatType: 'loop',
            duration,
            ease: 'linear',
          },
        }}
      >
        {duplicatedItems.map((partner, i) => (
          <PartnerLogo 
            key={`${partner.name}-${i}`} 
            {...partner} 
          />
        ))}
      </motion.div>
    </div>
  );
};

export const PartnersMarquee = () => {
  return (
    <Link to="/partners" className="block">
      <section className="py-12 px-4 cursor-pointer group">
        <div className="max-w-4xl mx-auto">
          {/* Title with CTA */}
          <div className="text-center mb-6">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider inline-flex items-center gap-2 group-hover:text-primary transition-colors">
              ¤ Partners We Trusted
              <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </h3>
          </div>
          
          {/* Two-row marquee */}
          <div className="space-y-2">
            <MarqueeRow items={partners} direction="left" duration={25} />
            <MarqueeRow items={partners2} direction="right" duration={30} />
          </div>
        </div>
      </section>
    </Link>
  );
};

