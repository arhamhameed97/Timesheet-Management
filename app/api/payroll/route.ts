import { NextRequest, NextResponse } from 'next/server';
import { getAuthContext, unauthorizedResponse, forbiddenResponse } from '@/lib/middleware-helpers';
import { prisma } from '@/lib/db';
import { createPayrollSchema, updatePayrollSchema } from '@/lib/validations';
import { UserRole, PayrollStatus } from '@prisma/client';
import { canManageUser, canAccessCompany } from '@/lib/permissions';

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

    let targetUserId = context.userId;

    // If userId is provided, check permissions
    if (userId && userId !== context.userId) {
      const canView = await canManageUser(context, userId);
      if (!canView) {
        return forbiddenResponse('You do not have permission to view this payroll');
      }
      targetUserId = userId;
    }

    const where: any = { userId: targetUserId };
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

    return NextResponse.json({ payroll });
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
    const validatedData = createPayrollSchema.parse(body);

    // Check if user can be managed
    const canManage = await canManageUser(context, validatedData.userId);
    if (!canManage && context.role !== UserRole.SUPER_ADMIN) {
      return forbiddenResponse('You cannot create payroll for this user');
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
    });

    if (existing) {
      return NextResponse.json(
        { error: 'Payroll already exists for this period' },
        { status: 400 }
      );
    }

    // Calculate net salary
    const netSalary = validatedData.baseSalary + 
      (validatedData.allowances || 0) - 
      (validatedData.deductions || 0);

    const payroll = await prisma.payroll.create({
      data: {
        userId: validatedData.userId,
        month: validatedData.month,
        year: validatedData.year,
        baseSalary: validatedData.baseSalary,
        allowances: validatedData.allowances || 0,
        deductions: validatedData.deductions || 0,
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

    return NextResponse.json({ payroll }, { status: 201 });
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



