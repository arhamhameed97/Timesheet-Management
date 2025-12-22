import { NextRequest, NextResponse } from 'next/server';
import { getAuthContext, unauthorizedResponse } from '@/lib/middleware-helpers';
import { prisma } from '@/lib/db';
import { checkOutSchema } from '@/lib/validations';

export async function POST(request: NextRequest) {
  try {
    const context = await getAuthContext(request);
    if (!context) {
      return unauthorizedResponse();
    }

    const body = await request.json();
    const validatedData = checkOutSchema.parse(body);

    const date = validatedData.date
      ? new Date(validatedData.date)
      : new Date();
    
    // Set time to start of day
    date.setHours(0, 0, 0, 0);

    // Find attendance record
    const attendance = await prisma.attendance.findUnique({
      where: {
        userId_date: {
          userId: context.userId,
          date,
        },
      },
    });

    if (!attendance) {
      return NextResponse.json(
        { error: 'No check-in found for this date' },
        { status: 400 }
      );
    }

    if (!attendance.checkInTime) {
      return NextResponse.json(
        { error: 'Please check in first before checking out' },
        { status: 400 }
      );
    }

    // If already checked out, allow checking out again (update checkout time)
    const checkOutTime = new Date();

    // Parse existing notes to get check-in/check-out history
    let checkInOutHistory: Array<{ type: 'in' | 'out'; time: string }> = [];
    let firstCheckIn: Date | null = null;
    let userNotes: string | null = null;

    try {
      const notesData = attendance.notes ? JSON.parse(attendance.notes) : null;
      if (notesData?.checkInOutHistory) {
        checkInOutHistory = notesData.checkInOutHistory;
      }
      if (notesData?.firstCheckIn) {
        firstCheckIn = new Date(notesData.firstCheckIn);
      }
      if (notesData?.userNotes) {
        userNotes = notesData.userNotes;
      }
    } catch (e) {
      // If notes is not JSON, treat as regular notes
      userNotes = attendance.notes;
      // Initialize history with existing check-in
      if (attendance.checkInTime) {
        firstCheckIn = attendance.checkInTime;
        checkInOutHistory.push({ type: 'in', time: attendance.checkInTime.toISOString() });
      }
    }

    // Add checkout event to history
    checkInOutHistory.push({ type: 'out', time: checkOutTime.toISOString() });

    const updated = await prisma.attendance.update({
      where: {
        userId_date: {
          userId: context.userId,
          date,
        },
      },
      data: {
        checkOutTime,
        notes: JSON.stringify({
          firstCheckIn: firstCheckIn?.toISOString() || attendance.checkInTime.toISOString(),
          checkInOutHistory,
          userNotes: validatedData.notes || userNotes || null,
        }),
      },
    });

    return NextResponse.json({ attendance: updated });
  } catch (error: any) {
    if (error.name === 'ZodError') {
      return NextResponse.json(
        { error: 'Validation error', details: error.errors },
        { status: 400 }
      );
    }

    console.error('Check-out error:', error);
    return NextResponse.json(
      { error: 'Failed to check out' },
      { status: 500 }
    );
  }
}









