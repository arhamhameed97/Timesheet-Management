'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import {
  LayoutDashboard,
  Users,
  Clock,
  FileText,
  UsersRound,
  DollarSign,
  Building2,
  Settings,
  BarChart3,
  Calendar,
  Briefcase,
} from 'lucide-react';
import { UserRole } from '@prisma/client';
import { hasPermission } from '@/lib/permission-matrix';

interface NavItem {
  title: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  feature?: string; // Permission feature to check
  roles?: UserRole[]; // Specific roles that can see this (if feature not specified)
}

const allNavItems: NavItem[] = [
  { title: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { 
    title: 'Employees', 
    href: '/employees', 
    icon: Users,
    feature: 'view_all_employees',
  },
  { 
    title: 'Attendance', 
    href: '/attendance', 
    icon: Clock,
    feature: 'edit_attendance', // All roles can edit attendance (own for employees, others based on permissions)
  },
  { 
    title: 'Timesheets', 
    href: '/timesheets', 
    icon: FileText,
    feature: 'view_all_timesheets',
  },
  { 
    title: 'Teams', 
    href: '/teams', 
    icon: UsersRound,
    feature: 'create_manage_teams',
  },
  { 
    title: 'Payroll', 
    href: '/payroll', 
    icon: DollarSign,
    roles: [UserRole.SUPER_ADMIN, UserRole.COMPANY_ADMIN, UserRole.MANAGER, UserRole.EMPLOYEE], // All roles can view payroll (page handles permissions)
  },
  { 
    title: 'Designations', 
    href: '/designations', 
    icon: Briefcase,
    feature: 'create_designations',
  },
  { 
    title: 'Reports', 
    href: '/reports', 
    icon: BarChart3,
    feature: 'view_reports',
  },
  { title: 'Settings', href: '/settings', icon: Settings },
];

const superAdminNavItems: NavItem[] = [
  { title: 'Dashboard', href: '/super-admin/dashboard', icon: LayoutDashboard },
  { title: 'Companies', href: '/super-admin/companies', icon: Building2 },
  { title: 'All Users', href: '/super-admin/users', icon: Users },
  { title: 'Analytics', href: '/super-admin/analytics', icon: BarChart3 },
  { title: 'Settings', href: '/super-admin/settings', icon: Settings },
];

interface SidebarProps {
  role?: UserRole | string;
}

export function Sidebar({ role }: SidebarProps) {
  const pathname = usePathname();
  const userRole = role as UserRole;
  const isSuperAdmin = userRole === UserRole.SUPER_ADMIN;
  
  // Filter navigation items based on permissions
  const getFilteredNavItems = (): NavItem[] => {
    if (isSuperAdmin) {
      return superAdminNavItems;
    }
    
    if (!userRole) {
      return [];
    }
    
    return allNavItems.filter((item) => {
      // If item has specific roles, check those
      if (item.roles && item.roles.length > 0) {
        return item.roles.includes(userRole);
      }
      
      // If item has a feature permission, check that
      if (item.feature) {
        return hasPermission(userRole, item.feature as any);
      }
      
      // Default: show item (like Dashboard and Settings)
      return true;
    });
  };
  
  const items = getFilteredNavItems();

  return (
    <div className="flex h-screen w-20 flex-col items-center bg-[#6B46C1] py-6">
      <div className="mb-8">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white text-[#6B46C1] font-bold text-xl">
          T
        </div>
      </div>
      <nav className="flex flex-1 flex-col gap-4">
        {items.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href || pathname?.startsWith(item.href + '/');
          
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex flex-col items-center justify-center gap-1 rounded-lg w-14 py-2 transition-colors',
                isActive
                  ? 'bg-[#8B5CF6] text-white'
                  : 'text-white/70 hover:bg-[#8B5CF6]/50 hover:text-white'
              )}
            >
              <Icon className="h-6 w-6" />
              <span className="text-[10px] font-medium text-center leading-tight">{item.title}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}












