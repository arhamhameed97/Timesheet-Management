'use client';

import { useState, useEffect } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { RoleBasedDashboard } from '@/components/dashboard/RoleBasedDashboard';
import { UserRole } from '@prisma/client';

interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  designation?: {
    id: string;
    name: string;
  } | null;
}

export default function DashboardPage() {
  const [stats, setStats] = useState({
    totalEmployees: 0,
    todayAttendance: 0,
    pendingTimesheets: 0,
    monthlyPayroll: 0,
  });
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      const token = localStorage.getItem('token');
      
      // Fetch user data and stats in parallel
      const [userResponse, statsResponse] = await Promise.all([
        fetch('/api/auth/me', {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }),
        fetch('/api/dashboard/stats', {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }),
      ]);

      if (userResponse.ok) {
        const userData = await userResponse.json();
        setUser(userData.user);
      }

      if (statsResponse.ok) {
        const statsData = await statsResponse.json();
        setStats({
          totalEmployees: statsData.totalEmployees || 0,
          todayAttendance: statsData.todayAttendance || 0,
          pendingTimesheets: statsData.pendingTimesheets || 0,
          monthlyPayroll: statsData.monthlyPayroll || 0,
        });
      }
    } catch (error) {
      console.error('Failed to fetch dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading || !user) {
    return (
      <MainLayout>
        <div className="flex h-screen items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
            <p className="mt-4 text-muted-foreground">Loading dashboard...</p>
          </div>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <RoleBasedDashboard
        role={user.role}
        stats={stats}
        user={{
          name: user.name,
          role: user.role,
          designation: user.designation,
        }}
      />
    </MainLayout>
  );
}


