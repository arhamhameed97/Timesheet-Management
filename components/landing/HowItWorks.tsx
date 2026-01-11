'use client';

import { motion } from 'framer-motion';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { UserPlus, Users, Rocket, CheckCircle2 } from 'lucide-react';
import { ScrollReveal } from './ScrollReveal';

const steps = [
  {
    number: 1,
    icon: UserPlus,
    title: 'Register Your Company',
    description: 'Quick setup process. Create your company account and admin profile in minutes.',
  },
  {
    number: 2,
    icon: Users,
    title: 'Invite Your Team',
    description: 'Add employees, assign designations, and set up roles. Your team gets instant access.',
  },
  {
    number: 3,
    icon: Rocket,
    title: 'Start Managing',
    description: 'Track time, process payroll, generate reports. Everything you need in one place.',
  },
];

export function HowItWorks() {
  return (
    <section id="how-it-works" className="py-24 bg-muted/30 relative">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <ScrollReveal direction="up" className="text-center mb-16">
          <motion.h2
            variants={{
              hidden: { opacity: 0, y: 20 },
              visible: { opacity: 1, y: 0 },
            }}
            className="text-3xl sm:text-4xl md:text-5xl font-bold mb-4"
          >
            How It Works
          </motion.h2>
          <motion.p
            variants={{
              hidden: { opacity: 0, y: 20 },
              visible: { opacity: 1, y: 0 },
            }}
            transition={{ delay: 0.1 }}
            className="text-lg text-muted-foreground max-w-2xl mx-auto"
          >
            Get started in three simple steps. No complex setup, no lengthy onboarding.
          </motion.p>
        </ScrollReveal>

        <div className="relative max-w-5xl mx-auto">
          {/* Connecting line */}
          <div className="hidden lg:block absolute top-24 left-0 right-0 h-0.5 bg-gradient-to-r from-primary via-primary-medium to-primary-light" />
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 relative">
            {steps.map((step, index) => {
              const Icon = step.icon;
              return (
                <ScrollReveal
                  key={step.number}
                  direction={index === 0 ? 'left' : index === 1 ? 'up' : 'right'}
                  delay={index * 0.2}
                  className="relative"
                >
                  {/* Step number badge */}
                  <motion.div
                    initial={{ scale: 0 }}
                    whileInView={{ scale: 1 }}
                    viewport={{ once: true }}
                    transition={{ delay: index * 0.2, type: 'spring' }}
                    className="absolute -top-4 left-1/2 transform -translate-x-1/2 z-10 w-12 h-12 rounded-full bg-gradient-to-br from-primary to-primary-medium flex items-center justify-center text-white font-bold text-lg shadow-lg"
                  >
                    {step.number}
                  </motion.div>

                  {/* Connector arrow (desktop only) */}
                  {index < steps.length - 1 && (
                    <div className="hidden lg:block absolute top-24 right-0 w-full">
                      <motion.div
                        initial={{ scaleX: 0 }}
                        whileInView={{ scaleX: 1 }}
                        viewport={{ once: true }}
                        transition={{ delay: index * 0.2 + 0.3, duration: 0.5 }}
                        className="h-0.5 bg-gradient-to-r from-primary-medium to-primary-light origin-left"
                      />
                      <motion.div
                        initial={{ opacity: 0, x: -10 }}
                        whileInView={{ opacity: 1, x: 0 }}
                        viewport={{ once: true }}
                        transition={{ delay: index * 0.2 + 0.5 }}
                        className="absolute top-1/2 right-0 transform translate-x-1/2 -translate-y-1/2"
                      >
                        <CheckCircle2 className="h-6 w-6 text-primary-medium" />
                      </motion.div>
                    </div>
                  )}

                  <motion.div
                    whileHover={{ scale: 1.05, y: -8 }}
                    transition={{ duration: 0.3 }}
                    className="pt-8"
                  >
                    <Card className="h-full border-2 hover:border-primary/50 transition-all duration-300 hover:shadow-lg">
                      <CardHeader className="text-center">
                        <motion.div
                          whileHover={{ rotate: 360 }}
                          transition={{ duration: 0.5 }}
                          className="w-16 h-16 mx-auto rounded-full bg-gradient-to-br from-primary/10 to-primary-medium/10 flex items-center justify-center mb-4"
                        >
                          <Icon className="h-8 w-8 text-primary" />
                        </motion.div>
                        <CardTitle className="text-xl mb-2">{step.title}</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <CardDescription className="text-center text-base">
                          {step.description}
                        </CardDescription>
                      </CardContent>
                    </Card>
                  </motion.div>
                </ScrollReveal>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
