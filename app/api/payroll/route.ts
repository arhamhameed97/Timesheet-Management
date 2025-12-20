import { NextRequest, NextResponse } from 'next/server';
import { getAuthContext, unauthorizedResponse, forbiddenResponse } from '@/lib/middleware-helpers';
import { prisma } from '@/lib/db';
import { createPayrollSchema, updatePayrollSchema } from '@/lib/validations';
import { UserRole, PayrollStatus, PaymentType, Prisma } from '@prisma/client';
import { canManageUser, canAccessCompany } from '@/lib/permissions';
import {
  calculateHoursWorked,
  calculateHourlyPay,
  calculateTotalBonuses,
  calculateTotalDeductions,
  calculateNetSalary,
  getEmployeePaymentInfo,
} from '@/lib/payroll-helpers';

export async function GET(request: NextRequest) {
  try {
    const context = await getAuthContext(request);
    if (!context) {
      return unauthorizedResponse();
    }

    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    const month = searchParams.get('month');
    const year = searchParams.get('year');
    const status = searchParams.get('status') as PayrollStatus | null;

    const where: any = {};

    // Determine which payrolls the user can see
    if (context.role === UserRole.SUPER_ADMIN) {
      // Super admin can see all payrolls
      // If userId is provided, filter by that user
      if (userId) {
        where.userId = userId;
      }
    } else if (context.role === UserRole.COMPANY_ADMIN || context.role === UserRole.MANAGER) {
      // Company admins and managers can see payrolls for employees in their company
      if (userId) {
        // If specific userId is requested, verify they're in the same company
        const targetUser = await prisma.user.findUnique({
          where: { id: userId },
          select: { companyId: true },
        });
        if (!targetUser || targetUser.companyId !== context.companyId) {
          return forbiddenResponse('You do not have permission to view this payroll');
        }
        where.userId = userId;
      } else {
        // Get all employees in the company
        const companyEmployees = await prisma.user.findMany({
          where: { companyId: context.companyId },
          select: { id: true },
        });
        const employeeIds = companyEmployees.map(e => e.id);
        where.userId = { in: employeeIds };
      }
    } else {
      // Employees can only see their own payrolls
      where.userId = context.userId;
    }

    // Apply additional filters
    if (month) where.month = parseInt(month);
    if (year) where.year = parseInt(year);
    if (status) where.status = status;

    const payroll = await prisma.payroll.findMany({
      where,
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
      orderBy: [
        { year: 'desc' },
        { month: 'desc' },
      ],
    });

    // Parse bonuses and deductions from JSON
    const payrollWithParsed = payroll.map((p) => ({
      ...p,
      bonuses: p.bonuses ? (typeof p.bonuses === 'string' ? JSON.parse(p.bonuses) : p.bonuses) : [],
      deductions: p.deductions ? (typeof p.deductions === 'string' ? JSON.parse(p.deductions) : p.deductions) : [],
    }));

    return NextResponse.json({ payroll: payrollWithParsed });
  } catch (error) {
    console.error('Get payroll error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch payroll' },
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

    // Only super admin, company admin, and managers can create payroll
    const allowedRoles: UserRole[] = [UserRole.SUPER_ADMIN, UserRole.COMPANY_ADMIN, UserRole.MANAGER];
    if (!allowedRoles.includes(context.role)) {
      return forbiddenResponse('You do not have permission to create payroll');
    }

    const body = await request.json();
    
    // Validate the request body
    const validationResult = createPayrollSchema.safeParse(body);
    if (!validationResult.success) {
      return NextResponse.json(
        { 
          error: 'Validation error', 
          details: validationResult.error.errors 
        },
        { status: 400 }
      );
    }
    
    const validatedData = validationResult.data;

    // Check permissions based on role
    if (context.role === UserRole.SUPER_ADMIN) {
      // Super admin can create payroll for anyone - no check needed
    } else {
      // Get target user info
      const targetUser = await prisma.user.findUnique({
        where: { id: validatedData.userId },
        select: { companyId: true, role: true },
      });

      if (!targetUser) {
        return NextResponse.json(
          { error: 'Employee not found' },
          { status: 404 }
        );
      }

      if (context.role === UserRole.COMPANY_ADMIN) {
        // Company admin can create payroll for any employee in their company
        if (targetUser.companyId !== context.companyId) {
          return forbiddenResponse('You cannot create payroll for this user');
        }
      } else if (context.role === UserRole.MANAGER) {
        // Managers can create payroll for any employee in their company
        // (They can see all employees in their company, so they should be able to create payroll for all)
        if (targetUser.companyId !== context.companyId) {
          return forbiddenResponse('You cannot create payroll for this user');
        }
      } else {
        return forbiddenResponse('You do not have permission to create payroll');
      }
    }

    // Check if payroll already exists for this period
    const existing = await prisma.payroll.findUnique({
      where: {
        userId_month_year: {
          userId: validatedData.userId,
          month: validatedData.month,
          year: validatedData.year,
        },
      },
      select: {
        id: true,
        userId: true,
        month: true,
        year: true,
      },
    });

    if (existing) {
      return NextResponse.json(
        { error: 'Payroll already exists for this period' },
        { status: 400 }
      );
    }

    // Get employee payment info
    const employeeInfo = await getEmployeePaymentInfo(validatedData.userId);
    if (!employeeInfo) {
      return NextResponse.json(
        { error: 'Employee not found' },
        { status: 404 }
      );
    }

    // Determine payment type (use provided or employee's default)
    const paymentType = validatedData.paymentType || employeeInfo.paymentType || PaymentType.SALARY;

    // Calculate base salary based on payment type
    let baseSalary = validatedData.baseSalary;
    let hoursWorked: number | null = null;
    let hourlyRate: number | null = null;

    if (paymentType === PaymentType.HOURLY) {
      // For hourly, calculate hours if not provided
      if (!validatedData.hoursWorked) {
        hoursWorked = await calculateHoursWorked(
          validatedData.userId,
          validatedData.month,
          validatedData.year
        );
      } else {
        hoursWorked = validatedData.hoursWorked;
      }

      // Use provided hourly rate or employee's default
      hourlyRate = validatedData.hourlyRate || employeeInfo.hourlyRate || 0;
      
      if (!hourlyRate || hourlyRate <= 0) {
        return NextResponse.json(
          { error: 'Hourly rate is required for hourly employees' },
          { status: 400 }
        );
      }

      // Calculate base salary from hours (ensure hours are positive)
      const positiveHours = hoursWorked > 0 ? hoursWorked : Math.abs(hoursWorked);
      baseSalary = calculateHourlyPay(positiveHours, hourlyRate);
      
      // Update hoursWorked to be positive if it was negative
      if (hoursWorked < 0) {
        hoursWorked = positiveHours;
      }
    } else {
      // For salary, use provided base salary or employee's monthly salary
      if (!baseSalary || baseSalary <= 0) {
        baseSalary = employeeInfo.monthlySalary || 0;
      }
      
      if (!baseSalary || baseSalary <= 0) {
        return NextResponse.json(
          { error: 'Base salary or monthly salary is required for salaried employees' },
          { status: 400 }
        );
      }
    }

    // Calculate totals for bonuses and deductions
    const bonuses = validatedData.bonuses || [];
    const deductions = validatedData.deductions || [];
    const totalBonuses = calculateTotalBonuses(bonuses);
    const totalDeductions = calculateTotalDeductions(deductions);

    // Calculate net salary
    const netSalary = calculateNetSalary(baseSalary, bonuses, deductions);

    const payroll = await prisma.payroll.create({
      data: {
        userId: validatedData.userId,
        month: validatedData.month,
        year: validatedData.year,
        paymentType,
        hoursWorked,
        hourlyRate,
        baseSalary,
        bonuses: bonuses.length > 0 ? bonuses : Prisma.JsonNull,
        deductions: deductions.length > 0 ? deductions : Prisma.JsonNull,
        totalBonuses,
        totalDeductions,
        netSalary,
        status: PayrollStatus.PENDING,
        notes: validatedData.notes || undefined,
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    // Parse bonuses and deductions for response
    const payrollResponse = {
      ...payroll,
      bonuses: payroll.bonuses ? (typeof payroll.bonuses === 'string' ? JSON.parse(payroll.bonuses as string) : payroll.bonuses) : [],
      deductions: payroll.deductions ? (typeof payroll.deductions === 'string' ? JSON.parse(payroll.deductions as string) : payroll.deductions) : [],
    };

    return NextResponse.json({ payroll: payrollResponse }, { status: 201 });
  } catch (error: any) {
    if (error.name === 'ZodError') {
      return NextResponse.json(
        { error: 'Validation error', details: error.errors },
        { status: 400 }
      );
    }

    console.error('Create payroll error:', error);
    return NextResponse.json(
      { error: 'Failed to create payroll' },
      { status: 500 }
    );
  }
}



