import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { getAuthContext, unauthorizedResponse, forbiddenResponse, badRequestResponse } from '@/lib/middleware-helpers';
import { prisma } from '@/lib/db';
import { createEmployeeSchema, updateEmployeeSchema } from '@/lib/validations';
import { UserRole } from '@prisma/client';
import { canManageUser, canAccessCompany } from '@/lib/permissions';
import { validateCompanyActive, getCompanyDetails } from '@/lib/company-helpers';

export async function GET(request: NextRequest) {
  try {
    const context = await getAuthContext(request);
    if (!context) {
      return unauthorizedResponse();
    }

    const { searchParams } = new URL(request.url);
    const companyId = searchParams.get('companyId');
    const role = searchParams.get('role') as UserRole | null;
    const attendanceDate = searchParams.get('attendanceDate'); // Date for filtering attendance

    // Super admin can see all employees or filter by company
    if (context.role === UserRole.SUPER_ADMIN) {
      const where: any = {};
      if (companyId) where.companyId = companyId;
      if (role) where.role = role;

      const employees = await prisma.user.findMany({
        where,
        include: {
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
          _count: {
            select: {
              subordinates: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      });

      // Remove passwords
      const employeesWithoutPasswords = employees.map(({ password, ...rest }) => rest);

      return NextResponse.json({ employees: employeesWithoutPasswords });
    }

    // Others can only see employees in their company
    if (!context.companyId) {
      return NextResponse.json({ employees: [] });
    }

    const where: any = { companyId: context.companyId };
    if (role) where.role = role;

    // Managers can see all employees in their company (permission matrix allows this)
    // Note: They can manage only subordinates, but can view all company employees
    // No additional filtering needed for managers - they see all company employees

    // Team leads can see team members
    if (context.role === UserRole.TEAM_LEAD) {
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
      const memberIds = teamMembers.map(t => t.userId);
      memberIds.push(context.userId);
      
      where.id = { in: memberIds };
    }

    // Employees can only see themselves
    if (context.role === UserRole.EMPLOYEE) {
      where.id = context.userId;
    }

    const employees = await prisma.user.findMany({
      where,
      include: {
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
        _count: {
          select: {
            subordinates: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Get date for attendance stats - use provided date or default to today
    const attendanceDateObj = attendanceDate ? new Date(attendanceDate) : new Date();
    attendanceDateObj.setHours(0, 0, 0, 0);
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0, 23, 59, 59);

    // Get employee IDs for attendance and timesheet queries
    const employeeIds = employees.map(e => e.id);

    // Fetch attendance stats for all employees (monthly stats)
    const attendanceStats = await prisma.attendance.groupBy({
      by: ['userId'],
      where: {
        userId: { in: employeeIds },
        date: {
          gte: startOfMonth,
          lte: endOfMonth,
        },
      },
      _count: {
        id: true,
      },
    });

    // Fetch attendance status for the specified date (or today if not specified)
    const dateAttendance = await prisma.attendance.findMany({
      where: {
        userId: { in: employeeIds },
        date: attendanceDateObj,
      },
      select: {
        userId: true,
        checkInTime: true,
        checkOutTime: true,
        status: true,
        notes: true, // Include notes for check-in/check-out history
      },
    });

    // Fetch pending timesheets count per employee
    const pendingTimesheets = await prisma.timesheet.groupBy({
      by: ['userId'],
      where: {
        userId: { in: employeeIds },
        status: 'SUBMITTED',
      },
      _count: {
        id: true,
      },
    });

    // Create maps for quick lookup
    const attendanceMap = new Map(attendanceStats.map(s => [s.userId, s._count.id]));
    const dateAttendanceMap = new Map(
      dateAttendance.map(a => [
        a.userId,
        {
          checkedIn: !!a.checkInTime,
          checkedOut: !!a.checkOutTime,
          status: a.status,
          checkInTime: a.checkInTime?.toISOString() || null,
          checkOutTime: a.checkOutTime?.toISOString() || null,
          notes: a.notes,
        },
      ])
    );
    const pendingTimesheetsMap = new Map(pendingTimesheets.map(t => [t.userId, t._count.id]));

    // Remove passwords and add stats
    const employeesWithStats = employees.map(({ password, ...rest }) => ({
      ...rest,
      attendanceStats: {
        daysWorkedThisMonth: attendanceMap.get(rest.id) || 0,
        todayStatus: dateAttendanceMap.get(rest.id) || { 
          checkedIn: false, 
          checkedOut: false, 
          status: null,
          checkInTime: null,
          checkOutTime: null,
          notes: null,
        },
        pendingTimesheets: pendingTimesheetsMap.get(rest.id) || 0,
      },
    }));

    return NextResponse.json({ employees: employeesWithStats });
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
    console.log('[POST /api/employees] Request received');
    const context = await getAuthContext(request);
    if (!context) {
      console.log('[POST /api/employees] Unauthorized - no context');
      return unauthorizedResponse();
    }
    
    console.log('[POST /api/employees] Context:', { userId: context.userId, role: context.role, companyId: context.companyId });

    // Only super admin, company admin, and managers can create employees
    const allowedRoles: UserRole[] = [UserRole.SUPER_ADMIN, UserRole.COMPANY_ADMIN, UserRole.MANAGER];
    if (!allowedRoles.includes(context.role)) {
      return forbiddenResponse('You do not have permission to create employees');
    }

    const body = await request.json();
    
    // Clean up empty strings - convert to undefined
    const cleanedBody: Record<string, any> = Object.fromEntries(
      Object.entries(body).filter(([_, v]) => v !== '' && v !== null)
    );
    
    const validatedData = createEmployeeSchema.parse(cleanedBody);

    // Determine company ID based on role
    let companyId: string | null = null;
    
    if (context.role === UserRole.SUPER_ADMIN) {
      // Super admin must provide companyId explicitly
      const providedCompanyId: string | undefined = validatedData.companyId || (cleanedBody.companyId as string | undefined);
      if (!providedCompanyId) {
        return badRequestResponse('Company ID is required for super admin');
      }
      companyId = providedCompanyId;
    } else {
      // Company admin and managers use their own companyId from context
      companyId = context.companyId || null;
      
      // Prevent non-super-admins from overriding company
      if (cleanedBody.companyId && cleanedBody.companyId !== context.companyId) {
        return forbiddenResponse('You cannot assign employees to a different company');
      }
    }

    if (!companyId) {
      return badRequestResponse('Company ID is required');
    }

    // Validate company exists and is active
    const companyValidation = await validateCompanyActive(companyId);
    if (!companyValidation.exists) {
      return NextResponse.json(
        { error: 'Company not found' },
        { status: 404 }
      );
    }
    
    if (!companyValidation.isActive) {
      return NextResponse.json(
        { error: 'Company account is inactive. Cannot create employees for inactive companies.' },
        { status: 403 }
      );
    }

    // Check access to company
    if (!canAccessCompany(context, companyId)) {
      return forbiddenResponse('You cannot assign employees to this company');
    }

    // Check if email already exists
    const existingUser = await prisma.user.findUnique({
      where: { email: validatedData.email },
    });

    if (existingUser) {
      return NextResponse.json(
        { error: 'User with this email already exists' },
        { status: 400 }
      );
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(validatedData.password, 10);

    // Validate manager if provided
    if (validatedData.managerId) {
      const canManage = await canManageUser(context, validatedData.managerId);
      if (!canManage && context.role !== UserRole.SUPER_ADMIN && context.role !== UserRole.COMPANY_ADMIN) {
        return forbiddenResponse('You cannot assign this manager');
      }
    }

    // Set default role if not provided
    const role = validatedData.role || UserRole.EMPLOYEE;

    // Get company details for response
    const companyDetails = await getCompanyDetails(companyId);

    // Create employee in transaction to ensure atomicity
    const employee = await prisma.$transaction(async (tx) => {
      const newEmployee = await tx.user.create({
        data: {
          name: validatedData.name,
          email: validatedData.email,
          password: hashedPassword,
          companyId,
          designationId: validatedData.designationId || null,
          role,
          managerId: validatedData.managerId || null,
          phone: validatedData.phone || null,
        },
        include: {
          company: {
            select: {
              id: true,
              name: true,
              email: true,
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

      return newEmployee;
    });

    const { password, ...employeeWithoutPassword } = employee;

    return NextResponse.json(
      {
        employee: employeeWithoutPassword,
        message: `Employee successfully created and assigned to ${companyDetails?.name || 'company'}`,
        company: {
          id: companyDetails?.id,
          name: companyDetails?.name,
        },
      },
      { status: 201 }
    );
  } catch (error: any) {
    if (error.name === 'ZodError') {
      return NextResponse.json(
        { error: 'Validation error', details: error.errors },
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




