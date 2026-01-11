'use client';

import { motion } from 'framer-motion';
import { Card } from '@/components/ui/card';
import { Building2, Users, Clock, TrendingUp, LucideIcon } from 'lucide-react';
import { ScrollReveal } from './ScrollReveal';
import { useCounter } from '@/hooks/useCounter';

interface StatCardProps {
  stat: {
    icon: LucideIcon;
    value: number;
    suffix: string;
    label: string;
    color: string;
    direction: 'left' | 'up' | 'right' | 'down';
  };
  index: number;
}

function StatCard({ stat, index }: StatCardProps) {
  const Icon = stat.icon;
  const { formatted } = useCounter(stat.value, {
    triggerOnView: true,
    duration: 2000,
  });

  return (
    <ScrollReveal
      direction={stat.direction}
      delay={index * 0.1}
      className="h-full"
    >
      <motion.div
        whileHover={{ scale: 1.05, y: -8 }}
        transition={{ duration: 0.3 }}
        className="h-full"
      >
        <Card className="h-full border-2 hover:border-primary/50 transition-all duration-300 hover:shadow-lg backdrop-blur-sm bg-background/50">
          <div className="p-6 text-center">
            <motion.div
              animate={{ rotate: [0, 10, -10, 0] }}
              transition={{ duration: 2, repeat: Infinity, repeatDelay: 3 }}
              className={`w-16 h-16 mx-auto rounded-full bg-gradient-to-br ${stat.color} flex items-center justify-center mb-4 shadow-lg`}
            >
              <Icon className="h-8 w-8 text-white" />
            </motion.div>
            <motion.div
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              viewport={{ once: true }}
              className="text-4xl md:text-5xl font-bold mb-2 bg-gradient-to-r from-primary to-primary-medium bg-clip-text text-transparent"
            >
              {formatted}{stat.suffix}
            </motion.div>
            <p className="text-muted-foreground font-medium">{stat.label}</p>
          </div>
        </Card>
      </motion.div>
    </ScrollReveal>
  );
}

const stats = [
  {
    icon: Building2,
    value: 1000,
    suffix: '+',
    label: 'Companies Trust Us',
    color: 'from-primary to-primary-medium',
    direction: 'left' as const,
  },
  {
    icon: Users,
    value: 50000,
    suffix: '+',
    label: 'Employees Tracked Daily',
    color: 'from-primary-medium to-primary-light',
    direction: 'up' as const,
  },
  {
    icon: Clock,
    value: 1000000,
    suffix: '+',
    label: 'Hours Logged Monthly',
    color: 'from-primary-light to-primary',
    direction: 'right' as const,
  },
  {
    icon: TrendingUp,
    value: 85,
    suffix: '%',
    label: 'Time Saved on Payroll',
    color: 'from-primary to-primary-light',
    direction: 'down' as const,
  },
];

export function Stats() {
  return (
    <section id="counter-trigger" className="py-24 bg-gradient-to-br from-primary/5 via-background to-primary-light/5 relative">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <ScrollReveal direction="up" className="text-center mb-16">
          <motion.h2
            variants={{
              hidden: { opacity: 0, y: 20 },
              visible: { opacity: 1, y: 0 },
            }}
            className="text-3xl sm:text-4xl md:text-5xl font-bold mb-4"
          >
            Trusted by Companies Worldwide
          </motion.h2>
        </ScrollReveal>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {stats.map((stat, index) => (
            <StatCard key={stat.label} stat={stat} index={index} />
          ))}
        </div>
      </div>
    </section>
  );
}
