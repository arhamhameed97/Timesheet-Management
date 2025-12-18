'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import Link from 'next/link';

export default function RegisterPage() {
  const router = useRouter();
  const [formData, setFormData] = useState({
    companyName: '',
    companyEmail: '',
    companyAddress: '',
    adminName: '',
    adminEmail: '',
    adminPassword: '',
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || 'Registration failed');
        setLoading(false);
        return;
      }

      // Store token in localStorage (cookie is set by server)
      if (data.token) {
        localStorage.setItem('token', data.token);
        
        // Store user data including designation
        if (data.user) {
          localStorage.setItem('userRole', data.user.role);
          if (data.user.designation) {
            localStorage.setItem('userDesignation', JSON.stringify(data.user.designation));
          }
        }
        
        // Use dashboard route from server response, fallback to default
        const redirectPath = data.dashboardRoute || '/dashboard';
        
        // Redirect to dashboard - use window.location for full page reload
        window.location.href = redirectPath;
      } else {
        setError('Registration failed: No token received');
        setLoading(false);
      }
    } catch (err) {
      setError('An error occurred. Please try again.');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4 py-8">
      <Card className="w-full max-w-2xl">
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl font-bold text-center">Register Company</CardTitle>
          <CardDescription className="text-center">
            Create a new company account and admin user
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="p-3 text-sm text-red-600 bg-red-50 rounded-lg">
                {error}
              </div>
            )}
            
            <div className="space-y-4">
              <h3 className="font-semibold text-lg">Company Information</h3>
              <div className="space-y-2">
                <Label htmlFor="companyName">Company Name *</Label>
                <Input
                  id="companyName"
                  name="companyName"
                  value={formData.companyName}
                  onChange={handleChange}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="companyEmail">Company Email *</Label>
                <Input
                  id="companyEmail"
                  name="companyEmail"
                  type="email"
                  value={formData.companyEmail}
                  onChange={handleChange}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="companyAddress">Company Address</Label>
                <Input
                  id="companyAddress"
                  name="companyAddress"
                  value={formData.companyAddress}
                  onChange={handleChange}
                />
              </div>
            </div>

            <div className="space-y-4 pt-4 border-t">
              <h3 className="font-semibold text-lg">Admin User Information</h3>
              <div className="space-y-2">
                <Label htmlFor="adminName">Admin Name *</Label>
                <Input
                  id="adminName"
                  name="adminName"
                  value={formData.adminName}
                  onChange={handleChange}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="adminEmail">Admin Email *</Label>
                <Input
                  id="adminEmail"
                  name="adminEmail"
                  type="email"
                  value={formData.adminEmail}
                  onChange={handleChange}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="adminPassword">Admin Password *</Label>
                <Input
                  id="adminPassword"
                  name="adminPassword"
                  type="password"
                  value={formData.adminPassword}
                  onChange={handleChange}
                  required
                  minLength={6}
                />
              </div>
            </div>

            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? 'Registering...' : 'Register Company'}
            </Button>
            <div className="text-center text-sm text-gray-600">
              Already have an account?{' '}
              <Link href="/login" className="text-primary hover:underline">
                Login
              </Link>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

