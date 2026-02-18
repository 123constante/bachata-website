import { motion } from 'framer-motion';
import { Heart, Users, MessageCircle, Sparkles } from 'lucide-react';

const values = [
  { icon: Heart, text: "Built by dancers, for dancers", emoji: "’ƒ" },
  { icon: Users, text: "Community over everything", emoji: "¤" },
  { icon: MessageCircle, text: "Connect with real people", emoji: "’¬" },
  { icon: Sparkles, text: "Find your dance family", emoji: "¨" },
];

export const WhyWeExist = () => {
  return (
    <section className="py-32 px-4 relative overflow-hidden">
      {/* Moving gradient background */}
      <motion.div
        className="absolute inset-0"
        style={{
          background: 'linear-gradient(135deg, hsl(var(--primary) / 0.1), hsl(var(--festival-purple) / 0.1), hsl(var(--festival-pink) / 0.1))',
          backgroundSize: '400% 400%',
        }}
        animate={{
          backgroundPosition: ['0% 0%', '100% 100%', '0% 0%'],
        }}
        transition={{ duration: 15, repeat: Infinity, ease: 'linear' }}
      />

      <div className="max-w-4xl mx-auto relative z-10">
        {/* Main Message */}
        <motion.div
          className="text-center mb-16"
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
        >
          <motion.p
            className="text-primary font-bold uppercase tracking-widest mb-8 text-lg"
            animate={{ y: [0, -5, 0] }}
            transition={{ duration: 2, repeat: Infinity }}
          >
            Why We're Here
          </motion.p>

          <motion.h2
            className="text-4xl md:text-6xl lg:text-7xl font-black leading-tight mb-8"
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <span className="block mb-2">Bachata is better</span>
            <motion.span 
              className="gradient-text block"
              animate={{ scale: [1, 1.02, 1] }}
              transition={{ duration: 2, repeat: Infinity }}
            >
              together.
            </motion.span>
          </motion.h2>

          <motion.p
            className="text-xl md:text-2xl text-muted-foreground max-w-2xl mx-auto"
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ delay: 0.3 }}
          >
            We built this to bring London's dancers closer. 
            One calendar. One community. Endless connections.
          </motion.p>
        </motion.div>

        {/* Animated divider */}
        <motion.div
          className="w-32 h-1 bg-gradient-to-r from-primary via-festival-pink to-festival-purple mx-auto mb-16 rounded-full"
          initial={{ scaleX: 0 }}
          whileInView={{ scaleX: 1 }}
          viewport={{ once: true }}
          transition={{ delay: 0.5, duration: 0.8 }}
        />

        {/* Values grid */}
        <motion.div
          className="grid grid-cols-1 md:grid-cols-2 gap-6"
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ delay: 0.6 }}
        >
          {values.map((value, i) => (
            <motion.div
              key={i}
              className="flex items-center gap-4 p-6 bg-surface/60 backdrop-blur-sm rounded-2xl border border-primary/10"
              initial={{ opacity: 0, x: i % 2 === 0 ? -50 : 50 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.7 + i * 0.1 }}
              whileHover={{ 
                scale: 1.02,
                borderColor: 'hsl(var(--primary))',
                backgroundColor: 'hsl(var(--surface-hover))'
              }}
            >
              <motion.div
                className="text-4xl"
                animate={{ rotate: [0, 10, -10, 0] }}
                transition={{ duration: 4, repeat: Infinity, delay: i * 0.5 }}
              >
                {value.emoji}
              </motion.div>
              <p className="text-lg font-medium">{value.text}</p>
            </motion.div>
          ))}
        </motion.div>

        {/* Community invite */}
        <motion.div
          className="text-center mt-16"
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 1 }}
        >
          <p className="text-2xl md:text-3xl font-bold text-muted-foreground">
            Ready to be part of something{' '}
            <motion.span
              className="text-primary"
              animate={{ scale: [1, 1.1, 1] }}
              transition={{ duration: 1.5, repeat: Infinity }}
            >
              special?
            </motion.span>
          </p>
        </motion.div>
      </div>
    </section>
  );
};

