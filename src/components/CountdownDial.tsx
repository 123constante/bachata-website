import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';

interface CountdownDialProps {
  targetDate: Date | null;
  eventName: string | null;
}

const CountdownDial = ({ targetDate, eventName }: CountdownDialProps) => {
  const [timeLeft, setTimeLeft] = useState({ days: 0, hours: 0, minutes: 0, seconds: 0 });
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    if (!targetDate) return;

    const calculateTimeLeft = () => {
      const now = new Date();
      const difference = targetDate.getTime() - now.getTime();

      if (difference <= 0) {
        setTimeLeft({ days: 0, hours: 0, minutes: 0, seconds: 0 });
        setProgress(100);
        return;
      }

      const days = Math.floor(difference / (1000 * 60 * 60 * 24));
      const hours = Math.floor((difference % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const minutes = Math.floor((difference % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((difference % (1000 * 60)) / 1000);

      setTimeLeft({ days, hours, minutes, seconds });

      // Calculate progress (0-100) based on seconds within the current minute
      const secondsProgress = ((60 - seconds) / 60) * 100;
      setProgress(secondsProgress);
    };

    calculateTimeLeft();
    const interval = setInterval(calculateTimeLeft, 1000);

    return () => clearInterval(interval);
  }, [targetDate]);

  const hasEvent = targetDate !== null;
  const radius = 70;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (progress / 100) * circumference;

  // Generate tick marks
  const ticks = Array.from({ length: 60 }, (_, i) => {
    const angle = (i / 60) * 360 - 90;
    const isMajor = i % 5 === 0;
    const innerRadius = isMajor ? 58 : 62;
    const outerRadius = 68;
    
    const x1 = 80 + innerRadius * Math.cos((angle * Math.PI) / 180);
    const y1 = 80 + innerRadius * Math.sin((angle * Math.PI) / 180);
    const x2 = 80 + outerRadius * Math.cos((angle * Math.PI) / 180);
    const y2 = 80 + outerRadius * Math.sin((angle * Math.PI) / 180);

    return { x1, y1, x2, y2, isMajor };
  });

  // Needle angle based on seconds (0-60 maps to 0-360 degrees)
  const needleAngle = hasEvent ? (timeLeft.seconds / 60) * 360 - 90 : -90;

  return (
    <div className="flex flex-col items-center">
      <div className="relative w-40 h-40">
        {/* SVG Dial */}
        <svg className="w-full h-full" viewBox="0 0 160 160">
          {/* Outer glow effect */}
          <defs>
            <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="2" result="coloredBlur" />
              <feMerge>
                <feMergeNode in="coloredBlur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
            <linearGradient id="progressGradient" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="hsl(var(--primary))" />
              <stop offset="100%" stopColor="hsl(var(--primary) / 0.6)" />
            </linearGradient>
          </defs>

          {/* Background circle */}
          <circle
            cx="80"
            cy="80"
            r={radius}
            fill="none"
            stroke="hsl(var(--muted))"
            strokeWidth="4"
            opacity="0.3"
          />

          {/* Progress arc */}
          {hasEvent && (
            <motion.circle
              cx="80"
              cy="80"
              r={radius}
              fill="none"
              stroke="url(#progressGradient)"
              strokeWidth="4"
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={strokeDashoffset}
              transform="rotate(-90 80 80)"
              filter="url(#glow)"
              initial={{ strokeDashoffset: circumference }}
              animate={{ strokeDashoffset }}
              transition={{ duration: 0.5, ease: "easeOut" }}
            />
          )}

          {/* Tick marks */}
          {ticks.map((tick, i) => (
            <line
              key={i}
              x1={tick.x1}
              y1={tick.y1}
              x2={tick.x2}
              y2={tick.y2}
              stroke={tick.isMajor ? "hsl(var(--foreground) / 0.5)" : "hsl(var(--foreground) / 0.2)"}
              strokeWidth={tick.isMajor ? 1.5 : 0.75}
            />
          ))}

          {/* Center circle */}
          <circle
            cx="80"
            cy="80"
            r="45"
            fill="hsl(var(--card))"
            stroke="hsl(var(--border))"
            strokeWidth="1"
          />

          {/* Needle */}
          {hasEvent && (
            <motion.g
              initial={{ rotate: -90 }}
              animate={{ rotate: needleAngle }}
              transition={{ duration: 0.3, ease: "easeOut" }}
              style={{ transformOrigin: "80px 80px" }}
            >
              <line
                x1="80"
                y1="80"
                x2="80"
                y2="35"
                stroke="hsl(var(--destructive))"
                strokeWidth="2"
                strokeLinecap="round"
              />
              <circle
                cx="80"
                cy="80"
                r="4"
                fill="hsl(var(--destructive))"
              />
            </motion.g>
          )}
        </svg>

        {/* Center content */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          {hasEvent ? (
            <div className="text-center">
              <div className="font-mono text-lg font-bold text-foreground tracking-tight">
                {timeLeft.days > 0 && <span>{timeLeft.days}d </span>}
                <span>{String(timeLeft.hours).padStart(2, '0')}</span>
                <span className="text-muted-foreground">:</span>
                <span>{String(timeLeft.minutes).padStart(2, '0')}</span>
                <span className="text-muted-foreground">:</span>
                <motion.span
                  key={timeLeft.seconds}
                  initial={{ opacity: 0.5, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.15 }}
                >
                  {String(timeLeft.seconds).padStart(2, '0')}
                </motion.span>
              </div>
            </div>
          ) : (
            <div className="text-center px-2">
              <span className="text-xs text-muted-foreground">No Events</span>
            </div>
          )}
        </div>
      </div>

      {/* Event name below dial */}
      {hasEvent && eventName && (
        <motion.p
          className="mt-2 text-xs text-muted-foreground text-center max-w-[140px] truncate"
          initial={{ opacity: 0, y: 5 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          {eventName}
        </motion.p>
      )}
      {!hasEvent && (
        <p className="mt-2 text-xs text-muted-foreground">
          Join an event!
        </p>
      )}
    </div>
  );
};

export default CountdownDial;
