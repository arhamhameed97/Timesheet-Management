'use client';

import { motion } from 'framer-motion';
import { Card, CardContent } from '@/components/ui/card';
import { CheckCircle2, Shield, Zap, TrendingUp, Users, Clock } from 'lucide-react';
import { ScrollReveal } from './ScrollReveal';

const valuePoints = [
  {
    icon: Shield,
    title: 'Seamless Integration',
    description: 'Integrate with existing workflows and tools. Our API makes it easy to connect with your favorite apps.',
  },
  {
    icon: Users,
    title: 'Role-Based Access Control',
    description: 'Enterprise-grade security with granular permissions. Control who sees what with our comprehensive RBAC system.',
  },
  {
    icon: Zap,
    title: 'Real-Time Tracking',
    description: 'Get instant updates on attendance, timesheets, and team progress. Make data-driven decisions with live analytics.',
  },
  {
    icon: TrendingUp,
    title: 'Scalable Solution',
    description: 'From startup to enterprise, scale effortlessly. Our platform grows with your business needs.',
  },
  {
    icon: Clock,
    title: 'Automated Payroll',
    description: 'Save hours every week with automated payroll processing. Calculate salaries, allowances, and deductions automatically.',
  },
  {
    icon: CheckCircle2,
    title: 'Team Collaboration',
    description: 'Foster collaboration with team management tools. Track progress, assign tasks, and keep everyone aligned.',
  },
];

export function ValueProposition() {
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
            The Cornerstone of{' '}
            <span className="bg-gradient-to-r from-primary to-primary-medium bg-clip-text text-transparent">
              Modern Workforce Management
            </span>
          </motion.h2>
          <motion.p
            variants={{
              hidden: { opacity: 0, y: 20 },
              visible: { opacity: 1, y: 0 },
            }}
            transition={{ delay: 0.1 }}
            className="text-lg text-muted-foreground max-w-3xl mx-auto"
          >
            Built to be the foundation of your workforce operations. Every feature designed to integrate seamlessly and scale effortlessly.
          </motion.p>
        </ScrollReveal>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {valuePoints.map((point, index) => {
            const Icon = point.icon;
            return (
              <ScrollReveal
                key={point.title}
                direction="up"
                delay={index * 0.1}
                className="h-full"
              >
                <motion.div
                  whileHover={{ y: -8, scale: 1.02 }}
                  transition={{ duration: 0.3 }}
                  className="h-full"
                >
                  <Card className="h-full border-2 hover:border-primary/50 transition-all duration-300 hover:shadow-lg backdrop-blur-sm bg-background/50">
                    <CardContent className="p-6">
                      <div className="flex items-start space-x-4">
                        <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-primary/10 to-primary-medium/10 flex items-center justify-center flex-shrink-0">
                          <Icon className="h-6 w-6 text-primary" />
                        </div>
                        <div>
                          <h3 className="font-semibold text-lg mb-2">{point.title}</h3>
                          <p className="text-muted-foreground text-sm">{point.description}</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              </ScrollReveal>
            );
          })}
        </div>
      </div>
    </section>
  );
}
