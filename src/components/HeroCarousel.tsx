import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, ChevronRight, Sparkles, Music, Users, MapPin } from 'lucide-react';

const heroSlides = [
  {
    id: 1,
    title: "Feel the Rhythm",
    subtitle: "Barcelona Bachata Festival",
    gradient: "from-primary via-festival-pink to-festival-purple",
    icon: Music,
    stats: "2,500+ Dancers",
  },
  {
    id: 2,
    title: "Dance Together",
    subtitle: "Global Community Events",
    gradient: "from-festival-purple via-primary to-festival-blue",
    icon: Users,
    stats: "50+ Countries",
  },
  {
    id: 3,
    title: "Discover Magic",
    subtitle: "World Class Instructors",
    gradient: "from-festival-blue via-festival-pink to-primary",
    icon: Sparkles,
    stats: "100+ Teachers",
  },
  {
    id: 4,
    title: "Explore Places",
    subtitle: "Festivals Worldwide",
    gradient: "from-primary via-festival-purple to-festival-pink",
    icon: MapPin,
    stats: "200+ Events",
  },
];

export const HeroCarousel = () => {
  const [current, setCurrent] = useState(0);
  const [direction, setDirection] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setDirection(1);
      setCurrent((prev) => (prev + 1) % heroSlides.length);
    }, 5000);
    return () => clearInterval(timer);
  }, []);

  const slideVariants = {
    enter: (direction: number) => ({
      x: direction > 0 ? '100%' : '-100%',
      opacity: 0,
      scale: 1.1,
    }),
    center: {
      x: 0,
      opacity: 1,
      scale: 1,
      transition: {
        x: { type: 'spring' as const, stiffness: 50, damping: 20 },
        opacity: { duration: 0.5 },
        scale: { duration: 1.5, ease: 'easeOut' as const },
      },
    },
    exit: (direction: number) => ({
      x: direction < 0 ? '100%' : '-100%',
      opacity: 0,
      scale: 0.9,
    }),
  };

  const next = () => {
    setDirection(1);
    setCurrent((prev) => (prev + 1) % heroSlides.length);
  };

  const prev = () => {
    setDirection(-1);
    setCurrent((prev) => (prev - 1 + heroSlides.length) % heroSlides.length);
  };

  const slide = heroSlides[current];
  const Icon = slide.icon;

  return (
    <div className="relative w-full h-[80vh] min-h-[600px] overflow-hidden">
      {/* Background Gradient Slides */}
      <AnimatePresence initial={false} custom={direction} mode="wait">
        <motion.div
          key={slide.id}
          custom={direction}
          variants={slideVariants}
          initial="enter"
          animate="center"
          exit="exit"
          className={`absolute inset-0 bg-gradient-to-br ${slide.gradient}`}
          style={{ 
            backgroundSize: '400% 400%',
            animation: 'gradient-shift 8s ease infinite',
          }}
        />
      </AnimatePresence>

      {/* Parallax Floating Elements */}
      <motion.div 
        className="absolute inset-0 overflow-hidden"
        style={{ y: 0 }}
      >
        {[...Array(20)].map((_, i) => (
          <motion.div
            key={i}
            className="absolute rounded-full bg-white/10"
            style={{
              width: Math.random() * 100 + 20,
              height: Math.random() * 100 + 20,
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
            }}
            animate={{
              y: [0, -30, 0],
              x: [0, Math.random() * 20 - 10, 0],
              scale: [1, 1.1, 1],
            }}
            transition={{
              duration: 4 + Math.random() * 4,
              repeat: Infinity,
              delay: Math.random() * 2,
              ease: 'easeInOut',
            }}
          />
        ))}
      </motion.div>

      {/* Content */}
      <div className="relative z-10 h-full flex flex-col items-center justify-center text-center px-4">
        <AnimatePresence mode="wait">
          <motion.div
            key={slide.id}
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -50 }}
            transition={{ duration: 0.5, ease: 'easeOut' }}
            className="space-y-6"
          >
            {/* Icon */}
            <motion.div
              animate={{ 
                rotate: [0, 10, -10, 0],
                scale: [1, 1.1, 1],
              }}
              transition={{ duration: 2, repeat: Infinity }}
              className="inline-flex p-6 rounded-full bg-white/20 backdrop-blur-sm"
            >
              <Icon className="w-16 h-16 text-white" />
            </motion.div>

            {/* Subtitle */}
            <motion.p
              initial={{ opacity: 0, letterSpacing: '0.5em' }}
              animate={{ opacity: 1, letterSpacing: '0.2em' }}
              transition={{ delay: 0.2, duration: 0.8 }}
              className="text-white/80 uppercase tracking-widest text-sm md:text-base"
            >
              {slide.subtitle}
            </motion.p>

            {/* Main Title */}
            <motion.h1
              className="text-6xl md:text-8xl lg:text-9xl font-black text-white"
              style={{
                textShadow: '0 0 60px rgba(255,255,255,0.5), 0 0 120px rgba(255,149,0,0.3)',
              }}
            >
              {slide.title.split('').map((char, i) => (
                <motion.span
                  key={i}
                  initial={{ opacity: 0, y: 50 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 + i * 0.05 }}
                  className="inline-block"
                >
                  {char === ' ' ? '\u00A0' : char}
                </motion.span>
              ))}
            </motion.h1>

            {/* Stats Badge */}
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.8, type: 'spring', stiffness: 200 }}
              className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-black/30 backdrop-blur-md border border-white/20"
            >
              <Sparkles className="w-5 h-5 text-primary animate-pulse" />
              <span className="text-white font-bold text-lg">{slide.stats}</span>
            </motion.div>
          </motion.div>
        </AnimatePresence>

        {/* Navigation Arrows */}
        <div className="absolute bottom-20 left-0 right-0 flex justify-center gap-4">
          <motion.button
            onClick={prev}
            className="p-3 rounded-full bg-white/10 backdrop-blur-sm border border-white/20 text-white hover:bg-white/20 transition-colors"
            whileHover={{ scale: 1.1, x: -5 }}
            whileTap={{ scale: 0.9 }}
          >
            <ChevronLeft className="w-6 h-6" />
          </motion.button>
          <motion.button
            onClick={next}
            className="p-3 rounded-full bg-white/10 backdrop-blur-sm border border-white/20 text-white hover:bg-white/20 transition-colors"
            whileHover={{ scale: 1.1, x: 5 }}
            whileTap={{ scale: 0.9 }}
          >
            <ChevronRight className="w-6 h-6" />
          </motion.button>
        </div>

        {/* Slide Indicators */}
        <div className="absolute bottom-8 left-0 right-0 flex justify-center gap-3">
          {heroSlides.map((_, index) => (
            <motion.button
              key={index}
              onClick={() => {
                setDirection(index > current ? 1 : -1);
                setCurrent(index);
              }}
              className={`h-2 rounded-full transition-all ${
                index === current ? 'w-8 bg-white' : 'w-2 bg-white/40'
              }`}
              whileHover={{ scale: 1.2 }}
              whileTap={{ scale: 0.9 }}
            />
          ))}
        </div>
      </div>

      {/* Bottom Gradient Fade */}
      <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-background to-transparent" />
    </div>
  );
};
