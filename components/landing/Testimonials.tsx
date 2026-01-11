'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Card, CardContent } from '@/components/ui/card';
import { Star, ChevronLeft, ChevronRight } from 'lucide-react';
import { ScrollReveal } from './ScrollReveal';

const testimonials = [
  {
    id: 1,
    name: 'Sarah Johnson',
    role: 'HR Director',
    company: 'TechCorp Inc.',
    image: 'SJ',
    rating: 5,
    text: 'PunchIn has revolutionized how we manage our workforce. The automated payroll processing alone saves us 20 hours per week.',
  },
  {
    id: 2,
    name: 'Michael Chen',
    role: 'Operations Manager',
    company: 'StartupXYZ',
    image: 'MC',
    rating: 5,
    text: 'The team collaboration features are outstanding. We can track progress, manage timesheets, and process payroll all in one platform.',
  },
  {
    id: 3,
    name: 'Emily Rodriguez',
    role: 'CEO',
    company: 'GrowthLabs',
    image: 'ER',
    rating: 5,
    text: 'As a growing company, we needed a scalable solution. PunchIn has been the cornerstone of our workforce management.',
  },
  {
    id: 4,
    name: 'David Kim',
    role: 'Finance Manager',
    company: 'Enterprise Solutions',
    image: 'DK',
    rating: 5,
    text: 'The reporting and analytics features provide insights we never had before. It\'s transformed how we make decisions.',
  },
];

export function Testimonials() {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isAutoPlaying, setIsAutoPlaying] = useState(true);

  useEffect(() => {
    if (!isAutoPlaying) return;

    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % testimonials.length);
    }, 6000);

    return () => clearInterval(interval);
  }, [isAutoPlaying]);

  const nextTestimonial = () => {
    setCurrentIndex((prev) => (prev + 1) % testimonials.length);
    setIsAutoPlaying(false);
  };

  const prevTestimonial = () => {
    setCurrentIndex((prev) => (prev - 1 + testimonials.length) % testimonials.length);
    setIsAutoPlaying(false);
  };

  const currentTestimonial = testimonials[currentIndex];

  return (
    <section className="py-24 bg-background relative">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <ScrollReveal direction="up" className="text-center mb-16">
          <motion.h2
            variants={{
              hidden: { opacity: 0, y: 20 },
              visible: { opacity: 1, y: 0 },
            }}
            className="text-3xl sm:text-4xl md:text-5xl font-bold mb-4"
          >
            What Our Customers Say
          </motion.h2>
          <motion.p
            variants={{
              hidden: { opacity: 0, y: 20 },
              visible: { opacity: 1, y: 0 },
            }}
            transition={{ delay: 0.1 }}
            className="text-lg text-muted-foreground max-w-2xl mx-auto"
          >
            Join thousands of companies that trust PunchIn for their workforce management.
          </motion.p>
        </ScrollReveal>

        <div className="max-w-4xl mx-auto">
          <div
            className="relative"
            onMouseEnter={() => setIsAutoPlaying(false)}
            onMouseLeave={() => setIsAutoPlaying(true)}
          >
            <AnimatePresence mode="wait">
              <motion.div
                key={currentTestimonial.id}
                initial={{ opacity: 0, x: 50 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -50 }}
                transition={{ duration: 0.5 }}
              >
                <Card className="border-2 hover:border-primary/50 transition-all duration-300 hover:shadow-lg backdrop-blur-sm bg-background/50">
                  <CardContent className="p-8 md:p-12">
                    <div className="flex items-center justify-center mb-6">
                      {[...Array(currentTestimonial.rating)].map((_, i) => (
                        <Star
                          key={i}
                          className="h-5 w-5 fill-primary text-primary"
                        />
                      ))}
                    </div>
                    <p className="text-lg md:text-xl text-foreground mb-8 italic text-center">
                      &ldquo;{currentTestimonial.text}&rdquo;
                    </p>
                    <div className="flex items-center justify-center space-x-4">
                      <div className="w-16 h-16 rounded-full bg-gradient-to-br from-primary to-primary-medium flex items-center justify-center text-white font-bold text-xl">
                        {currentTestimonial.image}
                      </div>
                      <div>
                        <p className="font-semibold text-foreground">
                          {currentTestimonial.name}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {currentTestimonial.role} at {currentTestimonial.company}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            </AnimatePresence>

            {/* Navigation arrows */}
            <button
              onClick={prevTestimonial}
              className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-4 md:-translate-x-12 p-2 rounded-full bg-background border-2 border-border hover:border-primary transition-colors shadow-lg"
              aria-label="Previous testimonial"
            >
              <ChevronLeft className="h-6 w-6" />
            </button>
            <button
              onClick={nextTestimonial}
              className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-4 md:translate-x-12 p-2 rounded-full bg-background border-2 border-border hover:border-primary transition-colors shadow-lg"
              aria-label="Next testimonial"
            >
              <ChevronRight className="h-6 w-6" />
            </button>
          </div>

          {/* Dot indicators */}
          <div className="flex items-center justify-center space-x-2 mt-8">
            {testimonials.map((_, index) => (
              <button
                key={index}
                onClick={() => {
                  setCurrentIndex(index);
                  setIsAutoPlaying(false);
                }}
                className={`w-2 h-2 rounded-full transition-all duration-300 ${
                  index === currentIndex
                    ? 'bg-primary w-8'
                    : 'bg-muted-foreground/30 hover:bg-muted-foreground/50'
                }`}
                aria-label={`Go to testimonial ${index + 1}`}
              />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
