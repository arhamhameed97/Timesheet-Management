import { NextRequest, NextResponse } from 'next/server';
import { getAuthContext, unauthorizedResponse, forbiddenResponse } from '@/lib/middleware-helpers';
import { prisma } from '@/lib/db';
import { updateTaskSchema } from '@/lib/validations';
import { UserRole, TaskStatus } from '@prisma/client';
import { canManageUser } from '@/lib/permissions';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const context = await getAuthContext(request);
    if (!context) {
      return unauthorizedResponse();
    }

    const task = await prisma.task.findUnique({
      where: { id: params.id },
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
    });

    if (!task) {
      return NextResponse.json(
        { error: 'Task not found' },
        { status: 404 }
      );
    }

    // Check permissions - employees can only view tasks assigned to them
    if (context.role === UserRole.EMPLOYEE || context.role === UserRole.TEAM_LEAD) {
      const isAssignee = task.assignees.some((ta) => ta.userId === context.userId);
      if (!isAssignee) {
        return forbiddenResponse('You do not have permission to view this task');
      }
    }

    return NextResponse.json({ task });
  } catch (error) {
    console.error('Get task error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch task' },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const context = await getAuthContext(request);
    if (!context) {
      return unauthorizedResponse();
    }

    const body = await request.json();
    const validatedData = updateTaskSchema.parse(body);

    const task = await prisma.task.findUnique({
      where: { id: params.id },
      include: {
        assignees: true,
      },
    });

    if (!task) {
      return NextResponse.json(
        { error: 'Task not found' },
        { status: 404 }
      );
    }

    const isAssignee = task.assignees.some((ta) => ta.userId === context.userId);
    const isManager = (context.role === UserRole.SUPER_ADMIN || context.role === UserRole.COMPANY_ADMIN || context.role === UserRole.MANAGER);

    // Permission checks
    if (!isAssignee && !isManager) {
      return forbiddenResponse('You do not have permission to update this task');
    }

    // Status update validation
    if (validatedData.status) {
      // Employees can only set status to: PENDING, IN_PROGRESS, COMPLETED
      if (!isManager) {
        if (!['PENDING', 'IN_PROGRESS', 'COMPLETED'].includes(validatedData.status)) {
          return forbiddenResponse('You can only set status to PENDING, IN_PROGRESS, or COMPLETED');
        }
        // Employees cannot change status if task is APPROVED
        if (task.status === TaskStatus.APPROVED) {
          return forbiddenResponse('Cannot change status of an approved task');
        }
        // Employees can change COMPLETED back to IN_PROGRESS or PENDING (if not approved)
        if (task.status === TaskStatus.COMPLETED && validatedData.status !== TaskStatus.COMPLETED) {
          // Allow changing back
        }
      } else {
        // Managers/admins can approve completed tasks
        if (validatedData.status === TaskStatus.APPROVED) {
          if (task.status !== TaskStatus.COMPLETED) {
            return NextResponse.json(
              { error: 'Can only approve completed tasks' },
              { status: 400 }
            );
          }
        }
        // Managers can change APPROVED back to COMPLETED
      }
    }

    // Handle approval
    if (validatedData.approve === true) {
      if (!isManager) {
        return forbiddenResponse('Only managers and admins can approve tasks');
      }
      if (task.status !== TaskStatus.COMPLETED) {
        return NextResponse.json(
          { error: 'Can only approve completed tasks' },
          { status: 400 }
        );
      }
      validatedData.status = TaskStatus.APPROVED;
    }

    // Update task
    const updateData: any = {};
    if (validatedData.status) {
      updateData.status = validatedData.status;
      if (validatedData.status === TaskStatus.APPROVED) {
        updateData.approvedBy = context.userId;
        updateData.approvedAt = new Date();
      }
    }
    if (validatedData.description !== undefined) {
      updateData.description = validatedData.description;
    }
    if (validatedData.dueDate) {
      updateData.dueDate = new Date(validatedData.dueDate);
    }
    if (validatedData.priority) {
      updateData.priority = validatedData.priority;
    }

    // Update assignee completion status
    if (validatedData.status === TaskStatus.COMPLETED && isAssignee) {
      await prisma.taskAssignee.updateMany({
        where: {
          taskId: params.id,
          userId: context.userId,
        },
        data: {
          completedAt: new Date(),
        },
      });
    } else if (validatedData.status && validatedData.status !== TaskStatus.COMPLETED && isAssignee) {
      // If changing from COMPLETED to something else, clear completedAt
      await prisma.taskAssignee.updateMany({
        where: {
          taskId: params.id,
          userId: context.userId,
        },
        data: {
          completedAt: null,
        },
      });
    }

    const updated = await prisma.task.update({
      where: { id: params.id },
      data: updateData,
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
    });

    return NextResponse.json({ task: updated });
  } catch (error: any) {
    if (error.name === 'ZodError') {
      return NextResponse.json(
        { error: 'Validation error', details: error.errors },
        { status: 400 }
      );
    }

    console.error('Update task error:', error);
    return NextResponse.json(
      { error: 'Failed to update task' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const context = await getAuthContext(request);
    if (!context) {
      return unauthorizedResponse();
    }

    // Only managers and admins can delete tasks
    const allowedRoles: UserRole[] = [
      UserRole.SUPER_ADMIN,
      UserRole.COMPANY_ADMIN,
      UserRole.MANAGER,
    ];
    if (!allowedRoles.includes(context.role)) {
      return forbiddenResponse('You do not have permission to delete tasks');
    }

    const task = await prisma.task.findUnique({
      where: { id: params.id },
    });

    if (!task) {
      return NextResponse.json(
        { error: 'Task not found' },
        { status: 404 }
      );
    }

    // Cannot delete approved tasks
    if (task.status === TaskStatus.APPROVED) {
      return NextResponse.json(
        { error: 'Cannot delete approved tasks' },
        { status: 400 }
      );
    }

    await prisma.task.delete({
      where: { id: params.id },
    });

    return NextResponse.json({ message: 'Task deleted successfully' });
  } catch (error) {
    console.error('Delete task error:', error);
    return NextResponse.json(
      { error: 'Failed to delete task' },
      { status: 500 }
    );
  }
}

