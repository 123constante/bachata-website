import { motion } from 'framer-motion';
import { MapPin, Sparkles } from 'lucide-react';

const hotspots = [
  { x: 45, y: 30, name: 'Camden', size: 'lg', events: 8 },
  { x: 55, y: 45, name: 'Shoreditch', size: 'xl', events: 12 },
  { x: 40, y: 55, name: 'Soho', size: 'xl', events: 15 },
  { x: 30, y: 70, name: 'Brixton', size: 'md', events: 6 },
  { x: 60, y: 65, name: 'Hackney', size: 'lg', events: 9 },
  { x: 25, y: 40, name: 'Kensington', size: 'md', events: 4 },
  { x: 70, y: 35, name: 'Stratford', size: 'sm', events: 3 },
  { x: 50, y: 75, name: 'Peckham', size: 'md', events: 5 },
];

const sizeClasses = {
  sm: 'w-4 h-4',
  md: 'w-6 h-6',
  lg: 'w-8 h-8',
  xl: 'w-10 h-10',
};

export const AbstractMap = () => {
  return (
    <section className="py-24 px-4 relative overflow-hidden">
      <div className="max-w-6xl mx-auto">

        {/* Abstract Map Container */}
        <motion.div
          className="relative aspect-video max-w-4xl mx-auto rounded-3xl overflow-hidden bg-surface/50 border border-primary/20"
          initial={{ opacity: 0, scale: 0.9 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
        >
          {/* Grid lines */}
          <svg className="absolute inset-0 w-full h-full opacity-10">
            {[...Array(10)].map((_, i) => (
              <motion.line
                key={`h-${i}`}
                x1="0"
                y1={`${i * 10}%`}
                x2="100%"
                y2={`${i * 10}%`}
                stroke="hsl(var(--primary))"
                strokeWidth="1"
                initial={{ pathLength: 0 }}
                animate={{ pathLength: 1 }}
                transition={{ delay: i * 0.1, duration: 1 }}
              />
            ))}
            {[...Array(10)].map((_, i) => (
              <motion.line
                key={`v-${i}`}
                x1={`${i * 10}%`}
                y1="0"
                x2={`${i * 10}%`}
                y2="100%"
                stroke="hsl(var(--primary))"
                strokeWidth="1"
                initial={{ pathLength: 0 }}
                animate={{ pathLength: 1 }}
                transition={{ delay: i * 0.1, duration: 1 }}
              />
            ))}
          </svg>

          {/* Abstract river (Thames) */}
          <motion.div
            className="absolute h-3 bg-gradient-to-r from-festival-blue/30 via-festival-blue/50 to-festival-blue/30 rounded-full"
            style={{ left: '10%', right: '10%', top: '50%' }}
            animate={{
              opacity: [0.3, 0.6, 0.3],
              scaleY: [1, 1.5, 1],
            }}
            transition={{ duration: 4, repeat: Infinity }}
          />

          {/* Hotspots */}
          {hotspots.map((spot, i) => (
            <motion.div
              key={i}
              className="absolute cursor-pointer group"
              style={{ left: `${spot.x}%`, top: `${spot.y}%` }}
              initial={{ scale: 0, opacity: 0 }}
              whileInView={{ scale: 1, opacity: 1 }}
              viewport={{ once: true }}
              transition={{ delay: 0.5 + i * 0.1, type: 'spring' }}
            >
              {/* Pulse ring */}
              <motion.div
                className={`absolute ${sizeClasses[spot.size as keyof typeof sizeClasses]} rounded-full bg-primary/30 -translate-x-1/2 -translate-y-1/2`}
                animate={{
                  scale: [1, 2, 1],
                  opacity: [0.5, 0, 0.5],
                }}
                transition={{
                  duration: 2 + Math.random(),
                  repeat: Infinity,
                  delay: i * 0.3,
                }}
              />

              {/* Main dot */}
              <motion.div
                className={`${sizeClasses[spot.size as keyof typeof sizeClasses]} rounded-full bg-primary -translate-x-1/2 -translate-y-1/2 flex items-center justify-center`}
                whileHover={{ scale: 1.5 }}
                animate={{
                  boxShadow: [
                    '0 0 10px hsl(var(--primary) / 0.5)',
                    '0 0 30px hsl(var(--primary) / 0.8)',
                    '0 0 10px hsl(var(--primary) / 0.5)',
                  ]
                }}
                transition={{ duration: 2, repeat: Infinity }}
              >
                <MapPin className="w-3 h-3 text-primary-foreground" />
              </motion.div>

              {/* Label on hover */}
              <motion.div
                className="absolute left-1/2 -translate-x-1/2 top-full mt-2 px-3 py-1.5 bg-surface border border-primary/30 rounded-lg whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none z-20"
                initial={{ y: -10 }}
                animate={{ y: 0 }}
              >
                <p className="font-bold text-sm">{spot.name}</p>
                <p className="text-xs text-primary">{spot.events} events</p>
              </motion.div>
            </motion.div>
          ))}

          {/* Floating particles */}
          {[...Array(20)].map((_, i) => (
            <motion.div
              key={`particle-${i}`}
              className="absolute"
              style={{
                left: `${Math.random() * 100}%`,
                top: `${Math.random() * 100}%`,
              }}
              animate={{
                y: [0, -50, 0],
                opacity: [0, 0.8, 0],
              }}
              transition={{
                duration: 3 + Math.random() * 2,
                repeat: Infinity,
                delay: Math.random() * 3,
              }}
            >
              <Sparkles className="w-3 h-3 text-primary/50" />
            </motion.div>
          ))}

          {/* Corner gradients */}
          <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-transparent to-festival-purple/10 pointer-events-none" />
        </motion.div>

        {/* Legend */}
        <motion.div
          className="flex justify-center gap-8 mt-8"
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ delay: 1 }}
        >
          {['Hot', 'Active', 'Growing'].map((label, i) => (
            <div key={i} className="flex items-center gap-2">
              <div className={`w-3 h-3 rounded-full ${
                i === 0 ? 'bg-primary' : i === 1 ? 'bg-festival-pink' : 'bg-festival-purple'
              }`} />
              <span className="text-muted-foreground text-sm">{label}</span>
            </div>
          ))}
        </motion.div>
      </div>
    </section>
  );
};
