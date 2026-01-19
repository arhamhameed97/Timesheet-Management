'use client';

import { useState, useEffect } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Building2, Users, TrendingUp, DollarSign } from 'lucide-react';

interface DashboardStats {
  totalCompanies: number;
  totalUsers: number;
  activeCompanies: number;
  systemRevenue: number;
}

export default function SuperAdminDashboardPage() {
  const [stats, setStats] = useState<DashboardStats>({
    totalCompanies: 0,
    totalUsers: 0,
    activeCompanies: 0,
    systemRevenue: 0,
  });
  const [loading, setLoading] = useState(true);
  const [companyContext, setCompanyContext] = useState<{ id: string; name: string } | null>(null);

  useEffect(() => {
    fetchStats();
    fetchCompanyContext();
  }, []);

  // Refresh stats when page becomes visible (handles company context changes)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        fetchStats();
        fetchCompanyContext();
      }
    };

    const handleFocus = () => {
      fetchStats();
      fetchCompanyContext();
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleFocus);

    // Also poll periodically to catch changes
    const interval = setInterval(() => {
      fetchStats();
      fetchCompanyContext();
    }, 10000); // Refresh every 10 seconds

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleFocus);
      clearInterval(interval);
    };
  }, []);

  const fetchCompanyContext = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/super-admin/company-context', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setCompanyContext(data.company || null);
      }
    } catch (error) {
      console.error('Failed to fetch company context:', error);
    }
  };

  const fetchStats = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/super-admin/stats', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
        credentials: 'include', // Include cookies for company context
      });

      if (response.ok) {
        const data = await response.json();
        setStats(data.stats);
      } else {
        console.error('Failed to fetch stats');
      }
    } catch (error) {
      console.error('Failed to fetch stats:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  return (
    <MainLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Super Admin Dashboard</h1>
          <p className="text-muted-foreground mt-1">
            {companyContext 
              ? `Viewing data for: ${companyContext.name}` 
              : 'System-wide overview and analytics'}
          </p>
        </div>

        {loading ? (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {[1, 2, 3, 4].map((i) => (
              <Card key={i}>
                <CardContent className="py-8">
                  <div className="animate-pulse">
                    <div className="h-8 bg-muted rounded w-24 mb-2"></div>
                    <div className="h-4 bg-muted rounded w-32"></div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Companies</CardTitle>
                <Building2 className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.totalCompanies}</div>
                <p className="text-xs text-muted-foreground">
                  {companyContext ? 'Selected company' : 'Registered companies'}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Users</CardTitle>
                <Users className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.totalUsers}</div>
                <p className="text-xs text-muted-foreground">
                  {companyContext ? 'Users in company' : 'All users'}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Active Companies</CardTitle>
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.activeCompanies}</div>
                <p className="text-xs text-muted-foreground">
                  {companyContext ? 'Company status' : 'Active accounts'}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">System Revenue</CardTitle>
                <DollarSign className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{formatCurrency(stats.systemRevenue)}</div>
                <p className="text-xs text-muted-foreground">
                  {companyContext ? 'Company revenue' : 'This month'}
                </p>
              </CardContent>
            </Card>
          </div>
        )}

        <Card>
          <CardHeader>
            <CardTitle>System Overview</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              {companyContext 
                ? `Viewing analytics for ${companyContext.name}. Select "No company selected" in the header to view global statistics.`
                : 'System-wide analytics and management tools. Select a company from the dropdown to view company-specific data.'}
            </p>
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
}
















