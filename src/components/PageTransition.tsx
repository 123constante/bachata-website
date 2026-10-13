import { motion } from 'framer-motion';
import { ReactNode } from 'react';

interface PageTransitionProps {
  children: ReactNode;
}

const pageVariants = {
  initial: {
    opacity: 0,
    x: 30,
    filter: 'blur(4px)',
  },
  in: {
    opacity: 1,
    x: 0,
    filter: 'blur(0px)',
  },
  out: {
    opacity: 0,
    x: -30,
    filter: 'blur(4px)',
  },
};

const pageTransition = {
  type: 'tween' as const,
  ease: 'easeInOut' as const,
  duration: 0.25,
};

export const PageTransition = ({ children }: PageTransitionProps) => {
  return (
    <motion.div
      initial="initial"
      animate="in"
      exit="out"
      variants={pageVariants}
      transition={pageTransition}
      // .route-shell (index.css), the same box as the plain wrapper in
      // app/InitialVisiblePageTransition.tsx: the screen between header and nav.
      className="route-shell"
    >
      {children}
    </motion.div>
  );
};
