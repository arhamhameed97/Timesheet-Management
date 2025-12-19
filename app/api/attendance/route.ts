import { NextRequest, NextResponse } from 'next/server';
import { getAuthContext, unauthorizedResponse, forbiddenResponse } from '@/lib/middleware-helpers';
import { prisma } from '@/lib/db';
import { UserRole } from '@prisma/client';
import { canManageUser } from '@/lib/permissions';
import { autoCheckoutPreviousDays } from '@/lib/attendance-helpers';

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

    let targetUserId = context.userId;

    // If userId is provided, check permissions
    if (userId && userId !== context.userId) {
      const canView = await canManageUser(context, userId);
      if (!canView) {
        return forbiddenResponse('You do not have permission to view this attendance');
      }
      targetUserId = userId;
    }

    // Auto-checkout any open check-ins from previous days for the target user
    await autoCheckoutPreviousDays(targetUserId);

    const where: any = { userId: targetUserId };

    if (startDate && endDate) {
      // Parse dates and set to start/end of day to ensure we capture all records
      const start = new Date(startDate);
      start.setHours(0, 0, 0, 0);
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      where.date = {
        gte: start,
        lte: end,
      };
    } else if (startDate) {
      const start = new Date(startDate);
      start.setHours(0, 0, 0, 0);
      where.date = { gte: start };
    } else if (endDate) {
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      where.date = { lte: end };
    }

    const attendance = await prisma.attendance.findMany({
      where,
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
      orderBy: { date: 'desc' },
    });

    return NextResponse.json({ attendance });
  } catch (error) {
    console.error('Get attendance error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch attendance' },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const context = await getAuthContext(request);
    if (!context) {
      return unauthorizedResponse();
    }

    const body = await request.json();
    const { id, checkInTime, checkOutTime, status, notes } = body;

    if (!id) {
      return NextResponse.json(
        { error: 'Attendance ID is required' },
        { status: 400 }
      );
    }

    // Find attendance record
    const attendance = await prisma.attendance.findUnique({
      where: { id },
      include: { user: true },
    });

    if (!attendance) {
      return NextResponse.json(
        { error: 'Attendance record not found' },
        { status: 404 }
      );
    }

    // Check permissions - only admins/managers can edit others' attendance
    if (attendance.userId !== context.userId) {
      const canManage = await canManageUser(context, attendance.userId);
      if (!canManage) {
        return forbiddenResponse('You do not have permission to edit this attendance');
      }
    }

    const updateData: any = {};
    if (checkInTime !== undefined) updateData.checkInTime = new Date(checkInTime);
    if (checkOutTime !== undefined) updateData.checkOutTime = new Date(checkOutTime);
    if (status !== undefined) updateData.status = status;
    if (notes !== undefined) updateData.notes = notes;

    const updated = await prisma.attendance.update({
      where: { id },
      data: updateData,
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    return NextResponse.json({ attendance: updated });
  } catch (error) {
    console.error('Update attendance error:', error);
    return NextResponse.json(
      { error: 'Failed to update attendance' },
      { status: 500 }
    );
  }
}


