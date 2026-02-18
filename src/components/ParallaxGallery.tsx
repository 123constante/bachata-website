import { motion, useScroll, useTransform } from 'framer-motion';
import { useRef } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';

const venueImages = [
  { url: 'https://images.unsplash.com/photo-1504609813442-a8924e83f76e?w=800', speed: 0.5 },
  { url: 'https://images.unsplash.com/photo-1518611012118-696072aa579a?w=800', speed: 0.3 },
  { url: 'https://images.unsplash.com/photo-1545959570-a94084071b5d?w=800', speed: 0.7 },
  { url: 'https://images.unsplash.com/photo-1533174072545-7a4b6ad7a6c3?w=800', speed: 0.4 },
  { url: 'https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?w=800', speed: 0.6 },
  { url: 'https://images.unsplash.com/photo-1429962714451-bb934ecdc4ec?w=800', speed: 0.35 },
];

export const ParallaxGallery = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ['start end', 'end start']
  });

  const positions = [
    { left: '2%', top: '8%', width: '280px', height: '340px', rotate: -3 },
    { left: '22%', top: '35%', width: '220px', height: '280px', rotate: 2 },
    { left: '42%', top: '5%', width: '320px', height: '380px', rotate: 0 },
    { right: '22%', top: '30%', width: '240px', height: '300px', rotate: -2 },
    { right: '2%', top: '8%', width: '260px', height: '320px', rotate: 3 },
    { right: '12%', top: '55%', width: '200px', height: '250px', rotate: -1 },
  ];

  return (
    <section ref={containerRef} className="relative py-24 md:py-32 overflow-hidden">
      {/* Background gradient */}
      <div className="absolute inset-0 bg-gradient-to-b from-background via-surface/50 to-background" />
      
      {/* Animated title with link */}
      <Link to="/venue-directory" className="block">
        <motion.div 
          className="text-center mb-16 relative z-10 px-4 cursor-pointer group"
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          whileHover={{ scale: 1.02 }}
        >
          <h2 className="text-3xl md:text-5xl font-black mb-2">
            Explore <span className="gradient-text">Venues</span>
          </h2>
          <p className="text-muted-foreground text-base md:text-lg mb-4">Discover each location</p>
          <motion.span 
            className="inline-flex items-center gap-2 text-primary font-semibold text-sm"
            whileHover={{ x: 5 }}
          >
            View All Venues <ArrowRight className="w-4 h-4" />
          </motion.span>
        </motion.div>
      </Link>

      {/* Dramatic Parallax Grid */}
      <div className="relative h-[550px] md:h-[600px] max-w-7xl mx-auto px-4">
        {venueImages.map((img, i) => {
          const y = useTransform(scrollYProgress, [0, 1], [0, -150 * img.speed]);
          const scale = useTransform(scrollYProgress, [0, 0.5, 1], [0.9, 1, 0.9]);
          const pos = positions[i];

          return (
            <motion.div
              key={i}
              className="absolute rounded-2xl overflow-hidden shadow-2xl cursor-pointer"
              style={{
                left: pos.left,
                right: pos.right,
                top: pos.top,
                width: pos.width,
                height: pos.height,
                y,
                scale,
                rotate: pos.rotate,
              }}
              initial={{ opacity: 0, y: 50 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: i * 0.1 }}
              whileHover={{ 
                scale: 1.08, 
                zIndex: 20,
                rotate: 0,
                boxShadow: '0 25px 50px -12px hsl(var(--primary) / 0.5)'
              }}
            >
              <img 
                src={img.url} 
                alt={`Venue ${i + 1}`}
                className="w-full h-full object-cover"
              />
              {/* Gradient overlay */}
              <motion.div 
                className="absolute inset-0 bg-gradient-to-t from-primary/60 via-primary/20 to-transparent opacity-0"
                whileHover={{ opacity: 1 }}
                transition={{ duration: 0.3 }}
              />
              {/* Glow effect */}
              <div className="absolute inset-0 opacity-0 hover:opacity-100 transition-opacity duration-300 pointer-events-none">
                <div className="absolute inset-0 bg-gradient-to-t from-primary/30 to-transparent" />
              </div>
            </motion.div>
          );
        })}
      </div>
    </section>
  );
};
