'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Sidebar } from './Sidebar';
import { Header } from './Header';
import { UserRole } from '@prisma/client';

interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  companyId?: string | null;
  designation?: {
    id: string;
    name: string;
  } | null;
}

interface MainLayoutProps {
  children: React.ReactNode;
}

export function MainLayout({ children }: MainLayoutProps) {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchUser = async () => {
      const token = localStorage.getItem('token');
      if (!token) {
        // Check if we're already on login page to avoid redirect loop
        if (window.location.pathname !== '/login' && window.location.pathname !== '/register') {
          router.push('/login');
        }
        setLoading(false);
        return;
      }

      try {
        const response = await fetch('/api/auth/me', {
          headers: {
            Authorization: `Bearer ${token}`,
          },
          credentials: 'include',
        });

        if (!response.ok) {
          // Only redirect if not already on login/register page
          if (window.location.pathname !== '/login' && window.location.pathname !== '/register') {
            localStorage.removeItem('token');
            document.cookie = 'token=; path=/; max-age=0';
            router.push('/login');
          }
          setLoading(false);
          return;
        }

        const data = await response.json();
        setUser(data.user);
        
        // Store user data in localStorage for quick access
        if (data.user) {
          localStorage.setItem('userRole', data.user.role);
          if (data.user.designation) {
            localStorage.setItem('userDesignation', JSON.stringify(data.user.designation));
          }
        }
      } catch (error) {
        console.error('Failed to fetch user:', error);
        // Only redirect if not already on login/register page
        if (window.location.pathname !== '/login' && window.location.pathname !== '/register') {
          localStorage.removeItem('token');
          document.cookie = 'token=; path=/; max-age=0';
          router.push('/login');
        }
      } finally {
        setLoading(false);
      }
    };

    fetchUser();
  }, [router]);

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <div className="flex h-screen bg-background">
      <Sidebar role={user.role} />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Header />
        <main className="flex-1 overflow-y-auto p-6 bg-gradient-to-br from-background via-background to-muted/5">{children}</main>
      </div>
    </div>
  );
}

