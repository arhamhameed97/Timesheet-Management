import { NextRequest, NextResponse } from 'next/server';
import { getAuthContext, unauthorizedResponse, forbiddenResponse } from '@/lib/middleware-helpers';
import { prisma } from '@/lib/db';
import { createEmployeeSchema } from '@/lib/validations';
import { UserRole, TimesheetStatus } from '@prisma/client';
import { canManageUser } from '@/lib/permissions';
import { startOfDay, endOfDay, startOfMonth, endOfMonth } from 'date-fns';
import bcrypt from 'bcryptjs';

export async function GET(request: NextRequest) {
  try {
    const context = await getAuthContext(request);
    if (!context) {
      return unauthorizedResponse();
    }

    const { searchParams } = new URL(request.url);
    const attendanceDate = searchParams.get('attendanceDate');

    let where: any = {};

    // Determine which employees the user can see
    if (context.role === UserRole.SUPER_ADMIN) {
      // Super admin can see all employees except other super admins
      where.role = {
        not: UserRole.SUPER_ADMIN,
      };
      where.isActive = true;
    } else if (context.role === UserRole.COMPANY_ADMIN || context.role === UserRole.MANAGER || context.role === UserRole.TEAM_LEAD) {
      // Company admin, manager, or team lead can see employees in their company
      if (!context.companyId) {
        return NextResponse.json(
          { error: 'Company ID not found' },
          { status: 400 }
        );
      }
      where.companyId = context.companyId;
      where.isActive = true;
    } else {
      // Employees can only see themselves
      where.id = context.userId;
    }

    // Fetch employees
    const employees = await prisma.user.findMany({
      where,
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        isActive: true,
        company: {
          select: {
            id: true,
            name: true,
          },
        },
        designation: {
          select: {
            id: true,
            name: true,
          },
        },
        manager: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
      orderBy: {
        name: 'asc',
      },
    });

    // If attendanceDate is provided, fetch attendance stats for each employee
    let employeesWithStats = employees;
    if (attendanceDate) {
      const date = new Date(attendanceDate);
      const dayStart = startOfDay(date);
      const dayEnd = endOfDay(date);
      const monthStart = startOfMonth(date);
      const monthEnd = endOfMonth(date);

      const employeeIds = employees.map((e) => e.id);

      // Fetch today's attendance for all employees
      const todayAttendance = await prisma.attendance.findMany({
        where: {
          userId: { in: employeeIds },
          date: {
            gte: dayStart,
            lte: dayEnd,
          },
        },
      });

      // Fetch this month's attendance count for each employee
      const monthAttendance = await prisma.attendance.groupBy({
        by: ['userId'],
        where: {
          userId: { in: employeeIds },
          date: {
            gte: monthStart,
            lte: monthEnd,
          },
          checkInTime: { not: null },
        },
        _count: {
          id: true,
        },
      });

      // Fetch pending timesheets count for each employee (SUBMITTED = pending approval)
      const pendingTimesheets = await prisma.timesheet.groupBy({
        by: ['userId'],
        where: {
          userId: { in: employeeIds },
          status: TimesheetStatus.SUBMITTED,
        },
        _count: {
          id: true,
        },
      });

      // Create maps for quick lookup
      const attendanceMap = new Map(
        todayAttendance.map((a) => [a.userId, a])
      );
      const monthAttendanceMap = new Map(
        monthAttendance.map((a) => [a.userId, a._count.id])
      );
      const pendingTimesheetsMap = new Map(
        pendingTimesheets.map((t) => [t.userId, t._count.id])
      );

      // Add attendance stats to each employee
      employeesWithStats = employees.map((employee) => {
        const attendance = attendanceMap.get(employee.id);
        const daysWorkedThisMonth = monthAttendanceMap.get(employee.id) || 0;
        const pendingTimesheetsCount = pendingTimesheetsMap.get(employee.id) || 0;

        return {
          ...employee,
          attendanceStats: {
            daysWorkedThisMonth,
            todayStatus: attendance
              ? {
                  checkedIn: !!attendance.checkInTime,
                  checkedOut: !!attendance.checkOutTime,
                  status: attendance.status,
                  checkInTime: attendance.checkInTime?.toISOString() || null,
                  checkOutTime: attendance.checkOutTime?.toISOString() || null,
                  notes: attendance.notes,
                }
              : {
                  checkedIn: false,
                  checkedOut: false,
                  status: null,
                  checkInTime: null,
                  checkOutTime: null,
                  notes: null,
                },
            pendingTimesheets: pendingTimesheetsCount,
          },
        };
      });
    }

    // Remove password field (shouldn't be in select, but just in case)
    const employeesWithoutPassword = employeesWithStats.map(({ password, ...rest }: any) => rest);

    return NextResponse.json({ employees: employeesWithoutPassword });
  } catch (error) {
    console.error('Get employees error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch employees' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const context = await getAuthContext(request);
    if (!context) {
      return unauthorizedResponse();
    }

    // Only super admin, company admin, and managers can create employees
    const allowedRoles: UserRole[] = [
      UserRole.SUPER_ADMIN,
      UserRole.COMPANY_ADMIN,
      UserRole.MANAGER,
    ];
    if (!allowedRoles.includes(context.role)) {
      return forbiddenResponse('You do not have permission to create employees');
    }

    const body = await request.json();
    const validationResult = createEmployeeSchema.safeParse(body);
    if (!validationResult.success) {
      return NextResponse.json(
        {
          error: 'Validation error',
          details: validationResult.error.errors,
        },
        { status: 400 }
      );
    }

    const validatedData = validationResult.data;

    // Check permissions based on role
    if (context.role === UserRole.SUPER_ADMIN) {
      // Super admin can create employees for any company
    } else {
      // Company admin and managers can only create employees in their company
      if (!context.companyId) {
        return NextResponse.json(
          { error: 'Company ID not found' },
          { status: 400 }
        );
      }

      // If companyId is provided, verify it matches the user's company
      if (validatedData.companyId && validatedData.companyId !== context.companyId) {
        return forbiddenResponse('You cannot create employees for other companies');
      }

      // Set companyId to user's company if not provided
      if (!validatedData.companyId) {
        validatedData.companyId = context.companyId;
      }
    }

    // Check if email already exists
    const existingUser = await prisma.user.findUnique({
      where: { email: validatedData.email },
    });

    if (existingUser) {
      return NextResponse.json(
        { error: 'Email already exists' },
        { status: 400 }
      );
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(validatedData.password, 10);

    // Create employee
    const employee = await prisma.user.create({
      data: {
        name: validatedData.name,
        email: validatedData.email,
        password: hashedPassword,
        role: validatedData.role || UserRole.EMPLOYEE,
        companyId: validatedData.companyId || null,
        designationId: validatedData.designationId || null,
        managerId: validatedData.managerId || null,
        paymentType: validatedData.paymentType || null,
        hourlyRate: validatedData.hourlyRate || null,
        monthlySalary: validatedData.monthlySalary || null,
        isActive: true,
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        isActive: true,
        company: {
          select: {
            id: true,
            name: true,
          },
        },
        designation: {
          select: {
            id: true,
            name: true,
          },
        },
        manager: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    return NextResponse.json({ employee }, { status: 201 });
  } catch (error: any) {
    if (error.code === 'P2002') {
      return NextResponse.json(
        { error: 'Email already exists' },
        { status: 400 }
      );
    }

    console.error('Create employee error:', error);
    return NextResponse.json(
      { error: 'Failed to create employee' },
      { status: 500 }
    );
  }
}
