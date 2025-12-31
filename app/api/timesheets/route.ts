import { NextRequest, NextResponse } from 'next/server';
import { getAuthContext, unauthorizedResponse, forbiddenResponse } from '@/lib/middleware-helpers';
import { prisma } from '@/lib/db';
import { createTimesheetSchema, updateTimesheetSchema } from '@/lib/validations';
import { UserRole, TimesheetStatus } from '@prisma/client';
import { canManageUser } from '@/lib/permissions';

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
    const status = searchParams.get('status') as TimesheetStatus | null;

    let targetUserId = context.userId;

    // If userId is provided, check permissions
    if (userId && userId !== context.userId) {
      const canView = await canManageUser(context, userId);
      if (!canView) {
        return forbiddenResponse('You do not have permission to view this timesheet');
      }
      targetUserId = userId;
    }

    const where: any = { userId: targetUserId };
    if (status) where.status = status;

    if (startDate && endDate) {
      where.date = {
        gte: new Date(startDate),
        lte: new Date(endDate),
      };
    } else if (startDate) {
      where.date = { gte: new Date(startDate) };
    } else if (endDate) {
      where.date = { lte: new Date(endDate) };
    }

    const timesheets = await prisma.timesheet.findMany({
      where,
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
      orderBy: { date: 'desc' },
    });

    return NextResponse.json({ timesheets });
  } catch (error) {
    console.error('Get timesheets error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch timesheets' },
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

    const body = await request.json();
    const validatedData = createTimesheetSchema.parse(body);

    // Check if timesheet already exists for this date
    const date = new Date(validatedData.date);
    date.setHours(0, 0, 0, 0);

    const existing = await prisma.timesheet.findUnique({
      where: {
        userId_date: {
          userId: context.userId,
          date,
        },
      },
    });

    if (existing) {
      return NextResponse.json(
        { error: 'Timesheet already exists for this date' },
        { status: 400 }
      );
    }

    const timesheet = await prisma.timesheet.create({
      data: {
        userId: context.userId,
        date,
        hours: validatedData.hours,
        notes: validatedData.notes || undefined,
        status: TimesheetStatus.DRAFT,
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        taskLogs: true,
      },
    });

    return NextResponse.json({ timesheet }, { status: 201 });
  } catch (error: any) {
    if (error.name === 'ZodError') {
      return NextResponse.json(
        { error: 'Validation error', details: error.errors },
        { status: 400 }
      );
    }

    console.error('Create timesheet error:', error);
    return NextResponse.json(
      { error: 'Failed to create timesheet' },
      { status: 500 }
    );
  }
}












