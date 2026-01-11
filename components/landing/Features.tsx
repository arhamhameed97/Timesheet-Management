'use client';

import { motion } from 'framer-motion';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Building2,
  Users,
  Clock,
  FileText,
  UsersRound,
  DollarSign,
  Calendar,
  BarChart3,
} from 'lucide-react';
import { ScrollReveal } from './ScrollReveal';

const features = [
  {
    icon: Building2,
    title: 'Company Management',
    description: 'Multi-tenant architecture supporting unlimited companies with isolated data and settings.',
  },
  {
    icon: Users,
    title: 'Employee Management',
    description: 'Hierarchical organization with designations, roles, and comprehensive employee profiles.',
  },
  {
    icon: Clock,
    title: 'Attendance Tracking',
    description: 'Real-time check-in/check-out with automated tracking and comprehensive attendance reports.',
  },
  {
    icon: FileText,
    title: 'Timesheet Management',
    description: 'Task logging, time tracking, and streamlined approval workflows for accurate billing.',
  },
  {
    icon: UsersRound,
    title: 'Team Collaboration',
    description: 'Create teams, assign members, track progress, and foster seamless collaboration.',
  },
  {
    icon: DollarSign,
    title: 'Payroll Processing',
    description: 'Automated calculations, allowances, deductions, and approval workflows for payroll.',
  },
  {
    icon: Calendar,
    title: 'Leave Management',
    description: 'Request, approve, and track leaves with flexible leave types and policies.',
  },
  {
    icon: BarChart3,
    title: 'Reports & Analytics',
    description: 'Comprehensive insights with customizable reports and real-time analytics dashboards.',
  },
];

export function Features() {
  return (
    <section id="features" className="py-24 bg-background relative">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <ScrollReveal direction="up" className="text-center mb-16">
          <motion.h2
            variants={{
              hidden: { opacity: 0, y: 20 },
              visible: { opacity: 1, y: 0 },
            }}
            className="text-3xl sm:text-4xl md:text-5xl font-bold mb-4"
          >
            Everything You Need to{' '}
            <span className="bg-gradient-to-r from-primary to-primary-medium bg-clip-text text-transparent">
              Manage Your Workforce
            </span>
          </motion.h2>
          <motion.p
            variants={{
              hidden: { opacity: 0, y: 20 },
              visible: { opacity: 1, y: 0 },
            }}
            transition={{ delay: 0.1 }}
            className="text-lg text-muted-foreground max-w-2xl mx-auto"
          >
            Powerful features designed to streamline your workforce management and boost productivity.
          </motion.p>
        </ScrollReveal>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {features.map((feature, index) => {
            const Icon = feature.icon;
            return (
              <ScrollReveal
                key={feature.title}
                direction="up"
                delay={index * 0.1}
                className="h-full"
              >
                <motion.div
                  whileHover={{ y: -8, scale: 1.02 }}
                  transition={{ duration: 0.3 }}
                >
                  <Card className="h-full border-2 hover:border-primary/50 transition-all duration-300 hover:shadow-lg group">
                    <CardHeader>
                      <motion.div
                        whileHover={{ rotate: 360, scale: 1.1 }}
                        transition={{ duration: 0.5 }}
                        className="w-12 h-12 rounded-lg bg-gradient-to-br from-primary/10 to-primary-medium/10 flex items-center justify-center mb-4 group-hover:bg-gradient-to-br group-hover:from-primary/20 group-hover:to-primary-medium/20 transition-colors"
                      >
                        <Icon className="h-6 w-6 text-primary group-hover:text-primary-medium transition-colors" />
                      </motion.div>
                      <CardTitle className="text-xl mb-2">{feature.title}</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <CardDescription className="text-base">
                        {feature.description}
                      </CardDescription>
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
