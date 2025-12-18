'use client';

import { UserRole } from '@prisma/client';
import { getRoleDisplayName } from '@/lib/permission-matrix';

interface RoleBadgeProps {
  role: UserRole;
  className?: string;
}

const roleColors: Record<UserRole, string> = {
  SUPER_ADMIN: 'bg-red-100 text-red-800',
  COMPANY_ADMIN: 'bg-blue-100 text-blue-800',
  MANAGER: 'bg-green-100 text-green-800',
  TEAM_LEAD: 'bg-yellow-100 text-yellow-800',
  EMPLOYEE: 'bg-gray-100 text-gray-800',
};

export function RoleBadge({ role, className = '' }: RoleBadgeProps) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${roleColors[role]} ${className}`}
    >
      {getRoleDisplayName(role)}
    </span>
  );
}

