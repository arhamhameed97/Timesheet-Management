import { NextRequest, NextResponse } from 'next/server';
import { getAuthContext, unauthorizedResponse, forbiddenResponse } from '@/lib/middleware-helpers';
import { prisma } from '@/lib/db';
import { createOvertimeConfigSchema } from '@/lib/validations';
import { UserRole } from '@prisma/client';
import { canManageUser } from '@/lib/permissions';

export async function POST(request: NextRequest) {
  try {
    const context = await getAuthContext(request);
    if (!context) {
      return unauthorizedResponse();
    }

    // Only super admin, company admin, and managers can create overtime configs
    const allowedRoles: UserRole[] = [UserRole.SUPER_ADMIN, UserRole.COMPANY_ADMIN, UserRole.MANAGER];
    if (!allowedRoles.includes(context.role)) {
      return forbiddenResponse('You do not have permission to create overtime configurations');
    }

    const body = await request.json();
    const validationResult = createOvertimeConfigSchema.safeParse(body);
    
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
        return forbiddenResponse('You cannot create overtime configurations for this user');
      }
    }

    // Check if config already exists
    const existing = await prisma.overtimeConfig.findUnique({
      where: { userId: validatedData.userId },
    });

    if (existing) {
      return NextResponse.json(
        { error: 'Overtime configuration already exists for this user. Use PATCH to update.' },
        { status: 400 }
      );
    }

    const overtimeConfig = await prisma.overtimeConfig.create({
      data: {
        userId: validatedData.userId,
        weeklyThresholdHours: validatedData.weeklyThresholdHours,
        overtimeMultiplier: validatedData.overtimeMultiplier,
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

    return NextResponse.json({ overtimeConfig }, { status: 201 });
  } catch (error: any) {
    if (error.name === 'ZodError') {
      return NextResponse.json(
        { error: 'Validation error', details: error.errors },
        { status: 400 }
      );
    }

    console.error('Create overtime config error:', error);
    return NextResponse.json(
      { error: 'Failed to create overtime configuration' },
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

    const where: any = {};

    // Determine which overtime configs the user can see
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
          return forbiddenResponse('You do not have permission to view this overtime configuration');
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
      // Employees can only see their own overtime config
      where.userId = context.userId;
    }

    const overtimeConfigs = await prisma.overtimeConfig.findMany({
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
    });

    return NextResponse.json({ overtimeConfigs });
  } catch (error) {
    console.error('Get overtime configs error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch overtime configurations' },
      { status: 500 }
    );
  }
}
