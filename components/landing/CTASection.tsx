'use client';

import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { ArrowRight, Shield, Zap, Globe } from 'lucide-react';
import { ScrollReveal } from './ScrollReveal';

const trustBadges = [
  { icon: Shield, text: 'SOC 2 Compliant' },
  { icon: Zap, text: '99.9% Uptime' },
  { icon: Globe, text: 'GDPR Ready' },
];

export function CTASection() {
  return (
    <section className="py-24 bg-gradient-to-br from-primary via-primary-medium to-primary-light relative overflow-hidden">
      {/* Animated background */}
      <div className="absolute inset-0 opacity-10">
        <div className="absolute w-96 h-96 rounded-full bg-white blur-3xl top-0 left-0 animate-float" />
        <div className="absolute w-96 h-96 rounded-full bg-white blur-3xl bottom-0 right-0 animate-float" style={{ animationDelay: '1s' }} />
      </div>

      <div className="container mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <ScrollReveal direction="scale" className="text-center">
          <motion.h2
            variants={{
              hidden: { opacity: 0, scale: 0.9 },
              visible: { opacity: 1, scale: 1 },
            }}
            className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold text-white mb-6"
          >
            Ready to Transform Your Workforce Management?
          </motion.h2>
          <motion.p
            variants={{
              hidden: { opacity: 0, y: 20 },
              visible: { opacity: 1, y: 0 },
            }}
            transition={{ delay: 0.1 }}
            className="text-xl text-white/90 mb-8 max-w-2xl mx-auto"
          >
            Join thousands of companies using TimeSheet Pro to streamline their operations and boost productivity.
          </motion.p>

          <motion.div
            variants={{
              hidden: { opacity: 0, y: 20 },
              visible: { opacity: 1, y: 0 },
            }}
            transition={{ delay: 0.2 }}
            className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-12"
          >
            <Button
              onClick={() => (window.location.href = '/register')}
              size="lg"
              className="group bg-white text-primary hover:bg-white/90 shadow-xl hover:shadow-2xl transition-all duration-300 hover:scale-105 px-8 py-6 text-lg font-semibold"
            >
              Start Your Free Trial
              <ArrowRight className="ml-2 h-5 w-5 group-hover:translate-x-1 transition-transform" />
            </Button>
            <Button
              onClick={() => (window.location.href = '/login')}
              size="lg"
              variant="outline"
              className="border-2 border-white text-white hover:bg-white/10 transition-all duration-300 px-8 py-6 text-lg"
            >
              Already have an account? Login
            </Button>
          </motion.div>

          {/* Trust badges */}
          <motion.div
            variants={{
              hidden: { opacity: 0, y: 20 },
              visible: { opacity: 1, y: 0 },
            }}
            transition={{ delay: 0.3 }}
            className="flex flex-wrap items-center justify-center gap-8"
          >
            {trustBadges.map((badge, index) => {
              const Icon = badge.icon;
              return (
                <motion.div
                  key={badge.text}
                  initial={{ opacity: 0, scale: 0 }}
                  whileInView={{ opacity: 1, scale: 1 }}
                  viewport={{ once: true }}
                  transition={{ delay: index * 0.1 }}
                  className="flex items-center space-x-2 text-white/90"
                >
                  <Icon className="h-5 w-5" />
                  <span className="text-sm font-medium">{badge.text}</span>
                </motion.div>
              );
            })}
          </motion.div>
        </ScrollReveal>
      </div>
    </section>
  );
}
