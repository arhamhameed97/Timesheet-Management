'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function Home() {
  const router = useRouter();

  useEffect(() => {
    // Check if user has a token
    const token = localStorage.getItem('token');
    
    if (token) {
      // If token exists, redirect to dashboard
      // The middleware will verify the token and redirect to login if invalid
      router.push('/dashboard');
    } else {
      // If no token, redirect to login
      router.push('/login');
    }
  }, [router]);

  // Show loading state while redirecting
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-24">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 mx-auto mb-4"></div>
        <h1 className="text-4xl font-bold">Timesheet Management</h1>
        <p className="mt-4 text-lg text-gray-600">Redirecting...</p>
      </div>
    </main>
  );
}


