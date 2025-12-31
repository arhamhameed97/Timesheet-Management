import { UserRole } from '@prisma/client';
import { prisma } from './db';
import { Feature, hasPermission, getDashboardRoute, getAllowedFeatures } from './permission-matrix';

export interface UserContext {
  userId: string;
  role: UserRole;
  companyId?: string | null;
}

export async function canManageUser(
  context: UserContext,
  targetUserId: string
): Promise<boolean> {
  // Super admin can manage anyone
  if (context.role === UserRole.SUPER_ADMIN) {
    return true;
  }

  // Company admin can manage users in their company
  if (context.role === UserRole.COMPANY_ADMIN) {
    const targetUser = await prisma.user.findUnique({
      where: { id: targetUserId },
      select: { companyId: true, role: true },
    });
    return targetUser?.companyId === context.companyId;
  }

  // Managers can manage subordinates
  if (context.role === UserRole.MANAGER) {
    return await isSubordinate(context.userId, targetUserId);
  }

  // Team leads can manage team members
  if (context.role === UserRole.TEAM_LEAD) {
    const isTeamMember = await prisma.teamMember.findFirst({
      where: {
        userId: targetUserId,
        team: {
          members: {
            some: {
              userId: context.userId,
              role: 'LEAD',
            },
          },
        },
      },
    });
    return !!isTeamMember;
  }

  // Employees can only manage themselves
  return context.userId === targetUserId;
}

export async function canViewUser(
  context: UserContext,
  targetUserId: string
): Promise<boolean> {
  // Super admin can view anyone
  if (context.role === UserRole.SUPER_ADMIN) {
    return true;
  }

  // Company admin can view users in their company
  if (context.role === UserRole.COMPANY_ADMIN) {
    const targetUser = await prisma.user.findUnique({
      where: { id: targetUserId },
      select: { companyId: true },
    });
    return targetUser?.companyId === context.companyId;
  }

  // Managers can view subordinates
  if (context.role === UserRole.MANAGER) {
    return await isSubordinate(context.userId, targetUserId);
  }

  // Team leads can view team members
  if (context.role === UserRole.TEAM_LEAD) {
    const isTeamMember = await prisma.teamMember.findFirst({
      where: {
        userId: targetUserId,
        team: {
          members: {
            some: {
              userId: context.userId,
            },
          },
        },
      },
    });
    return !!isTeamMember;
  }

  // Employees can only view themselves
  return context.userId === targetUserId;
}

async function isSubordinate(managerId: string, userId: string): Promise<boolean> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { managerId: true },
  });

  if (!user || !user.managerId) {
    return false;
  }

  if (user.managerId === managerId) {
    return true;
  }

  // Recursively check if manager is in the chain
  return isSubordinate(managerId, user.managerId);
}

export function canAccessCompany(context: UserContext, companyId: string | null): boolean {
  // Super admin can access all companies
  if (context.role === UserRole.SUPER_ADMIN) {
    return true;
  }

  // Others can only access their own company
  return context.companyId === companyId;
}

export function requireRole(context: UserContext, ...roles: UserRole[]): boolean {
  return roles.includes(context.role);
}

/**
 * Check if user can view a feature
 */
export function canViewFeature(context: UserContext, feature: Feature): boolean {
  return hasPermission(context.role, feature);
}

/**
 * Check if user can edit a feature
 * Note: For features with "own only" restrictions, additional resource checks are needed
 */
export function canEditFeature(context: UserContext, feature: Feature): boolean {
  return hasPermission(context.role, feature);
}

/**
 * Check if user can approve a feature
 */
export function canApproveFeature(context: UserContext, feature: Feature): boolean {
  return hasPermission(context.role, feature);
}

/**
 * Get dashboard route for user role
 */
export function getUserDashboardRoute(role: UserRole): string {
  return getDashboardRoute(role);
}

/**
 * Get list of allowed features for user role
 */
export function getUserAllowedFeatures(role: UserRole): Feature[] {
  return getAllowedFeatures(role);
}












