import { NextRequest, NextResponse } from 'next/server';
import { getAuthContext, unauthorizedResponse, forbiddenResponse } from '@/lib/middleware-helpers';
import { prisma } from '@/lib/db';
import { updateTimesheetSchema } from '@/lib/validations';
import { UserRole, TimesheetStatus } from '@prisma/client';
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

    const timesheet = await prisma.timesheet.findUnique({
      where: { id: params.id },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        taskLogs: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
        approver: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    if (!timesheet) {
      return NextResponse.json(
        { error: 'Timesheet not found' },
        { status: 404 }
      );
    }

    // Check permissions
    if (timesheet.userId !== context.userId) {
      const canView = await canManageUser(context, timesheet.userId);
      if (!canView) {
        return forbiddenResponse('You do not have permission to view this timesheet');
      }
    }

    return NextResponse.json({ timesheet });
  } catch (error) {
    console.error('Get timesheet error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch timesheet' },
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
    const validatedData = updateTimesheetSchema.parse(body);

    const timesheet = await prisma.timesheet.findUnique({
      where: { id: params.id },
    });

    if (!timesheet) {
      return NextResponse.json(
        { error: 'Timesheet not found' },
        { status: 404 }
      );
    }

    // Check permissions
    const canEdit = timesheet.userId === context.userId ||
      await canManageUser(context, timesheet.userId);

    if (!canEdit) {
      return forbiddenResponse('You do not have permission to edit this timesheet');
    }

    // Employees can only edit draft timesheets
    if (context.role === UserRole.EMPLOYEE && timesheet.userId === context.userId) {
      if (timesheet.status !== TimesheetStatus.DRAFT) {
        return NextResponse.json(
          { error: 'You can only edit draft timesheets' },
          { status: 400 }
        );
      }
      // Employees cannot change status
      delete (validatedData as any).status;
    }

    // Only managers/admins can approve/reject
    if (validatedData.status === TimesheetStatus.APPROVED || 
        validatedData.status === TimesheetStatus.REJECTED) {
      const allowedRoles: UserRole[] = [UserRole.SUPER_ADMIN, UserRole.COMPANY_ADMIN, UserRole.MANAGER, UserRole.TEAM_LEAD];
      if (!allowedRoles.includes(context.role)) {
        return forbiddenResponse('You do not have permission to approve/reject timesheets');
      }
    }

    const updateData: any = { ...validatedData };
    
    // Set approver and approval time if approving/rejecting
    if (validatedData.status === TimesheetStatus.APPROVED || 
        validatedData.status === TimesheetStatus.REJECTED) {
      updateData.approvedBy = context.userId;
      updateData.approvedAt = new Date();
    }

    const updated = await prisma.timesheet.update({
      where: { id: params.id },
      data: updateData,
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        taskLogs: true,
        approver: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    return NextResponse.json({ timesheet: updated });
  } catch (error: any) {
    if (error.name === 'ZodError') {
      return NextResponse.json(
        { error: 'Validation error', details: error.errors },
        { status: 400 }
      );
    }

    console.error('Update timesheet error:', error);
    return NextResponse.json(
      { error: 'Failed to update timesheet' },
      { status: 500 }
    );
  }
}



