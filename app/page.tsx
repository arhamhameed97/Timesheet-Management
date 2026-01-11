'use client';

import { useEffect } from 'react';
import { Navbar } from '@/components/landing/Navbar';
import { Hero } from '@/components/landing/Hero';
import { Features } from '@/components/landing/Features';
import { HowItWorks } from '@/components/landing/HowItWorks';
import { Stats } from '@/components/landing/Stats';
import { Testimonials } from '@/components/landing/Testimonials';
import { Pricing } from '@/components/landing/Pricing';
import { ValueProposition } from '@/components/landing/ValueProposition';
import { FAQ } from '@/components/landing/FAQ';
import { CTASection } from '@/components/landing/CTASection';
import { Footer } from '@/components/landing/Footer';
import { LiveChat } from '@/components/landing/LiveChat';
import { ScrollProgress } from '@/components/landing/ScrollProgress';

export default function Home() {
  useEffect(() => {
    // Check if user has a token
    const token = localStorage.getItem('token');
    
    // If token exists, redirect to dashboard
    // The middleware will verify the token and redirect to login if invalid
    if (token) {
      window.location.href = '/dashboard';
      return;
    }

    // Add smooth scroll behavior
    document.documentElement.style.scrollBehavior = 'smooth';
  }, []);

  return (
    <main className="min-h-screen bg-background">
      <ScrollProgress />
      <Navbar />
      <Hero />
      <Features />
      <HowItWorks />
      <Stats />
      <ValueProposition />
      <Testimonials />
      <Pricing />
      <FAQ />
      <CTASection />
      <Footer />
      <LiveChat />
    </main>
  );
}
