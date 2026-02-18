import { motion } from 'framer-motion';
import { MapPin, ArrowRight } from 'lucide-react';

const londonAreas = [
  { name: 'Shoreditch', vibe: '”¥ Trendy' },
  { name: 'Camden', vibe: '¸ Eclectic' },
  { name: 'Soho', vibe: '¨ Classic' },
  { name: 'Brixton', vibe: 'µ Underground' },
  { name: 'Kensington', vibe: '’Ž Elegant' },
  { name: 'Hackney', vibe: '¨ Creative' },
];

export const CityFocusBlock = () => {
  return (
    <section className="py-24 px-4 relative overflow-hidden">
      {/* Abstract city skyline background */}
      <div className="absolute inset-0 overflow-hidden opacity-10">
        <svg viewBox="0 0 1200 400" className="w-full h-full" preserveAspectRatio="xMidYMid slice">
          {[...Array(20)].map((_, i) => (
            <motion.rect
              key={i}
              x={i * 60}
              y={400 - Math.random() * 300}
              width={40}
              height={Math.random() * 300}
              fill="hsl(var(--primary))"
              initial={{ scaleY: 0 }}
              animate={{ scaleY: 1 }}
              transition={{ delay: i * 0.1, duration: 0.5 }}
            />
          ))}
        </svg>
      </div>

      <div className="max-w-5xl mx-auto relative z-10">
        {/* Header */}
        <motion.div
          className="mb-12"
          initial={{ opacity: 0, x: -50 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true }}
        >
          <motion.div
            className="inline-flex items-center gap-2 px-4 py-2 bg-primary/20 rounded-full mb-6"
            animate={{ scale: [1, 1.05, 1] }}
            transition={{ duration: 2, repeat: Infinity }}
          >
            <MapPin className="w-5 h-5 text-primary" />
            <span className="text-primary font-bold">City Spotlight</span>
          </motion.div>

          <h2 className="text-5xl md:text-7xl font-black mb-4">
            Explore <span className="gradient-text">London</span>
          </h2>
          <p className="text-muted-foreground text-xl max-w-xl">
            Every neighbourhood has its own flavour. Find your vibe.
          </p>
        </motion.div>

        {/* Area Grid */}
        <motion.div
          className="grid grid-cols-2 md:grid-cols-3 gap-4"
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
        >
          {londonAreas.map((area, i) => (
            <motion.div
              key={i}
              className="relative p-6 bg-surface/60 backdrop-blur-sm rounded-2xl border border-primary/10 cursor-pointer group overflow-hidden"
              initial={{ opacity: 0, scale: 0.9 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1 }}
              whileHover={{ 
                scale: 1.05,
                borderColor: 'hsl(var(--primary))'
              }}
            >
              {/* Background glow on hover */}
              <motion.div
                className="absolute inset-0 bg-gradient-to-br from-primary/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"
              />

              <div className="relative z-10">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-xl font-bold group-hover:text-primary transition-colors">
                    {area.name}
                  </h3>
                  <motion.div
                    className="opacity-0 group-hover:opacity-100"
                    animate={{ x: [0, 5, 0] }}
                    transition={{ duration: 1, repeat: Infinity }}
                  >
                    <ArrowRight className="w-5 h-5 text-primary" />
                  </motion.div>
                </div>
                
                <span className="px-3 py-1 bg-primary/20 text-primary rounded-full text-sm font-bold">
                  {area.vibe}
                </span>
              </div>
            </motion.div>
          ))}
        </motion.div>

        {/* Explore CTA */}
        <motion.div
          className="mt-12 text-center"
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
        >
          <motion.button
            className="px-8 py-4 bg-primary text-primary-foreground rounded-full font-bold text-lg flex items-center gap-3 mx-auto"
            whileHover={{ scale: 1.05, boxShadow: '0 0 40px hsl(var(--primary) / 0.5)' }}
            whileTap={{ scale: 0.95 }}
          >
            Explore All London Areas
            <motion.div animate={{ x: [0, 5, 0] }} transition={{ duration: 1, repeat: Infinity }}>
              <ArrowRight className="w-5 h-5" />
            </motion.div>
          </motion.button>
        </motion.div>
      </div>
    </section>
  );
};

