'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import Link from 'next/link';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [debugInfo, setDebugInfo] = useState<any>(null);

  // Check for debug info on mount
  useEffect(() => {
    const storedDebug = sessionStorage.getItem('login_debug');
    const redirectInfo = sessionStorage.getItem('login_redirect');
    const errorInfo = sessionStorage.getItem('login_error');
    
    if (storedDebug) {
      const parsed = JSON.parse(storedDebug);
      console.log('=== LOGIN DEBUG INFO ===', parsed);
      setDebugInfo(parsed);
      // Don't remove immediately - let user see it
    }
    
    if (redirectInfo) {
      console.log('=== REDIRECT ATTEMPTED TO ===', redirectInfo);
    }
    
    if (errorInfo) {
      const parsed = JSON.parse(errorInfo);
      console.log('=== LOGIN ERROR ===', parsed);
      setError(parsed.error || 'Login failed');
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    setError('');
    setLoading(true);

    try {
      // Add timeout to prevent hanging requests
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout

      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
        credentials: 'include',
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      console.log('Response status:', response.status, response.statusText);
      console.log('Response ok:', response.ok);

      // Check if response is ok before parsing JSON
      let data;
      try {
        const text = await response.text();
        console.log('Response text:', text);
        data = text ? JSON.parse(text) : {};
        console.log('Parsed data:', data);
      } catch (parseError) {
        console.error('Failed to parse response:', parseError);
        setError('Invalid response from server. Please try again.');
        setLoading(false);
        return;
      }

      if (!response.ok) {
        console.error('Response not ok:', data);
        setError(data.error || `Login failed: ${response.status} ${response.statusText}`);
        setLoading(false);
        return;
      }

      // Store token in localStorage (cookie is set by server)
      console.log('Checking for token:', data.token);
      
      // Store debug info in sessionStorage so it survives redirect
      sessionStorage.setItem('login_debug', JSON.stringify({
        timestamp: new Date().toISOString(),
        hasToken: !!data.token,
        responseStatus: response.status,
        responseOk: response.ok,
        userRole: data.user?.role,
        fullData: data
      }));
      
      if (data.token) {
        console.log('Token found, storing in localStorage');
        localStorage.setItem('token', data.token);
        console.log('Token stored, user role:', data.user?.role);
        
        // Store user data including designation
        if (data.user) {
          localStorage.setItem('userRole', data.user.role);
          if (data.user.designation) {
            localStorage.setItem('userDesignation', JSON.stringify(data.user.designation));
          }
        }
        
        // Use dashboard route from server response, fallback to default
        const redirectPath = data.dashboardRoute || (data.user?.role === 'SUPER_ADMIN' ? '/super-admin/dashboard' : '/dashboard');
        console.log('Redirecting to:', redirectPath);
        console.log('User data:', data.user);
        
        // Store redirect info for debugging
        sessionStorage.setItem('login_redirect', redirectPath);
        
        // Reset loading state before redirect
        setLoading(false);
        
        // Use window.location.href for a full page reload
        // This ensures middleware runs and can read the server-set cookie
        // The cookie is set by the server response, so it should be available
        console.log('Redirecting to:', redirectPath);
        window.location.href = redirectPath;
      } else {
        console.error('No token in response:', data);
        sessionStorage.setItem('login_error', JSON.stringify({
          error: 'No token received',
          data: data
        }));
        setError('Login failed: No token received');
        setLoading(false);
      }
    } catch (err: any) {
      console.error('Login error:', err);
      
      // Handle different error types
      if (err.name === 'AbortError') {
        setError('Request timed out. Please check your connection and try again.');
      } else if (err.message?.includes('Failed to fetch') || err.message?.includes('NetworkError')) {
        setError('Network error. Please check your connection and try again.');
      } else {
        setError(err.message || 'An error occurred. Please try again.');
      }
      
      setLoading(false);
    }
  };


  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl font-bold text-center">Login</CardTitle>
          <CardDescription className="text-center">
            Enter your credentials to access your account
          </CardDescription>
        </CardHeader>
          <CardContent>
          <form 
            onSubmit={async (e) => {
              e.preventDefault();
              e.stopPropagation();
              
              if (!email || !password) {
                setError('Please enter both email and password');
                return;
              }
              
              await handleSubmit(e);
            }}
            className="space-y-4"
            noValidate
          >
            {error && (
              <div className="p-3 text-sm text-red-600 bg-red-50 rounded-lg">
                {error}
              </div>
            )}
            {debugInfo && (
              <div className="p-3 text-xs bg-yellow-50 border border-yellow-200 rounded-lg">
                <div className="font-semibold mb-2">Debug Info:</div>
                <div>Status: {debugInfo.responseStatus} ({debugInfo.responseOk ? 'OK' : 'Failed'})</div>
                <div>Has Token: {debugInfo.hasToken ? 'Yes' : 'No'}</div>
                <div>User Role: {debugInfo.userRole || 'None'}</div>
                <div className="mt-2 text-gray-600">Check console for full details</div>
                <button 
                  onClick={() => {
                    sessionStorage.removeItem('login_debug');
                    setDebugInfo(null);
                  }}
                  className="mt-2 text-xs text-blue-600 hover:underline"
                >
                  Clear debug info
                </button>
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => {
                  console.log('Email changed:', e.target.value);
                  setEmail(e.target.value);
                }}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => {
                  console.log('Password changed');
                  setPassword(e.target.value);
                }}
                required
              />
            </div>
            <Button 
              type="submit"
              className="w-full" 
              disabled={loading}
            >
              {loading ? 'Logging in...' : 'Login'}
            </Button>
            <div className="text-center text-sm text-gray-600">
              Don&apos;t have an account?{' '}
              <Link href="/register" className="text-primary hover:underline">
                Register
              </Link>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

