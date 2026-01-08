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
  Sparkles,
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
    <div className="flex h-screen w-64 flex-col bg-primary dark:bg-primary/90">
      {/* Logo Section */}
      <div className="flex items-center gap-3 px-6 py-6 border-b-2 border-primary-foreground/10">
        <div className="flex items-center justify-center">
          <Sparkles className="h-6 w-6 text-primary-foreground" />
        </div>
        <h1 className="text-lg font-semibold text-primary-foreground">Punchin</h1>
      </div>

      {/* Menu Section */}
      <div className="flex-1 overflow-y-auto py-4">
        <div className="px-6 mb-4">
          <h2 className="text-xs font-medium text-primary-foreground/60 uppercase tracking-wider">Menu</h2>
        </div>
        <nav className="flex flex-col gap-1 px-3">
          {items.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href || pathname?.startsWith(item.href + '/');
            
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'flex items-center gap-3 px-3 py-3 rounded-lg transition-all duration-200 relative',
                  isActive
                    ? 'bg-primary-foreground/10 dark:bg-primary-foreground/15 border-l-4 border-primary-foreground text-primary-foreground font-medium'
                    : 'text-primary-foreground/70 hover:bg-primary-foreground/5 dark:hover:bg-primary-foreground/10 hover:text-primary-foreground'
                )}
              >
                <Icon className={cn(
                  'h-5 w-5 flex-shrink-0',
                  isActive ? 'text-primary-foreground' : 'text-primary-foreground/70'
                )} />
                <span className="text-sm">{item.title}</span>
              </Link>
            );
          })}
        </nav>
      </div>
    </div>
  );
}
















