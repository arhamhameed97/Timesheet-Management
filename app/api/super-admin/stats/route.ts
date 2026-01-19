import { NextRequest, NextResponse } from 'next/server';
import { getAuthContext, unauthorizedResponse } from '@/lib/middleware-helpers';
import { prisma } from '@/lib/db';
import { UserRole } from '@prisma/client';
import { startOfMonth, endOfMonth } from 'date-fns';

export async function GET(request: NextRequest) {
  try {
    const context = await getAuthContext(request);
    if (!context) {
      return unauthorizedResponse();
    }

    if (context.role !== UserRole.SUPER_ADMIN) {
      return NextResponse.json(
        { error: 'Only super admins can access this endpoint' },
        { status: 403 }
      );
    }

    const now = new Date();
    const monthStart = startOfMonth(now);
    const monthEnd = endOfMonth(now);
    const currentMonth = now.getMonth() + 1;
    const currentYear = now.getFullYear();

    // Check if there's a company context override (from getAuthContext which already handles the cookie)
    // For SUPER_ADMIN, context.companyId will be set if a company context is selected
    const companyContextId = context.companyId || null;

    let stats: {
      totalCompanies: number;
      totalUsers: number;
      activeCompanies: number;
      systemRevenue: number;
    };

    if (companyContextId) {
      // Filter by selected company context
      const company = await prisma.company.findUnique({
        where: { id: companyContextId },
        include: {
          _count: {
            select: {
              users: true,
            },
          },
        },
      });

      if (!company) {
        return NextResponse.json(
          { error: 'Company not found' },
          { status: 404 }
        );
      }

      // Count users in this company (excluding super admins)
      const totalUsers = await prisma.user.count({
        where: {
          companyId: companyContextId,
          role: {
            not: UserRole.SUPER_ADMIN,
          },
          isActive: true,
        },
      });

      // Calculate monthly payroll for this company
      const monthlyPayrollRecords = await prisma.payroll.findMany({
        where: {
          month: currentMonth,
          year: currentYear,
          user: {
            companyId: companyContextId,
          },
        },
      });

      const systemRevenue = monthlyPayrollRecords.reduce(
        (sum, p) => sum + (p.netSalary || 0),
        0
      );

      stats = {
        totalCompanies: 1, // Only showing one company
        totalUsers,
        activeCompanies: company.isActive ? 1 : 0,
        systemRevenue,
      };
    } else {
      // Global view - all companies
      const totalCompanies = await prisma.company.count();
      
      const activeCompanies = await prisma.company.count({
        where: {
          isActive: true,
        },
      });

      // Count all users (excluding super admins)
      const totalUsers = await prisma.user.count({
        where: {
          role: {
            not: UserRole.SUPER_ADMIN,
          },
          isActive: true,
        },
      });

      // Calculate monthly payroll across all companies
      const monthlyPayrollRecords = await prisma.payroll.findMany({
        where: {
          month: currentMonth,
          year: currentYear,
        },
      });

      const systemRevenue = monthlyPayrollRecords.reduce(
        (sum, p) => sum + (p.netSalary || 0),
        0
      );

      stats = {
        totalCompanies,
        totalUsers,
        activeCompanies,
        systemRevenue,
      };
    }

    return NextResponse.json({ stats });
  } catch (error) {
    console.error('Get super admin stats error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch statistics' },
      { status: 500 }
    );
  }
}
