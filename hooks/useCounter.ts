'use client';

import { useEffect, useState, useRef } from 'react';

interface UseCounterOptions {
  duration?: number;
  triggerOnView?: boolean;
  start?: number;
}

export function useCounter(
  target: number,
  options: UseCounterOptions = {}
) {
  const {
    duration = 2000,
    triggerOnView = true,
    start = 0,
  } = options;

  const [count, setCount] = useState(start);
  const [hasStarted, setHasStarted] = useState(!triggerOnView);
  const countRef = useRef(start);
  const animationFrameRef = useRef<number>();

  useEffect(() => {
    if (!hasStarted && triggerOnView) {
      // Use Intersection Observer to trigger when in view
      const observer = new IntersectionObserver(
        ([entry]) => {
          if (entry.isIntersecting) {
            setHasStarted(true);
            observer.disconnect();
          }
        },
        { threshold: 0.3 }
      );

      const element = document.getElementById('counter-trigger');
      if (element) {
        observer.observe(element);
      }

      return () => {
        observer.disconnect();
      };
    } else if (!triggerOnView) {
      setHasStarted(true);
    }
  }, [hasStarted, triggerOnView]);

  useEffect(() => {
    if (!hasStarted) return;

    const startTime = Date.now();
    const startValue = countRef.current;

    const animate = () => {
      const now = Date.now();
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);

      // Easing function (ease-out-expo)
      const easeOutExpo = progress === 1
        ? 1
        : 1 - Math.pow(2, -10 * progress);

      const current = Math.floor(startValue + (target - startValue) * easeOutExpo);
      countRef.current = current;
      setCount(current);

      if (progress < 1) {
        animationFrameRef.current = requestAnimationFrame(animate);
      }
    };

    animationFrameRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [hasStarted, target, duration]);

  const formatNumber = (num: number): string => {
    if (num >= 1000000) {
      return (num / 1000000).toFixed(1) + 'M+';
    }
    if (num >= 1000) {
      return (num / 1000).toFixed(1) + 'K+';
    }
    return num.toLocaleString();
  };

  return { count, formatted: formatNumber(count) };
}
