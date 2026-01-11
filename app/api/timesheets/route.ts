import { NextRequest, NextResponse } from 'next/server';
import { getAuthContext, unauthorizedResponse, forbiddenResponse } from '@/lib/middleware-helpers';
import { prisma } from '@/lib/db';
import { createTimesheetSchema, updateTimesheetSchema } from '@/lib/validations';
import { UserRole, TimesheetStatus } from '@prisma/client';
import { canManageUser } from '@/lib/permissions';
import { getEnrichedTimesheetDataForPeriod } from '@/lib/timesheet-helpers';

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
    const month = searchParams.get('month');
    const year = searchParams.get('year');
    const status = searchParams.get('status') as TimesheetStatus | null;
    const enriched = searchParams.get('enriched') === 'true'; // Whether to return enriched data

    let targetUserId = context.userId;

    // If userId is provided, check permissions
    if (userId && userId !== context.userId) {
      const canView = await canManageUser(context, userId);
      if (!canView) {
        return forbiddenResponse('You do not have permission to view this timesheet');
      }
      targetUserId = userId;
    }

    // Calculate date range from month/year if provided
    let dateStart: Date | null = null;
    let dateEnd: Date | null = null;

    if (month && year) {
      const monthNum = parseInt(month, 10);
      const yearNum = parseInt(year, 10);
      dateStart = new Date(Date.UTC(yearNum, monthNum - 1, 1, 0, 0, 0, 0));
      dateEnd = new Date(Date.UTC(yearNum, monthNum, 0, 23, 59, 59, 999));
    } else if (startDate && endDate) {
      dateStart = new Date(startDate);
      dateEnd = new Date(endDate);
    } else if (startDate) {
      dateStart = new Date(startDate);
    } else if (endDate) {
      dateEnd = new Date(endDate);
    }

    // If enriched data is requested and we have a date range, use the helper function
    if (enriched && dateStart && dateEnd) {
      const enrichedData = await getEnrichedTimesheetDataForPeriod(
        targetUserId,
        dateStart,
        dateEnd
      );

      // Filter by status if provided
      let filteredTimesheets = enrichedData.timesheets;
      if (status) {
        filteredTimesheets = enrichedData.timesheets.filter(ts => ts.status === status);
      }

      return NextResponse.json({
        timesheets: filteredTimesheets,
        totals: enrichedData.totals,
      });
    }

    // Standard query without enrichment
    const where: any = { userId: targetUserId };
    if (status) where.status = status;

    if (dateStart && dateEnd) {
      where.date = {
        gte: dateStart,
        lte: dateEnd,
      };
    } else if (dateStart) {
      where.date = { gte: dateStart };
    } else if (dateEnd) {
      where.date = { lte: dateEnd };
    }

    const timesheets = await prisma.timesheet.findMany({
      where,
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            company: {
              select: {
                id: true,
                name: true,
              },
            },
            designation: {
              select: {
                id: true,
                name: true,
              },
            },
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
            email: true,
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
















