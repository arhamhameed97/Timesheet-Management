import { NextRequest, NextResponse } from 'next/server';
import { getAuthContext, unauthorizedResponse, forbiddenResponse } from '@/lib/middleware-helpers';
import { prisma } from '@/lib/db';
import { UserRole, TaskStatus, TaskType } from '@prisma/client';

const LEAVE_TASK_MARKER_REGEX = /\[LEAVE_REQUEST:([^\]]+)\]/;

function dedupeLeaveReviewTasks<T extends { id: string; description: string | null }>(tasks: T[]): T[] {
  const seenLeaveIds = new Set<string>();
  const deduped: T[] = [];

  for (const task of tasks) {
    const markerMatch = task.description?.match(LEAVE_TASK_MARKER_REGEX);
    const leaveId = markerMatch?.[1];

    if (!leaveId) {
      deduped.push(task);
      continue;
    }

    if (seenLeaveIds.has(leaveId)) {
      continue;
    }

    seenLeaveIds.add(leaveId);
    deduped.push(task);
  }

  return deduped;
}

export async function GET(request: NextRequest) {
  try {
    const context = await getAuthContext(request);
    if (!context) {
      return unauthorizedResponse();
    }

    // Only admins and managers can see pending tasks
    const allowedRoles: UserRole[] = [UserRole.SUPER_ADMIN, UserRole.COMPANY_ADMIN, UserRole.MANAGER];
    if (!allowedRoles.includes(context.role)) {
      return forbiddenResponse('You do not have permission to view pending tasks');
    }

    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '10');
    const includePayrollEdits = searchParams.get('includePayrollEdits') === 'true';

    let where: any = {
      status: {
        in: [TaskStatus.PENDING, TaskStatus.IN_PROGRESS, TaskStatus.COMPLETED],
      },
    };

    // Filter by company for non-super admins
    if (context.role !== UserRole.SUPER_ADMIN) {
      if (!context.companyId) {
        return NextResponse.json(
          { error: 'Company ID not found' },
          { status: 400 }
        );
      }

      // Tasks created by users in the company or assigned to the current user
      where.OR = [
        {
          creator: {
            companyId: context.companyId,
          },
        },
        {
          assignees: {
            some: {
              userId: context.userId,
            },
          },
        },
      ];
    }

    // For managers, also include tasks assigned to them
    if (context.role === UserRole.MANAGER) {
      where.OR = [
        ...(where.OR || []),
        {
          assignees: {
            some: {
              userId: context.userId,
            },
          },
        },
      ];
    }

    // Filter by task type if specified
    if (!includePayrollEdits) {
      where.type = TaskType.GENERAL;
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
        relatedPayroll: {
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
        relatedPayrollEditRequest: {
          include: {
            payroll: {
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
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    const dedupedTasks = dedupeLeaveReviewTasks(tasks);
    const limitedTasks = dedupedTasks.slice(0, limit);
    const pendingCount = dedupedTasks.filter((task) => task.status === TaskStatus.PENDING).length;
    const completedPendingApprovalCount = dedupedTasks.filter((task) => task.status === TaskStatus.COMPLETED).length;

    return NextResponse.json({
      tasks: limitedTasks,
      counts: {
        pending: pendingCount,
        completedPendingApproval: completedPendingApprovalCount,
        total: pendingCount + completedPendingApprovalCount,
      },
    });
  } catch (error) {
    console.error('Get pending tasks error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch pending tasks' },
      { status: 500 }
    );
  }
}
