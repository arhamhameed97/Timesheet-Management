'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Check, Sparkles } from 'lucide-react';
import { ScrollReveal } from './ScrollReveal';

const plans = [
  {
    name: 'Starter',
    price: 29,
    description: 'Perfect for small teams',
    features: [
      'Up to 10 employees',
      'Basic timesheet tracking',
      'Attendance management',
      'Basic reporting',
      'Email support',
    ],
    cta: 'Get Started',
    popular: false,
  },
  {
    name: 'Professional',
    price: 79,
    description: 'For growing companies',
    features: [
      'Up to 100 employees',
      'All Starter features',
      'Team collaboration',
      'Advanced reporting & analytics',
      'Payroll processing',
      'Priority support',
    ],
    cta: 'Get Started',
    popular: true,
  },
  {
    name: 'Enterprise',
    price: 'Custom',
    description: 'Custom solutions',
    features: [
      'Unlimited employees',
      'All Professional features',
      'Custom integrations',
      'Dedicated account manager',
      'Custom SLA',
      'On-premise option',
    ],
    cta: 'Contact Sales',
    popular: false,
  },
];

export function Pricing() {
  const [isAnnual, setIsAnnual] = useState(false);

  return (
    <section id="pricing" className="py-24 bg-muted/30 relative">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <ScrollReveal direction="up" className="text-center mb-16">
          <motion.h2
            variants={{
              hidden: { opacity: 0, y: 20 },
              visible: { opacity: 1, y: 0 },
            }}
            className="text-3xl sm:text-4xl md:text-5xl font-bold mb-4"
          >
            Simple, Transparent Pricing
          </motion.h2>
          <motion.p
            variants={{
              hidden: { opacity: 0, y: 20 },
              visible: { opacity: 1, y: 0 },
            }}
            transition={{ delay: 0.1 }}
            className="text-lg text-muted-foreground max-w-2xl mx-auto mb-8"
          >
            Choose the plan that fits your needs. All plans include a 14-day free trial.
          </motion.p>

          {/* Billing toggle */}
          <div className="flex items-center justify-center space-x-4 mb-12">
            <span className={`text-sm ${!isAnnual ? 'font-semibold' : 'text-muted-foreground'}`}>
              Monthly
            </span>
            <button
              onClick={() => setIsAnnual(!isAnnual)}
              className="relative w-14 h-7 bg-primary rounded-full transition-colors"
            >
              <motion.div
                animate={{ x: isAnnual ? 28 : 0 }}
                className="absolute top-1 left-1 w-5 h-5 bg-white rounded-full shadow-md"
              />
            </button>
            <span className={`text-sm ${isAnnual ? 'font-semibold' : 'text-muted-foreground'}`}>
              Annual
              <span className="ml-2 text-xs text-primary">Save 20%</span>
            </span>
          </div>
        </ScrollReveal>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-6xl mx-auto">
          {plans.map((plan, index) => {
            const monthlyPrice = typeof plan.price === 'number' ? plan.price : 0;
            const annualPrice = typeof plan.price === 'number' ? monthlyPrice * 12 * 0.8 : 0;
            const displayPrice = isAnnual && typeof plan.price === 'number' ? annualPrice : plan.price;

            return (
              <ScrollReveal
                key={plan.name}
                direction="up"
                delay={index * 0.1}
                className="h-full"
              >
                <motion.div
                  whileHover={{ y: -8, scale: plan.popular ? 1.02 : 1 }}
                  transition={{ duration: 0.3 }}
                  className={`relative h-full ${plan.popular ? 'md:-mt-4' : ''}`}
                >
                  {plan.popular && (
                    <div className="absolute -top-4 left-1/2 transform -translate-x-1/2 z-10">
                      <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        className="flex items-center space-x-1 bg-gradient-to-r from-primary to-primary-medium text-white px-4 py-1 rounded-full text-sm font-semibold shadow-lg"
                      >
                        <Sparkles className="h-4 w-4" />
                        <span>Most Popular</span>
                      </motion.div>
                    </div>
                  )}
                  <Card
                    className={`h-full border-2 transition-all duration-300 ${
                      plan.popular
                        ? 'border-primary shadow-xl bg-gradient-to-br from-primary/5 to-transparent'
                        : 'border-border hover:border-primary/50'
                    } hover:shadow-lg`}
                  >
                    <CardHeader className="text-center">
                      <CardTitle className="text-2xl mb-2">{plan.name}</CardTitle>
                      <CardDescription className="text-base mb-4">
                        {plan.description}
                      </CardDescription>
                      <div className="mb-6">
                        {typeof displayPrice === 'number' ? (
                          <div>
                            <span className="text-5xl font-bold">
                              ${isAnnual ? Math.round(displayPrice / 12) : displayPrice}
                            </span>
                            <span className="text-muted-foreground">/month</span>
                            {isAnnual && (
                              <p className="text-sm text-muted-foreground mt-2">
                                Billed annually (${Math.round(displayPrice)}/year)
                              </p>
                            )}
                          </div>
                        ) : (
                          <span className="text-5xl font-bold">{displayPrice}</span>
                        )}
                      </div>
                    </CardHeader>
                    <CardContent>
                      <ul className="space-y-4 mb-8">
                        {plan.features.map((feature, featureIndex) => (
                          <motion.li
                            key={featureIndex}
                            initial={{ opacity: 0, x: -20 }}
                            whileInView={{ opacity: 1, x: 0 }}
                            viewport={{ once: true }}
                            transition={{ delay: featureIndex * 0.1 }}
                            className="flex items-start space-x-3"
                          >
                            <Check className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                            <span className="text-sm">{feature}</span>
                          </motion.li>
                        ))}
                      </ul>
                      <Button
                        onClick={() => {
                          if (plan.name === 'Enterprise') {
                            // Contact sales
                            window.location.href = 'mailto:sales@timesheetpro.com';
                          } else {
                            window.location.href = '/register';
                          }
                        }}
                        className={`w-full ${
                          plan.popular
                            ? 'bg-gradient-to-r from-primary to-primary-medium hover:from-primary-medium hover:to-primary-light'
                            : ''
                        }`}
                        variant={plan.popular ? 'default' : 'outline'}
                      >
                        {plan.cta}
                      </Button>
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
