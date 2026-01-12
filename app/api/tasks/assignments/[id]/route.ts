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
          
          // Check that all assignees have completed the task
          const allAssigneesCompleted = task.assignees.length > 0 && task.assignees.every(
            assignee => assignee.completedAt !== null
          );
          
          if (!allAssigneesCompleted) {
            return NextResponse.json(
              { error: 'All assignees must complete the task before approval' },
              { status: 400 }
            );
          }
        }
        // Managers can change APPROVED back to COMPLETED
      }
    }

    // Handle approval
    if (validatedData.approve === true || validatedData.status === TaskStatus.APPROVED) {
      if (!isManager) {
        return forbiddenResponse('Only managers and admins can approve tasks');
      }
      if (task.status !== TaskStatus.COMPLETED) {
        return NextResponse.json(
          { error: 'Can only approve completed tasks' },
          { status: 400 }
        );
      }
      
      // Check that all assignees have completed the task
      const allAssigneesCompleted = task.assignees.length > 0 && task.assignees.every(
        assignee => assignee.completedAt !== null
      );
      
      if (!allAssigneesCompleted) {
        return NextResponse.json(
          { error: 'All assignees must complete the task before approval' },
          { status: 400 }
        );
      }
      
      validatedData.status = TaskStatus.APPROVED;
    }

    // Permission check for editing title and assignees - only managers/admins can edit these
    if (validatedData.title !== undefined || validatedData.assigneeIds !== undefined) {
      if (!isManager) {
        return forbiddenResponse('Only managers and admins can edit task title and assignees');
      }
    }

    // Update task
    const updateData: any = {};
    
    // Handle status updates differently for employees vs managers
    if (validatedData.status) {
      // For employees marking completion: only update their individual completion, 
      // then check if all assignees completed to set task status
      if (!isManager && validatedData.status === TaskStatus.COMPLETED && isAssignee) {
        // Update individual assignee completion first
        await prisma.taskAssignee.updateMany({
          where: {
            taskId: params.id,
            userId: context.userId,
          },
          data: {
            completedAt: new Date(),
          },
        });
        
        // Fetch updated task to check all assignees
        const updatedTaskWithAssignees = await prisma.task.findUnique({
          where: { id: params.id },
          include: { assignees: true },
        });
        
        // Check if all assignees have completed
        if (updatedTaskWithAssignees && updatedTaskWithAssignees.assignees.length > 0) {
          const allAssigneesCompleted = updatedTaskWithAssignees.assignees.every(
            assignee => assignee.completedAt !== null
          );
          
          // Only set task status to COMPLETED if all assignees completed
          if (allAssigneesCompleted) {
            updateData.status = TaskStatus.COMPLETED;
          }
          // Otherwise, keep task status as IN_PROGRESS (don't change it)
        }
      } else if (!isManager && validatedData.status !== TaskStatus.COMPLETED && isAssignee) {
        // Employee changing status from COMPLETED to something else
        // Clear their completedAt
        await prisma.taskAssignee.updateMany({
          where: {
            taskId: params.id,
            userId: context.userId,
          },
          data: {
            completedAt: null,
          },
        });
        
        // Set task status back to IN_PROGRESS since not all are complete
        updateData.status = validatedData.status;
      } else {
        // Managers/admins can set status directly
        updateData.status = validatedData.status;
        if (validatedData.status === TaskStatus.APPROVED) {
          updateData.approvedBy = context.userId;
          updateData.approvedAt = new Date();
        }
      }
    }
    
    if (validatedData.title !== undefined) {
      updateData.title = validatedData.title;
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

    // Handle assignee updates
    if (validatedData.assigneeIds !== undefined) {
      const currentAssigneeIds = task.assignees.map(ta => ta.userId);
      const newAssigneeIds = validatedData.assigneeIds;
      
      // Find assignees to remove (in current but not in new)
      const assigneesToRemove = currentAssigneeIds.filter(id => !newAssigneeIds.includes(id));
      
      // Find assignees to add (in new but not in current)
      const assigneesToAdd = newAssigneeIds.filter(id => !currentAssigneeIds.includes(id));
      
      // Remove assignees
      if (assigneesToRemove.length > 0) {
        await prisma.taskAssignee.deleteMany({
          where: {
            taskId: params.id,
            userId: { in: assigneesToRemove },
          },
        });
      }
      
      // Add new assignees
      if (assigneesToAdd.length > 0) {
        await prisma.taskAssignee.createMany({
          data: assigneesToAdd.map(userId => ({
            taskId: params.id,
            userId,
          })),
        });
      }
      
      // If status changed from COMPLETED, clear completedAt for remaining assignees
      if (validatedData.status && validatedData.status !== TaskStatus.COMPLETED && task.status === TaskStatus.COMPLETED) {
        await prisma.taskAssignee.updateMany({
          where: {
            taskId: params.id,
            userId: { in: newAssigneeIds },
          },
          data: {
            completedAt: null,
          },
        });
      }
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

    // Managers and admins can delete any task, including approved ones
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

