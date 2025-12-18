import { NextRequest, NextResponse } from 'next/server';
import { getAuthContext, unauthorizedResponse, forbiddenResponse } from '@/lib/middleware-helpers';
import { prisma } from '@/lib/db';
import { createTaskLogSchema } from '@/lib/validations';
import { canManageUser } from '@/lib/permissions';

export async function POST(request: NextRequest) {
  try {
    const context = await getAuthContext(request);
    if (!context) {
      return unauthorizedResponse();
    }

    const body = await request.json();
    const validatedData = createTaskLogSchema.parse(body);

    // Check if timesheet exists and user has access
    const timesheet = await prisma.timesheet.findUnique({
      where: { id: validatedData.timesheetId },
      include: { taskLogs: true },
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
      return forbiddenResponse('You do not have permission to add tasks to this timesheet');
    }

    // Calculate total hours
    const totalHours = timesheet.taskLogs.reduce((sum, log) => sum + log.hours, 0) + validatedData.hours;
    
    if (totalHours > 24) {
      return NextResponse.json(
        { error: 'Total task hours cannot exceed 24 hours' },
        { status: 400 }
      );
    }

    const taskLog = await prisma.taskLog.create({
      data: {
        timesheetId: validatedData.timesheetId,
        userId: context.userId,
        description: validatedData.description,
        hours: validatedData.hours,
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    return NextResponse.json({ taskLog }, { status: 201 });
  } catch (error: any) {
    if (error.name === 'ZodError') {
      return NextResponse.json(
        { error: 'Validation error', details: error.errors },
        { status: 400 }
      );
    }

    console.error('Create task log error:', error);
    return NextResponse.json(
      { error: 'Failed to create task log' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const context = await getAuthContext(request);
    if (!context) {
      return unauthorizedResponse();
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { error: 'Task log ID is required' },
        { status: 400 }
      );
    }

    const taskLog = await prisma.taskLog.findUnique({
      where: { id },
      include: {
        timesheet: true,
      },
    });

    if (!taskLog) {
      return NextResponse.json(
        { error: 'Task log not found' },
        { status: 404 }
      );
    }

    // Check permissions
    const canEdit = taskLog.userId === context.userId ||
      await canManageUser(context, taskLog.timesheet.userId);

    if (!canEdit) {
      return forbiddenResponse('You do not have permission to delete this task');
    }

    await prisma.taskLog.delete({
      where: { id },
    });

    return NextResponse.json({ message: 'Task log deleted successfully' });
  } catch (error) {
    console.error('Delete task log error:', error);
    return NextResponse.json(
      { error: 'Failed to delete task log' },
      { status: 500 }
    );
  }
}




