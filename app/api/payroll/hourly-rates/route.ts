import { NextRequest, NextResponse } from 'next/server';
import { getAuthContext, unauthorizedResponse, forbiddenResponse } from '@/lib/middleware-helpers';
import { prisma } from '@/lib/db';
import { createHourlyRatePeriodSchema } from '@/lib/validations';
import { UserRole } from '@prisma/client';
import { canManageUser } from '@/lib/permissions';

export async function POST(request: NextRequest) {
  try {
    const context = await getAuthContext(request);
    if (!context) {
      return unauthorizedResponse();
    }

    // Only super admin, company admin, and managers can create hourly rate periods
    const allowedRoles: UserRole[] = [UserRole.SUPER_ADMIN, UserRole.COMPANY_ADMIN, UserRole.MANAGER];
    if (!allowedRoles.includes(context.role)) {
      return forbiddenResponse('You do not have permission to create hourly rate periods');
    }

    const body = await request.json();
    const validationResult = createHourlyRatePeriodSchema.safeParse(body);
    
    if (!validationResult.success) {
      return NextResponse.json(
        { error: 'Validation error', details: validationResult.error.errors },
        { status: 400 }
      );
    }

    const validatedData = validationResult.data;

    // Check permissions
    if (context.role === UserRole.SUPER_ADMIN) {
      // Super admin can create for anyone
    } else {
      const targetUser = await prisma.user.findUnique({
        where: { id: validatedData.userId },
        select: { companyId: true },
      });

      if (!targetUser) {
        return NextResponse.json(
          { error: 'Employee not found' },
          { status: 404 }
        );
      }

      if (targetUser.companyId !== context.companyId) {
        return forbiddenResponse('You cannot create hourly rate periods for this user');
      }
    }

    // Check for overlapping periods
    const startDate = new Date(validatedData.startDate);
    const endDate = new Date(validatedData.endDate);

    const overlapping = await prisma.hourlyRatePeriod.findFirst({
      where: {
        userId: validatedData.userId,
        OR: [
          {
            startDate: { lte: endDate },
            endDate: { gte: startDate },
          },
        ],
      },
    });

    if (overlapping) {
      return NextResponse.json(
        { error: 'Hourly rate period overlaps with an existing period' },
        { status: 400 }
      );
    }

    const hourlyRatePeriod = await prisma.hourlyRatePeriod.create({
      data: {
        userId: validatedData.userId,
        startDate,
        endDate,
        hourlyRate: validatedData.hourlyRate,
        createdBy: context.userId,
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        creator: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    return NextResponse.json({ hourlyRatePeriod }, { status: 201 });
  } catch (error: any) {
    if (error.name === 'ZodError') {
      return NextResponse.json(
        { error: 'Validation error', details: error.errors },
        { status: 400 }
      );
    }

    console.error('Create hourly rate period error:', error);
    return NextResponse.json(
      { error: 'Failed to create hourly rate period' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const context = await getAuthContext(request);
    if (!context) {
      return unauthorizedResponse();
    }

    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    const where: any = {};

    // Determine which hourly rate periods the user can see
    if (context.role === UserRole.SUPER_ADMIN) {
      if (userId) {
        where.userId = userId;
      }
    } else if (context.role === UserRole.COMPANY_ADMIN || context.role === UserRole.MANAGER) {
      if (userId) {
        const targetUser = await prisma.user.findUnique({
          where: { id: userId },
          select: { companyId: true },
        });
        if (!targetUser || targetUser.companyId !== context.companyId) {
          return forbiddenResponse('You do not have permission to view this hourly rate period');
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
      // Employees can only see their own hourly rate periods
      where.userId = context.userId;
    }

    // Apply date filters
    if (startDate) {
      where.endDate = { gte: new Date(startDate) };
    }
    if (endDate) {
      where.startDate = { lte: new Date(endDate) };
    }

    const hourlyRatePeriods = await prisma.hourlyRatePeriod.findMany({
      where,
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        creator: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
      orderBy: {
        startDate: 'desc',
      },
    });

    return NextResponse.json({ hourlyRatePeriods });
  } catch (error) {
    console.error('Get hourly rate periods error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch hourly rate periods' },
      { status: 500 }
    );
  }
}
