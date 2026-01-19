import { NextRequest, NextResponse } from 'next/server';
import { getAuthContext, unauthorizedResponse, forbiddenResponse } from '@/lib/middleware-helpers';
import { prisma } from '@/lib/db';
import { createTaskSchema } from '@/lib/validations';
import { UserRole, TaskStatus } from '@prisma/client';
import { canManageUser } from '@/lib/permissions';

export async function POST(request: NextRequest) {
  try {
    const context = await getAuthContext(request);
    if (!context) {
      return unauthorizedResponse();
    }

    // Only managers, company admins, and super admins can create tasks
    const allowedRoles: UserRole[] = [
      UserRole.SUPER_ADMIN,
      UserRole.COMPANY_ADMIN,
      UserRole.MANAGER,
    ];
    
    // Debug logging
    if (process.env.NODE_ENV === 'development') {
      console.log('[Task Assignment] Context:', {
        userId: context.userId,
        role: context.role,
        companyId: context.companyId,
        allowedRoles,
        isAllowed: allowedRoles.includes(context.role),
      });
    }
    
    // Verify user role from database matches token
    const user = await prisma.user.findUnique({
      where: { id: context.userId },
      select: { role: true, companyId: true, isActive: true },
    });

    if (!user) {
      return unauthorizedResponse('User not found');
    }

    if (!user.isActive) {
      return forbiddenResponse('Your account is deactivated');
    }

    // Use role from database instead of token to ensure accuracy
    const userRole = user.role;
    
    if (!allowedRoles.includes(userRole)) {
      console.error('[Task Assignment] Permission denied:', {
        tokenRole: context.role,
        dbRole: userRole,
        allowedRoles,
        userId: context.userId,
        companyId: context.companyId,
        dbCompanyId: user.companyId,
      });
      return forbiddenResponse('You do not have permission to assign tasks');
    }

    const body = await request.json();
    const validatedData = createTaskSchema.parse(body);
    
    // Use companyId from database if token doesn't have it
    const effectiveCompanyId = context.companyId || user.companyId;

    // Verify all assignees belong to the same company (if user has company)
    if (effectiveCompanyId) {
      const assignees = await prisma.user.findMany({
        where: {
          id: { in: validatedData.assigneeIds },
          companyId: effectiveCompanyId,
        },
      });

      if (assignees.length !== validatedData.assigneeIds.length) {
        return NextResponse.json(
          { error: 'All assignees must belong to your company' },
          { status: 400 }
        );
      }
    }

    // Create task
    const task = await prisma.task.create({
      data: {
        title: validatedData.title,
        description: validatedData.description || null,
        assignedBy: context.userId,
        dueDate: new Date(validatedData.dueDate),
        priority: validatedData.priority,
        status: TaskStatus.PENDING,
        assignees: {
          create: validatedData.assigneeIds.map((userId) => ({
            userId,
          })),
        },
      },
      include: {
        creator: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        assignees: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
          },
        },
      },
    });

    return NextResponse.json({ task }, { status: 201 });
  } catch (error: any) {
    if (error.name === 'ZodError') {
      return NextResponse.json(
        { error: 'Validation error', details: error.errors },
        { status: 400 }
      );
    }

    console.error('Create task error:', error);
    return NextResponse.json(
      { error: 'Failed to create task' },
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
    const status = searchParams.get('status') as TaskStatus | null;
    const assigneeId = searchParams.get('assigneeId');
    const createdBy = searchParams.get('createdBy');

    let where: any = {};

    // Employees can only see tasks assigned to them
    if (context.role === UserRole.EMPLOYEE || context.role === UserRole.TEAM_LEAD) {
      where.assignees = {
        some: {
          userId: context.userId,
        },
      };
    } else if (context.role === UserRole.MANAGER || context.role === UserRole.COMPANY_ADMIN) {
      // Managers and company admins can see tasks in their company
      if (context.companyId) {
        where.creator = {
          companyId: context.companyId,
        };
      }
    }
    // Super admin can see all tasks

    // Additional filters
    if (status) {
      where.status = status;
    }

    if (assigneeId) {
      where.assignees = {
        some: {
          userId: assigneeId,
        },
      };
    }

    if (createdBy) {
      where.assignedBy = createdBy;
    }

    const tasks = await prisma.task.findMany({
      where,
      include: {
        creator: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        approver: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        assignees: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return NextResponse.json({ tasks });
  } catch (error) {
    console.error('Get tasks error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch tasks' },
      { status: 500 }
    );
  }
}

