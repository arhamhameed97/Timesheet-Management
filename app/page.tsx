'use client';

import { useEffect } from 'react';

export default function Home() {
  useEffect(() => {
    // Check if user has a token
    const token = localStorage.getItem('token');
    
    // Use window.location.href for a full page redirect
    // This ensures middleware runs and can verify the token from cookies
    if (token) {
      // If token exists, redirect to dashboard
      // The middleware will verify the token and redirect to login if invalid
      window.location.href = '/dashboard';
    } else {
      // If no token, redirect to login
      window.location.href = '/login';
    }
  }, []);

  // Show loading state while redirecting
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-24">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
        <h1 className="text-4xl font-bold">Timesheet Management</h1>
        <p className="mt-4 text-lg text-muted-foreground">Redirecting...</p>
      </div>
    </main>
  );
}


