import { NextRequest, NextResponse } from 'next/server';
import { getAuthContext, unauthorizedResponse } from '@/lib/middleware-helpers';
import { prisma } from '@/lib/db';
import { UserRole, TimesheetStatus } from '@prisma/client';
import { startOfDay, endOfDay, startOfMonth, endOfMonth } from 'date-fns';

export async function GET(request: NextRequest) {
  try {
    const context = await getAuthContext(request);
    if (!context) {
      return unauthorizedResponse();
    }

    const now = new Date();
    const todayStart = startOfDay(now);
    const todayEnd = endOfDay(now);
    const monthStart = startOfMonth(now);
    const monthEnd = endOfMonth(now);

    let totalEmployees = 0;
    let todayAttendance = 0;
    let pendingTimesheets = 0;
    let monthlyPayroll = 0;

    if (context.role === UserRole.SUPER_ADMIN) {
      // Super admin can see all companies
      totalEmployees = await prisma.user.count({
        where: {
          role: {
            not: UserRole.SUPER_ADMIN,
          },
          isActive: true,
        },
      });

      // Count today's attendance across all companies
      todayAttendance = await prisma.attendance.count({
        where: {
          date: {
            gte: todayStart,
            lte: todayEnd,
          },
          checkInTime: {
            not: null,
          },
        },
      });

      // Count pending timesheets across all companies (SUBMITTED = pending approval)
      pendingTimesheets = await prisma.timesheet.count({
        where: {
          status: TimesheetStatus.SUBMITTED,
        },
      });

      // Calculate monthly payroll across all companies
      const currentMonth = now.getMonth() + 1;
      const currentYear = now.getFullYear();
      const monthlyPayrollRecords = await prisma.payroll.findMany({
        where: {
          month: currentMonth,
          year: currentYear,
        },
      });
      monthlyPayroll = monthlyPayrollRecords.reduce(
        (sum, p) => sum + (p.netSalary || 0),
        0
      );
    } else if (context.role === UserRole.COMPANY_ADMIN || context.role === UserRole.MANAGER || context.role === UserRole.TEAM_LEAD) {
      // Company admin, manager, or team lead can see their company's stats
      if (!context.companyId) {
        return NextResponse.json(
          { error: 'Company ID not found' },
          { status: 400 }
        );
      }

      // Count employees in the company
      totalEmployees = await prisma.user.count({
        where: {
          companyId: context.companyId,
          isActive: true,
          role: {
            not: UserRole.SUPER_ADMIN,
          },
        },
      });

      // Get company employee IDs
      const companyEmployees = await prisma.user.findMany({
        where: {
          companyId: context.companyId,
          isActive: true,
        },
        select: {
          id: true,
        },
      });
      const employeeIds = companyEmployees.map((e) => e.id);

      // Count today's attendance for company employees
      todayAttendance = await prisma.attendance.count({
        where: {
          userId: {
            in: employeeIds,
          },
          date: {
            gte: todayStart,
            lte: todayEnd,
          },
          checkInTime: {
            not: null,
          },
        },
      });

      // Count pending timesheets for company employees (SUBMITTED = pending approval)
      pendingTimesheets = await prisma.timesheet.count({
        where: {
          userId: {
            in: employeeIds,
          },
          status: TimesheetStatus.SUBMITTED,
        },
      });

      // Calculate monthly payroll for company employees
      const currentMonth = now.getMonth() + 1;
      const currentYear = now.getFullYear();
      const monthlyPayrollRecords = await prisma.payroll.findMany({
        where: {
          userId: {
            in: employeeIds,
          },
          month: currentMonth,
          year: currentYear,
        },
      });
      monthlyPayroll = monthlyPayrollRecords.reduce(
        (sum, p) => sum + (p.netSalary || 0),
        0
      );
    } else {
      // Employee role - return limited stats
      totalEmployees = 1; // Just themselves
      
      // Check if employee checked in today
      const todayAttendanceRecord = await prisma.attendance.findFirst({
        where: {
          userId: context.userId,
          date: {
            gte: todayStart,
            lte: todayEnd,
          },
          checkInTime: {
            not: null,
          },
        },
      });
      todayAttendance = todayAttendanceRecord ? 1 : 0;

      // Count pending timesheets for the employee (SUBMITTED = pending approval)
      pendingTimesheets = await prisma.timesheet.count({
        where: {
          userId: context.userId,
          status: TimesheetStatus.SUBMITTED,
        },
      });

      // Get monthly payroll for the employee
      const currentMonth = now.getMonth() + 1;
      const currentYear = now.getFullYear();
      const monthlyPayrollRecord = await prisma.payroll.findFirst({
        where: {
          userId: context.userId,
          month: currentMonth,
          year: currentYear,
        },
      });
      monthlyPayroll = monthlyPayrollRecord?.netSalary || 0;
    }

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
