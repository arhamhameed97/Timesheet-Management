'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Search, ChevronDown, HelpCircle, Shield, DollarSign, Rocket, Users } from 'lucide-react';
import { ScrollReveal } from './ScrollReveal';

const faqCategories = [
  { id: 'all', label: 'All Questions', icon: HelpCircle },
  { id: 'getting-started', label: 'Getting Started', icon: Rocket },
  { id: 'features', label: 'Features', icon: Users },
  { id: 'security', label: 'Security', icon: Shield },
  { id: 'pricing', label: 'Pricing', icon: DollarSign },
];

const faqs = [
  {
    id: 1,
    category: 'getting-started',
    question: 'How quickly can I get started?',
    answer: 'You can get started in minutes! Simply register your company, add your team members, and start tracking time. Our intuitive interface requires no training.',
  },
  {
    id: 2,
    category: 'getting-started',
    question: 'Do I need to install any software?',
    answer: 'No installation required! TimeSheet Pro is a cloud-based platform accessible from any device with an internet connection. Works on desktop, tablet, and mobile browsers.',
  },
  {
    id: 3,
    category: 'features',
    question: 'What features are included in the Starter plan?',
    answer: 'The Starter plan includes basic timesheet tracking, attendance management, basic reporting, and email support for up to 10 employees. Perfect for small teams getting started.',
  },
  {
    id: 4,
    category: 'features',
    question: 'Can I integrate with other tools?',
    answer: 'Yes! Our Professional and Enterprise plans include API access and integrations with popular tools like Slack, Jira, QuickBooks, and more. Enterprise plans offer custom integrations.',
  },
  {
    id: 5,
    category: 'security',
    question: 'How secure is my data?',
    answer: 'Security is our top priority. We use bank-level encryption, comply with GDPR and SOC 2 standards, and perform regular security audits. Your data is stored in secure, redundant data centers.',
  },
  {
    id: 6,
    category: 'security',
    question: 'Who can access my company data?',
    answer: 'Only authorized users within your company can access data. We use role-based access control (RBAC) to ensure employees only see what they need. Company admins have full control over permissions.',
  },
  {
    id: 7,
    category: 'pricing',
    question: 'Can I change plans later?',
    answer: 'Absolutely! You can upgrade or downgrade your plan at any time. Changes take effect immediately, and we\'ll prorate any charges. No long-term contracts required.',
  },
  {
    id: 8,
    category: 'pricing',
    question: 'Is there a free trial?',
    answer: 'Yes! All plans include a 14-day free trial with full access to all features. No credit card required to start. Cancel anytime during the trial with no charges.',
  },
];

export function FAQ() {
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [openItems, setOpenItems] = useState<number[]>([]);

  const toggleItem = (id: number) => {
    setOpenItems((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const filteredFaqs = faqs.filter((faq) => {
    const matchesCategory = selectedCategory === 'all' || faq.category === selectedCategory;
    const matchesSearch =
      searchQuery === '' ||
      faq.question.toLowerCase().includes(searchQuery.toLowerCase()) ||
      faq.answer.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  return (
    <section id="faq" className="py-24 bg-background relative">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <ScrollReveal direction="up" className="text-center mb-16">
          <motion.h2
            variants={{
              hidden: { opacity: 0, y: 20 },
              visible: { opacity: 1, y: 0 },
            }}
            className="text-3xl sm:text-4xl md:text-5xl font-bold mb-4"
          >
            Frequently Asked Questions
          </motion.h2>
          <motion.p
            variants={{
              hidden: { opacity: 0, y: 20 },
              visible: { opacity: 1, y: 0 },
            }}
            transition={{ delay: 0.1 }}
            className="text-lg text-muted-foreground max-w-2xl mx-auto mb-8"
          >
            Find answers to common questions about TimeSheet Pro.
          </motion.p>
        </ScrollReveal>

        {/* Search */}
        <div className="max-w-2xl mx-auto mb-8">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Search FAQs..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>

        {/* Categories */}
        <div className="flex flex-wrap items-center justify-center gap-4 mb-12">
          {faqCategories.map((category) => {
            const Icon = category.icon;
            return (
              <button
                key={category.id}
                onClick={() => setSelectedCategory(category.id)}
                className={`flex items-center space-x-2 px-4 py-2 rounded-full transition-all duration-300 ${
                  selectedCategory === category.id
                    ? 'bg-gradient-to-r from-primary to-primary-medium text-white shadow-lg'
                    : 'bg-muted hover:bg-muted/80 text-foreground'
                }`}
              >
                <Icon className="h-4 w-4" />
                <span className="text-sm font-medium">{category.label}</span>
              </button>
            );
          })}
        </div>

        {/* FAQ Items */}
        <div className="max-w-3xl mx-auto space-y-4">
          <AnimatePresence>
            {filteredFaqs.map((faq, index) => {
              const isOpen = openItems.includes(faq.id);
              return (
                <motion.div
                  key={faq.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  transition={{ delay: index * 0.05 }}
                >
                  <Card className="border-2 hover:border-primary/50 transition-all duration-300">
                    <CardHeader>
                      <button
                        onClick={() => toggleItem(faq.id)}
                        className="flex items-center justify-between w-full text-left"
                      >
                        <CardTitle className="text-lg pr-8">{faq.question}</CardTitle>
                        <motion.div
                          animate={{ rotate: isOpen ? 180 : 0 }}
                          transition={{ duration: 0.3 }}
                        >
                          <ChevronDown className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                        </motion.div>
                      </button>
                    </CardHeader>
                    <AnimatePresence>
                      {isOpen && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.3 }}
                        >
                          <CardContent className="pt-0">
                            <p className="text-muted-foreground">{faq.answer}</p>
                          </CardContent>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </Card>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>

        {/* CTA */}
        <ScrollReveal direction="up" className="text-center mt-16">
          <motion.div
            variants={{
              hidden: { opacity: 0, y: 20 },
              visible: { opacity: 1, y: 0 },
            }}
          >
            <p className="text-muted-foreground mb-4">
              Can't find your answer?
            </p>
            <button
              onClick={() => (window.location.href = 'mailto:support@timesheetpro.com')}
              className="text-primary hover:text-primary-medium font-semibold underline"
            >
              Contact our support team
            </button>
          </motion.div>
        </ScrollReveal>
      </div>
    </section>
  );
}
