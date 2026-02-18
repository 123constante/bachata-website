import { motion } from 'framer-motion';
import { MapPin, Clock, Calendar, Flame, Zap, ArrowRight, Sparkles } from 'lucide-react';

export const TodayInLondon = () => {
  return (
    <section className="py-24 px-4 relative overflow-hidden">
      {/* Pulsing background */}
      <motion.div 
        className="absolute inset-0 bg-gradient-to-r from-primary/10 via-transparent to-festival-pink/10"
        animate={{ opacity: [0.5, 0.8, 0.5] }}
        transition={{ duration: 4, repeat: Infinity }}
      />

      <div className="max-w-4xl mx-auto relative z-10">
        {/* Header */}
        <motion.div 
          className="text-center mb-12"
          initial={{ opacity: 0, y: -30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
        >
          <motion.div 
            className="inline-flex items-center gap-3 mb-6"
            animate={{ x: [0, 5, 0] }}
            transition={{ duration: 2, repeat: Infinity }}
          >
            <motion.div
              className="w-3 h-3 bg-red-500 rounded-full"
              animate={{ scale: [1, 1.5, 1], opacity: [1, 0.5, 1] }}
              transition={{ duration: 1, repeat: Infinity }}
            />
            <span className="text-red-500 font-bold uppercase tracking-wider">Live Now</span>
          </motion.div>
          
          <h2 className="text-4xl md:text-6xl font-black mb-4">
            What's <span className="gradient-text">Happening</span>
          </h2>
          <p className="text-muted-foreground text-xl flex items-center justify-center gap-2">
            <MapPin className="w-5 h-5 text-primary" />
            Today in London
          </p>
        </motion.div>

        {/* Big Calendar CTA Card */}
        <motion.div
          className="relative group cursor-pointer"
          initial={{ opacity: 0, scale: 0.9 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
          whileHover={{ scale: 1.02 }}
        >
          <motion.div
            className="p-8 md:p-12 bg-surface/80 backdrop-blur-sm rounded-3xl border border-primary/20 text-center relative overflow-hidden"
            whileHover={{ 
              borderColor: 'hsl(var(--primary))',
              boxShadow: '0 0 60px hsl(var(--primary) / 0.3)'
            }}
          >
            {/* Animated background gradient */}
            <motion.div
              className="absolute inset-0 bg-gradient-to-br from-primary/10 via-transparent to-festival-pink/10"
              animate={{ 
                backgroundPosition: ['0% 0%', '100% 100%', '0% 0%'],
              }}
              transition={{ duration: 10, repeat: Infinity }}
              style={{ backgroundSize: '200% 200%' }}
            />

            {/* Floating icons */}
            {[Sparkles, Flame, Zap].map((Icon, i) => (
              <motion.div
                key={i}
                className="absolute text-primary/20"
                style={{
                  left: `${20 + i * 30}%`,
                  top: `${15 + (i % 2) * 60}%`,
                }}
                animate={{
                  y: [0, -15, 0],
                  rotate: [0, 10, -10, 0],
                }}
                transition={{
                  duration: 3 + i,
                  repeat: Infinity,
                  delay: i * 0.5,
                }}
              >
                <Icon size={24 + i * 8} />
              </motion.div>
            ))}

            <div className="relative z-10">
              {/* Calendar Icon */}
              <motion.div
                className="inline-flex p-6 bg-primary/20 rounded-3xl mb-6"
                animate={{ 
                  boxShadow: [
                    '0 0 20px hsl(var(--primary) / 0.3)',
                    '0 0 40px hsl(var(--primary) / 0.5)',
                    '0 0 20px hsl(var(--primary) / 0.3)',
                  ],
                  rotate: [0, 3, -3, 0]
                }}
                transition={{ duration: 3, repeat: Infinity }}
              >
                <Calendar className="w-16 h-16 text-primary" />
              </motion.div>

              <h3 className="text-3xl md:text-4xl font-black mb-4">
                See What's On <span className="gradient-text">Tonight</span>
              </h3>
              
              <p className="text-muted-foreground text-lg mb-8 max-w-md mx-auto">
                Classes, socials, and parties happening right now across London
              </p>

              {/* Live indicator pills */}
              <div className="flex flex-wrap justify-center gap-3 mb-8">
                {['4 Classes Live', '2 Socials Now', '3 Starting Soon'].map((text, i) => (
                  <motion.span
                    key={i}
                    className="px-4 py-2 bg-primary/20 rounded-full text-sm font-bold flex items-center gap-2"
                    animate={{ scale: [1, 1.05, 1] }}
                    transition={{ duration: 2, repeat: Infinity, delay: i * 0.3 }}
                  >
                    <motion.div
                      className={`w-2 h-2 rounded-full ${i === 0 || i === 1 ? 'bg-red-500' : 'bg-green-500'}`}
                      animate={{ opacity: [1, 0.5, 1] }}
                      transition={{ duration: 1, repeat: Infinity }}
                    />
                    {text}
                  </motion.span>
                ))}
              </div>

              {/* Main CTA Button */}
              <motion.button
                className="px-10 py-5 bg-primary text-primary-foreground rounded-full font-bold text-xl flex items-center gap-3 mx-auto group"
                whileHover={{ scale: 1.05, boxShadow: '0 0 50px hsl(var(--primary) / 0.6)' }}
                whileTap={{ scale: 0.95 }}
              >
                <Calendar className="w-6 h-6" />
                Open the Calendar
                <motion.div
                  animate={{ x: [0, 5, 0] }}
                  transition={{ duration: 1, repeat: Infinity }}
                >
                  <ArrowRight className="w-6 h-6" />
                </motion.div>
              </motion.button>
            </div>
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
};
