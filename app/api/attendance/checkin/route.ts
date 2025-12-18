import { NextRequest, NextResponse } from 'next/server';
import { getAuthContext, unauthorizedResponse } from '@/lib/middleware-helpers';
import { prisma } from '@/lib/db';
import { checkInSchema } from '@/lib/validations';
import { AttendanceStatus } from '@prisma/client';

export async function POST(request: NextRequest) {
  try {
    const context = await getAuthContext(request);
    if (!context) {
      return unauthorizedResponse();
    }

    const body = await request.json();
    const validatedData = checkInSchema.parse(body);

    const date = validatedData.date
      ? new Date(validatedData.date)
      : new Date();
    
    // Set time to start of day
    date.setHours(0, 0, 0, 0);

    // Check if attendance already exists for today
    const existing = await prisma.attendance.findUnique({
      where: {
        userId_date: {
          userId: context.userId,
          date,
        },
      },
    });

    const checkInTime = new Date();
    let attendanceData: any = {
      status: AttendanceStatus.PRESENT,
    };

    // Parse existing notes to get check-in/check-out history
    let checkInOutHistory: Array<{ type: 'in' | 'out'; time: string }> = [];
    let firstCheckIn: Date | null = null;
    let notesData: any = null;

    if (existing) {
      try {
        notesData = existing.notes ? JSON.parse(existing.notes) : null;
        if (notesData?.checkInOutHistory) {
          checkInOutHistory = notesData.checkInOutHistory;
        }
        if (notesData?.firstCheckIn) {
          firstCheckIn = new Date(notesData.firstCheckIn);
        }
      } catch (e) {
        // If notes is not JSON, treat as regular notes
        notesData = null;
      }

      // If user is already checked in (has checkInTime but no checkOutTime), don't allow another check-in
      if (existing.checkInTime && !existing.checkOutTime) {
        return NextResponse.json(
          { error: 'Already checked in. Please check out first.' },
          { status: 400 }
        );
      }

      // If user has checked out, allow checking back in (re-check-in scenario)
      if (existing.checkOutTime) {
        // Store the re-check-in event
        checkInOutHistory.push({ type: 'in', time: checkInTime.toISOString() });
        
        // Keep the original first check-in time
        if (!firstCheckIn && existing.checkInTime) {
          firstCheckIn = existing.checkInTime;
        }
        
        attendanceData.checkInTime = checkInTime;
        attendanceData.checkOutTime = null; // Clear checkout to allow new check-in
        attendanceData.notes = JSON.stringify({
          firstCheckIn: firstCheckIn?.toISOString() || checkInTime.toISOString(),
          checkInOutHistory,
          userNotes: validatedData.notes || notesData?.userNotes || null,
        });
      } else {
        // First check-in of the day
        firstCheckIn = checkInTime;
        checkInOutHistory.push({ type: 'in', time: checkInTime.toISOString() });
        attendanceData.checkInTime = checkInTime;
        attendanceData.notes = JSON.stringify({
          firstCheckIn: checkInTime.toISOString(),
          checkInOutHistory,
          userNotes: validatedData.notes || null,
        });
      }
    } else {
      // New attendance record
      firstCheckIn = checkInTime;
      checkInOutHistory.push({ type: 'in', time: checkInTime.toISOString() });
      attendanceData.checkInTime = checkInTime;
      attendanceData.notes = JSON.stringify({
        firstCheckIn: checkInTime.toISOString(),
        checkInOutHistory,
        userNotes: validatedData.notes || null,
      });
    }

    // Create or update attendance
    const attendance = await prisma.attendance.upsert({
      where: {
        userId_date: {
          userId: context.userId,
          date,
        },
      },
      update: attendanceData,
      create: {
        userId: context.userId,
        date,
        ...attendanceData,
      },
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

    return NextResponse.json({ attendance }, { status: 201 });
  } catch (error: any) {
    if (error.name === 'ZodError') {
      return NextResponse.json(
        { error: 'Validation error', details: error.errors },
        { status: 400 }
      );
    }

    console.error('Check-in error:', error);
    return NextResponse.json(
      { error: 'Failed to check in' },
      { status: 500 }
    );
  }
}


