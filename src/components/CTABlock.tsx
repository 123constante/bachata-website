import { motion } from 'framer-motion';
import { ArrowRight, Sparkles, Heart, Zap } from 'lucide-react';
import { ReactNode } from 'react';
import { ConfettiButton } from './ConfettiButton';

interface CTABlockProps {
  variant?: 'primary' | 'secondary' | 'gradient';
  title: string;
  subtitle?: string;
  buttonText: string;
  icon?: ReactNode;
}

export const CTABlock = ({ 
  variant = 'primary', 
  title, 
  subtitle, 
  buttonText,
  icon 
}: CTABlockProps) => {
  const variants = {
    primary: 'bg-gradient-to-r from-primary/20 via-primary/10 to-primary/20',
    secondary: 'bg-gradient-to-r from-festival-pink/20 via-festival-purple/10 to-festival-pink/20',
    gradient: 'bg-gradient-to-r from-primary/20 via-festival-pink/20 to-festival-purple/20',
  };

  return (
    <motion.section
      className={`py-16 px-4 relative overflow-hidden ${variants[variant]}`}
      initial={{ opacity: 0 }}
      whileInView={{ opacity: 1 }}
      viewport={{ once: true }}
    >
      {/* Animated background elements */}
      {[...Array(5)].map((_, i) => (
        <motion.div
          key={i}
          className="absolute"
          style={{
            left: `${20 + i * 15}%`,
            top: '50%',
          }}
          animate={{
            y: ['-50%', '-60%', '-50%'],
            opacity: [0.2, 0.5, 0.2],
            rotate: [0, 180, 360],
          }}
          transition={{
            duration: 4 + i,
            repeat: Infinity,
            delay: i * 0.5,
          }}
        >
          {i % 3 === 0 ? (
            <Sparkles className="w-6 h-6 text-primary/30" />
          ) : i % 3 === 1 ? (
            <Heart className="w-5 h-5 text-festival-pink/30" />
          ) : (
            <Zap className="w-5 h-5 text-festival-purple/30" />
          )}
        </motion.div>
      ))}

      <div className="max-w-4xl mx-auto text-center relative z-10">
        <motion.h3
          className="text-3xl md:text-5xl font-black mb-4"
          initial={{ y: 30, opacity: 0 }}
          whileInView={{ y: 0, opacity: 1 }}
          viewport={{ once: true }}
        >
          {title}
        </motion.h3>
        
        {subtitle && (
          <motion.p
            className="text-muted-foreground text-lg mb-8"
            initial={{ y: 20, opacity: 0 }}
            whileInView={{ y: 0, opacity: 1 }}
            viewport={{ once: true }}
            transition={{ delay: 0.2 }}
          >
            {subtitle}
          </motion.p>
        )}

        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          whileInView={{ scale: 1, opacity: 1 }}
          viewport={{ once: true }}
          transition={{ delay: 0.4 }}
        >
          <ConfettiButton variant="primary">
            {icon}
            {buttonText}
            <motion.span
              animate={{ x: [0, 5, 0] }}
              transition={{ duration: 1, repeat: Infinity }}
            >
              <ArrowRight className="w-5 h-5" />
            </motion.span>
          </ConfettiButton>
        </motion.div>
      </div>
    </motion.section>
  );
};
