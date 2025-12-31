import { UserRole } from '@prisma/client';

export type Feature =
  | 'view_all_companies'
  | 'manage_companies'
  | 'view_own_company'
  | 'manage_company_settings'
  | 'add_remove_employees'
  | 'edit_employee_profiles'
  | 'view_all_employees'
  | 'create_designations'
  | 'view_all_timesheets'
  | 'edit_timesheets'
  | 'approve_timesheets'
  | 'view_all_attendance'
  | 'edit_attendance'
  | 'create_manage_teams'
  | 'view_team_progress'
  | 'manage_payroll'
  | 'approve_payroll'
  | 'view_reports'
  | 'export_data';

export type PermissionMatrix = {
  [key in Feature]: {
    [role in UserRole]: boolean;
  };
};

// Permission matrix based on requirements
export const PERMISSION_MATRIX: PermissionMatrix = {
  view_all_companies: {
    SUPER_ADMIN: true,
    COMPANY_ADMIN: false,
    MANAGER: false,
    TEAM_LEAD: false,
    EMPLOYEE: false,
  },
  manage_companies: {
    SUPER_ADMIN: true,
    COMPANY_ADMIN: false,
    MANAGER: false,
    TEAM_LEAD: false,
    EMPLOYEE: false,
  },
  view_own_company: {
    SUPER_ADMIN: true,
    COMPANY_ADMIN: true,
    MANAGER: true,
    TEAM_LEAD: true,
    EMPLOYEE: true,
  },
  manage_company_settings: {
    SUPER_ADMIN: true,
    COMPANY_ADMIN: true,
    MANAGER: false,
    TEAM_LEAD: false,
    EMPLOYEE: false,
  },
  add_remove_employees: {
    SUPER_ADMIN: true,
    COMPANY_ADMIN: true,
    MANAGER: true, // Only for subordinates
    TEAM_LEAD: false,
    EMPLOYEE: false,
  },
  edit_employee_profiles: {
    SUPER_ADMIN: true,
    COMPANY_ADMIN: true,
    MANAGER: true, // Only for subordinates
    TEAM_LEAD: false,
    EMPLOYEE: false,
  },
  view_all_employees: {
    SUPER_ADMIN: true,
    COMPANY_ADMIN: true,
    MANAGER: true, // Only subordinates
    TEAM_LEAD: true, // Only team members
    EMPLOYEE: false,
  },
  create_designations: {
    SUPER_ADMIN: true,
    COMPANY_ADMIN: true,
    MANAGER: false,
    TEAM_LEAD: false,
    EMPLOYEE: false,
  },
  view_all_timesheets: {
    SUPER_ADMIN: true,
    COMPANY_ADMIN: true,
    MANAGER: true, // Only subordinates
    TEAM_LEAD: true, // Only team members
    EMPLOYEE: false,
  },
  edit_timesheets: {
    SUPER_ADMIN: true,
    COMPANY_ADMIN: true,
    MANAGER: true, // Only subordinates
    TEAM_LEAD: true, // Only team members
    EMPLOYEE: true, // Own only
  },
  approve_timesheets: {
    SUPER_ADMIN: true,
    COMPANY_ADMIN: true,
    MANAGER: true, // Only subordinates
    TEAM_LEAD: true, // Only team members
    EMPLOYEE: false,
  },
  view_all_attendance: {
    SUPER_ADMIN: true,
    COMPANY_ADMIN: true,
    MANAGER: true, // Only subordinates
    TEAM_LEAD: true, // Only team members
    EMPLOYEE: false,
  },
  edit_attendance: {
    SUPER_ADMIN: true,
    COMPANY_ADMIN: true,
    MANAGER: true, // Only subordinates
    TEAM_LEAD: true, // Only team members
    EMPLOYEE: true, // Own only
  },
  create_manage_teams: {
    SUPER_ADMIN: true,
    COMPANY_ADMIN: true,
    MANAGER: true,
    TEAM_LEAD: true,
    EMPLOYEE: false,
  },
  view_team_progress: {
    SUPER_ADMIN: true,
    COMPANY_ADMIN: true,
    MANAGER: true,
    TEAM_LEAD: true,
    EMPLOYEE: true, // Own team only
  },
  manage_payroll: {
    SUPER_ADMIN: true,
    COMPANY_ADMIN: true,
    MANAGER: true,
    TEAM_LEAD: false,
    EMPLOYEE: false,
  },
  approve_payroll: {
    SUPER_ADMIN: true,
    COMPANY_ADMIN: true,
    MANAGER: true,
    TEAM_LEAD: false,
    EMPLOYEE: false,
  },
  view_reports: {
    SUPER_ADMIN: true,
    COMPANY_ADMIN: true,
    MANAGER: true,
    TEAM_LEAD: true,
    EMPLOYEE: true, // Own only
  },
  export_data: {
    SUPER_ADMIN: true,
    COMPANY_ADMIN: true,
    MANAGER: true,
    TEAM_LEAD: true,
    EMPLOYEE: true, // Own only
  },
};

/**
 * Check if a role has permission for a feature
 * Note: This is a basic check. For features with restrictions (like "own only" or "subordinates only"),
 * additional context checks are needed in the API layer.
 */
export function hasPermission(role: UserRole, feature: Feature): boolean {
  return PERMISSION_MATRIX[feature][role];
}

/**
 * Get dashboard route for a role
 */
export function getDashboardRoute(role: UserRole): string {
  switch (role) {
    case UserRole.SUPER_ADMIN:
      return '/super-admin/dashboard';
    case UserRole.COMPANY_ADMIN:
    case UserRole.MANAGER:
    case UserRole.TEAM_LEAD:
    case UserRole.EMPLOYEE:
      return '/dashboard';
    default:
      return '/dashboard';
  }
}

/**
 * Get list of allowed features for a role
 */
export function getAllowedFeatures(role: UserRole): Feature[] {
  return Object.keys(PERMISSION_MATRIX).filter(
    (feature) => PERMISSION_MATRIX[feature as Feature][role]
  ) as Feature[];
}

/**
 * Get readable role name
 */
export function getRoleDisplayName(role: UserRole): string {
  const roleNames: Record<UserRole, string> = {
    SUPER_ADMIN: 'Super Admin',
    COMPANY_ADMIN: 'Company Admin',
    MANAGER: 'Manager',
    TEAM_LEAD: 'Team Lead',
    EMPLOYEE: 'Employee',
  };
  return roleNames[role] || role;
}









