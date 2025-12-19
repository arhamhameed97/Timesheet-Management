'use client';

import { UserRole } from '@prisma/client';
import { CompanyAdminDashboard } from './CompanyAdminDashboard';
import { ManagerDashboard } from './ManagerDashboard';
import { TeamLeadDashboard } from './TeamLeadDashboard';
import { EmployeeDashboard } from './EmployeeDashboard';

interface RoleBasedDashboardProps {
  role: UserRole;
  stats: {
    totalEmployees: number;
    todayAttendance: number;
    pendingTimesheets: number;
    monthlyPayroll: number;
  };
  user: {
    name: string;
    role: UserRole;
    designation?: {
      id: string;
      name: string;
    } | null;
  };
}

export function RoleBasedDashboard({ role, stats, user }: RoleBasedDashboardProps) {
  switch (role) {
    case UserRole.COMPANY_ADMIN:
      return <CompanyAdminDashboard stats={stats} user={user} />;
    case UserRole.MANAGER:
      return <ManagerDashboard stats={stats} user={user} />;
    case UserRole.TEAM_LEAD:
      return <TeamLeadDashboard stats={stats} user={user} />;
    case UserRole.EMPLOYEE:
      return <EmployeeDashboard stats={stats} user={user} />;
    default:
      return <EmployeeDashboard stats={stats} user={user} />;
  }
}



