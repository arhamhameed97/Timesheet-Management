// Animation utilities and constants

export const ANIMATION_DURATIONS = {
  fast: 200,
  normal: 300,
  slow: 500,
  slower: 800,
} as const;

export const EASING_FUNCTIONS = {
  easeOutExpo: [0.16, 1, 0.3, 1],
  easeInOutCubic: [0.65, 0, 0.35, 1],
  spring: [0.68, -0.55, 0.265, 1.55],
} as const;

export const STAGGER_DELAYS = {
  short: 50,
  medium: 100,
  long: 150,
} as const;

// Animation variants for common use cases
export const fadeInUp = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0 },
};

export const fadeInDown = {
  hidden: { opacity: 0, y: -20 },
  visible: { opacity: 1, y: 0 },
};

export const fadeInLeft = {
  hidden: { opacity: 0, x: -20 },
  visible: { opacity: 1, x: 0 },
};

export const fadeInRight = {
  hidden: { opacity: 0, x: 20 },
  visible: { opacity: 1, x: 0 },
};

export const scaleIn = {
  hidden: { opacity: 0, scale: 0.9 },
  visible: { opacity: 1, scale: 1 },
};

export const rotateIn = {
  hidden: { opacity: 0, rotate: -5 },
  visible: { opacity: 1, rotate: 0 },
};

export const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
    },
  },
};
