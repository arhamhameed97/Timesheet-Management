'use client';

import { useParallax } from '@/hooks/useParallax';

export function AnimatedIllustrations() {
  const parallaxSlow = useParallax(0.2);
  const parallaxMedium = useParallax(0.4);
  const parallaxFast = useParallax(0.6);

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {/* Floating orbs */}
      <div
        className="absolute w-96 h-96 rounded-full bg-gradient-to-br from-primary/20 to-primary-light/20 blur-3xl animate-float"
        style={{
          top: '10%',
          left: '10%',
          transform: `translateY(${parallaxSlow}px)`,
        }}
      />
      <div
        className="absolute w-72 h-72 rounded-full bg-gradient-to-br from-primary-medium/20 to-primary/20 blur-3xl animate-float"
        style={{
          top: '60%',
          right: '15%',
          transform: `translateY(${parallaxMedium}px)`,
          animationDelay: '1s',
        }}
      />
      <div
        className="absolute w-64 h-64 rounded-full bg-gradient-to-br from-primary-light/20 to-primary-medium/20 blur-3xl animate-float"
        style={{
          bottom: '20%',
          left: '50%',
          transform: `translateY(${parallaxFast}px)`,
          animationDelay: '2s',
        }}
      />

      {/* Geometric shapes */}
      <div
        className="absolute w-32 h-32 border-2 border-primary/30 rotate-45 animate-float"
        style={{
          top: '20%',
          right: '20%',
          transform: `translateY(${parallaxSlow}px) rotate(45deg)`,
          animationDuration: '4s',
        }}
      />
      <div
        className="absolute w-24 h-24 bg-primary/10 rounded-full animate-float"
        style={{
          top: '50%',
          left: '20%',
          transform: `translateY(${parallaxMedium}px)`,
          animationDuration: '5s',
        }}
      />
      <div
        className="absolute w-16 h-16 border-2 border-primary-medium/30 rotate-12 animate-float"
        style={{
          bottom: '30%',
          right: '30%',
          transform: `translateY(${parallaxFast}px) rotate(12deg)`,
          animationDuration: '3s',
        }}
      />

      {/* Grid pattern */}
      <div
        className="absolute inset-0 opacity-5"
        style={{
          backgroundImage: `
            linear-gradient(to right, rgba(107, 70, 193, 0.1) 1px, transparent 1px),
            linear-gradient(to bottom, rgba(107, 70, 193, 0.1) 1px, transparent 1px)
          `,
          backgroundSize: '50px 50px',
          transform: `translateY(${parallaxSlow * 0.5}px)`,
        }}
      />
    </div>
  );
}
