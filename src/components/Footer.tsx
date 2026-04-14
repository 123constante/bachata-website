import { motion } from "framer-motion";

const Footer = () => {
  return (
    <footer className="mt-24 py-10 px-4 border-t border-primary/20 relative overflow-hidden">
      <motion.div 
        className="absolute inset-0 bg-gradient-to-t from-primary/5 to-transparent"
        animate={{ opacity: [0.5, 0.8, 0.5] }}
        transition={{ duration: 4, repeat: Infinity }}
      />
      <div className="max-w-6xl mx-auto relative z-10">
        <div className="text-center">
          <p className="text-muted-foreground text-sm">
            &copy; 2024 Bachata Calendar. Made with{' '}
            <motion.span
              className="inline-block text-primary"
              animate={{ scale: [1, 1.3, 1] }}
              transition={{ duration: 1, repeat: Infinity }}
            >
              &hearts;
            </motion.span>
            {' '}in London
          </p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;