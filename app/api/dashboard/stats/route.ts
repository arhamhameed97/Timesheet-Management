import { NextRequest, NextResponse } from 'next/server';
import { getAuthContext, unauthorizedResponse } from '@/lib/middleware-helpers';
import { prisma } from '@/lib/db';
import { UserRole } from '@prisma/client';

export async function GET(request: NextRequest) {
  try {
    const context = await getAuthContext(request);
    if (!context) {
      return unauthorizedResponse();
    }

    // Get today's date (date only, no time) - use UTC to match attendance records
    const now = new Date();
    const today = new Date(Date.UTC(
      now.getUTCFullYear(),
      now.getUTCMonth(),
      now.getUTCDate()
    ));
    const currentMonth = now.getUTCMonth() + 1;
    const currentYear = now.getUTCFullYear();

    // Get employees the user can see (respects role-based permissions)
    let employeeIds: string[] | null = null;
    let whereEmployees: any = {};

    if (context.role === UserRole.SUPER_ADMIN) {
      // Super admin can see all employees - no filters needed
      whereEmployees = {};
    } else if (context.role === UserRole.COMPANY_ADMIN) {
      // Company admin can see all employees in their company
      whereEmployees = { companyId: context.companyId };
      // Get all employee IDs in the company
      const companyEmployees = await prisma.user.findMany({
        where: { companyId: context.companyId },
        select: { id: true },
      });
      employeeIds = companyEmployees.map(u => u.id);
    } else if (context.role === UserRole.MANAGER) {
      // Managers can see their subordinates and themselves
      const subordinates = await prisma.user.findMany({
        where: {
          OR: [
            { managerId: context.userId },
            { id: context.userId },
          ],
        },
        select: { id: true },
      });
      employeeIds = subordinates.map(u => u.id);
      whereEmployees = { id: { in: employeeIds } };
    } else if (context.role === UserRole.TEAM_LEAD) {
      // Team leads can see team members
      const teams = await prisma.teamMember.findMany({
        where: {
          userId: context.userId,
          role: 'LEAD',
        },
        select: { teamId: true },
      });
      const teamIds = teams.map(t => t.teamId);
      
      const teamMembers = await prisma.teamMember.findMany({
        where: {
          teamId: { in: teamIds },
        },
        select: { userId: true },
      });
      employeeIds = teamMembers.map(t => t.userId);
      employeeIds.push(context.userId);
      whereEmployees = { id: { in: employeeIds } };
    } else {
      // Employees can only see themselves
      employeeIds = [context.userId];
      whereEmployees = { id: context.userId };
    }

    // Get total employees count
    const totalEmployees = await prisma.user.count({
      where: whereEmployees,
    });

    // Get today's attendance count (employees who checked in today)
    const todayAttendance = await prisma.attendance.count({
      where: {
        date: today,
        checkInTime: { not: null },
        ...(employeeIds ? { userId: { in: employeeIds } } : {}),
      },
    });

    // Get pending timesheets count (SUBMITTED status)
    const pendingTimesheets = await prisma.timesheet.count({
      where: {
        status: 'SUBMITTED',
        ...(employeeIds ? { userId: { in: employeeIds } } : {}),
      },
    });

    // Get monthly payroll total
    const monthlyPayrollRecords = await prisma.payroll.findMany({
      where: {
        month: currentMonth,
        year: currentYear,
        ...(employeeIds ? { userId: { in: employeeIds } } : {}),
      },
      select: {
        netSalary: true,
      },
    });

    const monthlyPayroll = monthlyPayrollRecords.reduce(
      (sum, record) => sum + (record.netSalary || 0),
      0
    );

    return NextResponse.json({
      totalEmployees,
      todayAttendance,
      pendingTimesheets,
      monthlyPayroll,
    });
  } catch (error) {
    console.error('Get dashboard stats error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch dashboard stats' },
      { status: 500 }
    );
  }
}

