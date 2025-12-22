import { prisma } from './db';

/**
 * Automatically checks out users who have open check-ins from previous days.
 * This should be called when:
 * 1. A user tries to check in on a new day
 * 2. The attendance page is loaded
 * 
 * @param userId - The user ID to check for open check-ins
 * @returns The number of attendance records that were auto-checked out
 */
export async function autoCheckoutPreviousDays(userId: string): Promise<number> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Find all attendance records where:
  // 1. The date is before today
  // 2. User has checked in (checkInTime exists)
  // 3. User has NOT checked out (checkOutTime is null)
  const openCheckIns = await prisma.attendance.findMany({
    where: {
      userId,
      date: {
        lt: today, // Before today
      },
      checkInTime: {
        not: null,
      },
      checkOutTime: null,
    },
  });

  let checkedOutCount = 0;

  // Auto-checkout each open check-in
  for (const attendance of openCheckIns) {
    // Create a new date object for checkout time (end of that day: 23:59:59)
    const checkOutTime = new Date(attendance.date);
    checkOutTime.setHours(23, 59, 59, 999);

    // Parse existing notes to get check-in/check-out history
    let checkInOutHistory: Array<{ type: 'in' | 'out'; time: string }> = [];
    let firstCheckIn: Date | null = null;
    let userNotes: string | null = null;

    try {
      if (attendance.notes) {
        const notesData = JSON.parse(attendance.notes);
        if (notesData?.checkInOutHistory) {
          checkInOutHistory = notesData.checkInOutHistory;
        }
        if (notesData?.firstCheckIn) {
          firstCheckIn = new Date(notesData.firstCheckIn);
        }
        if (notesData?.userNotes) {
          userNotes = notesData.userNotes;
        }
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

    // Add auto-checkout event to history
    checkInOutHistory.push({ type: 'out', time: checkOutTime.toISOString() });

    // Update the attendance record
    await prisma.attendance.update({
      where: {
        id: attendance.id,
      },
      data: {
        checkOutTime,
        notes: JSON.stringify({
          firstCheckIn: firstCheckIn?.toISOString() || attendance.checkInTime?.toISOString(),
          checkInOutHistory,
          userNotes: userNotes || null,
          autoCheckedOut: true, // Flag to indicate this was auto-checked out
        }),
      },
    });

    checkedOutCount++;
  }

  return checkedOutCount;
}



