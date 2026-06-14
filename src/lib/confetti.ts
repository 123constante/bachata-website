// Confetti is purely decorative. Its chunk is loaded with a plain dynamic
// import() (NOT safeDynamicImport): a failed load should silently no-op, never
// trigger the stale-chunk full-page reload — losing in-progress form state for a
// cosmetic effect would be disproportionate (code-review finding).
export const triggerGlobalConfetti = () => {
    import('canvas-confetti').then(mod => {
        const confetti = mod.default;
        const duration = 3 * 1000;
        const animationEnd = Date.now() + duration;
        const defaults = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 0 };

        const randomInRange = (min: number, max: number) => {
          return Math.random() * (max - min) + min;
        }

        const interval: any = setInterval(function() {
          const timeLeft = animationEnd - Date.now();

          if (timeLeft <= 0) {
            return clearInterval(interval);
          }

          const particleCount = 50 * (timeLeft / duration);
          // since particles fall down, start a bit higher than random
          confetti({ ...defaults, particleCount, origin: { x: randomInRange(0.1, 0.3), y: Math.random() - 0.2 } });
          confetti({ ...defaults, particleCount, origin: { x: randomInRange(0.7, 0.9), y: Math.random() - 0.2 } });
        }, 250);
    });
};

export type MicroConfettiOptions = {
    particleCount?: number;
    colors?: string[];
    spread?: number;
    ticks?: number;
    scalar?: number;
};

export const triggerMicroConfetti = (
    x: number,
    y: number,
    options?: MicroConfettiOptions,
) => {
    import('canvas-confetti').then(mod => {
        const confetti = mod.default;
        // Normalize coordinates to 0-1 range for canvas-confetti
        const xNorm = x / window.innerWidth;
        const yNorm = y / window.innerHeight;

        confetti({
            particleCount: options?.particleCount ?? 30,
            spread: options?.spread ?? 50,
            origin: { x: xNorm, y: yNorm },
            colors: options?.colors ?? ['#3b82f6', '#8b5cf6', '#ec4899'],
            ticks: options?.ticks ?? 60,
            scalar: options?.scalar ?? 1,
            disableForReducedMotion: true,
            zIndex: 9999,
        });
    });
};
