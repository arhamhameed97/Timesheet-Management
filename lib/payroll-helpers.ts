import { prisma } from '@/lib/db';
import { differenceInSeconds } from 'date-fns';

interface Bonus {
  name: string;
  amount: number;
}

interface Deduction {
  name: string;
  amount: number;
}

/**
 * Calculate total hours worked from attendance records for a given month/year
 */
export async function calculateHoursWorked(
  userId: string,
  month: number,
  year: number
): Promise<number> {
  // Get start and end dates for the month in UTC to match attendance record dates
  // month is 1-indexed (1 = January, 12 = December)
  // For startDate: month - 1 because Date.UTC uses 0-indexed months
  const startDate = new Date(Date.UTC(year, month - 1, 1));
  // For endDate: use month (1-indexed) with day 0 to get last day of current month
  // Date.UTC(year, month, 0) where month is 1-indexed (12 for Dec) = Date.UTC(2025, 12, 0) = Dec 31, 2025
  const endDate = new Date(Date.UTC(year, month, 0, 23, 59, 59, 999));

  // Fetch all attendance records for the period
  const attendanceRecords = await prisma.attendance.findMany({
    where: {
      userId,
      date: {
        gte: startDate,
        lte: endDate,
      },
    },
    select: {
      checkInTime: true,
      checkOutTime: true,
      notes: true,
    },
  });

  let totalHours = 0;

  for (const record of attendanceRecords) {
    if (!record.checkInTime) continue;

    // Try to parse check-in/check-out history from notes
    let checkInOutHistory: Array<{ type: 'in' | 'out'; time: string }> = [];
    
    if (record.notes) {
      try {
        const notesData = JSON.parse(record.notes);
        if (notesData.checkInOutHistory && Array.isArray(notesData.checkInOutHistory)) {
          checkInOutHistory = notesData.checkInOutHistory;
        }
      } catch (e) {
        // If parsing fails, fall back to simple check-in/check-out
      }
    }

    let dayHours = 0;

    if (checkInOutHistory.length > 0) {
      // Sort history by time
      const sortedHistory = [...checkInOutHistory].sort(
        (a, b) => new Date(a.time).getTime() - new Date(b.time).getTime()
      );

      let lastCheckIn: Date | null = null;

      // Calculate total time from all check-in/check-out pairs
      for (const event of sortedHistory) {
        const eventTime = new Date(event.time);

        if (event.type === 'in') {
          lastCheckIn = eventTime;
        } else if (event.type === 'out' && lastCheckIn) {
          // Ensure check-out is after check-in
          const seconds = differenceInSeconds(eventTime, lastCheckIn);
          if (seconds > 0) {
            dayHours += seconds / 3600; // Convert to hours
          }
          lastCheckIn = null;
        }
      }

      // If there's a check-in without a check-out, calculate to checkOutTime or end of that day
      // Don't use current time for past dates - use checkOutTime if available, otherwise end of the attendance date
      if (lastCheckIn) {
        let endTime: Date;
        if (record.checkOutTime) {
          endTime = new Date(record.checkOutTime);
        } else {
          // For past dates, use end of the attendance date, not current time
          // Get the date from the record (we need to fetch it or use checkInTime's date)
          const recordDate = new Date(record.checkInTime);
          endTime = new Date(Date.UTC(
            recordDate.getUTCFullYear(),
            recordDate.getUTCMonth(),
            recordDate.getUTCDate(),
            23, 59, 59, 999
          ));
        }
        const seconds = differenceInSeconds(endTime, lastCheckIn);
        if (seconds > 0) {
          dayHours += seconds / 3600;
        }
      }
    } else {
      // Fallback: simple check-in to check-out calculation
      if (record.checkInTime && record.checkOutTime) {
        const checkIn = new Date(record.checkInTime);
        const checkOut = new Date(record.checkOutTime);
        const seconds = differenceInSeconds(checkOut, checkIn);
        if (seconds > 0) {
          dayHours = seconds / 3600;
        } else {
          // If negative, try reversing (might be timezone issue)
          dayHours = Math.abs(seconds) / 3600;
        }
      } else if (record.checkInTime) {
        // If checked in but not checked out, calculate to end of that day (not current time for past dates)
        const checkIn = new Date(record.checkInTime);
        const recordDate = new Date(checkIn);
        const endOfDay = new Date(Date.UTC(
          recordDate.getUTCFullYear(),
          recordDate.getUTCMonth(),
          recordDate.getUTCDate(),
          23, 59, 59, 999
        ));
        const seconds = differenceInSeconds(endOfDay, checkIn);
        if (seconds > 0) {
          dayHours = seconds / 3600;
        }
      }
    }

    // Ensure dayHours is not negative
    if (dayHours < 0) {
      dayHours = Math.abs(dayHours);
    }

    totalHours += dayHours;
  }

  // Round to 2 decimal places and ensure positive
  const roundedHours = Math.round(totalHours * 100) / 100;
  return roundedHours > 0 ? roundedHours : 0;
}

/**
 * Calculate hourly pay
 */
export function calculateHourlyPay(hours: number, rate: number): number {
  return Math.round(hours * rate * 100) / 100;
}

/**
 * Calculate total bonuses
 */
export function calculateTotalBonuses(bonuses: Bonus[] | null | undefined): number {
  if (!bonuses || !Array.isArray(bonuses)) {
    return 0;
  }
  return bonuses.reduce((sum, bonus) => sum + (bonus.amount || 0), 0);
}

/**
 * Calculate total deductions
 */
export function calculateTotalDeductions(deductions: Deduction[] | null | undefined): number {
  if (!deductions || !Array.isArray(deductions)) {
    return 0;
  }
  return deductions.reduce((sum, deduction) => sum + (deduction.amount || 0), 0);
}

/**
 * Calculate net salary
 */
export function calculateNetSalary(
  baseSalary: number,
  bonuses: Bonus[] | null | undefined,
  deductions: Deduction[] | null | undefined
): number {
  const totalBonuses = calculateTotalBonuses(bonuses);
  const totalDeductions = calculateTotalDeductions(deductions);
  return Math.round((baseSalary + totalBonuses - totalDeductions) * 100) / 100;
}

/**
 * Get employee payment information
 */
export async function getEmployeePaymentInfo(userId: string) {
  // Get all user fields (Prisma Client may not be regenerated yet)
  const user = await prisma.user.findUnique({
    where: { id: userId },
  });

  if (!user) {
    return null;
  }

  // Extract payment fields (handle both old and new Prisma Client)
  return {
    id: user.id,
    paymentType: (user as any).paymentType || null,
    hourlyRate: (user as any).hourlyRate || null,
    monthlySalary: (user as any).monthlySalary || null,
  };
}

/**
 * Calculate daily hours and earnings for a specific date
 */
export async function calculateDailyHoursAndEarnings(
  userId: string,
  date: Date
): Promise<{ hours: number; earnings: number }> {
  // Convert to UTC date at start of day to match attendance record dates
  const dayStart = new Date(Date.UTC(
    date.getUTCFullYear(),
    date.getUTCMonth(),
    date.getUTCDate()
  ));
  const dayEnd = new Date(Date.UTC(
    date.getUTCFullYear(),
    date.getUTCMonth(),
    date.getUTCDate(),
    23, 59, 59, 999
  ));

  // Get attendance record for this day
  const attendance = await prisma.attendance.findUnique({
    where: {
      userId_date: {
        userId,
        date: dayStart,
      },
    },
    select: {
      checkInTime: true,
      checkOutTime: true,
      notes: true,
    },
  });

  if (!attendance || !attendance.checkInTime) {
    return { hours: 0, earnings: 0 };
  }

  // Get employee payment info
  const paymentInfo = await getEmployeePaymentInfo(userId);
  if (!paymentInfo) {
    return { hours: 0, earnings: 0 };
  }

  // Try to get hourly rate from Payroll record for this month/year first
  // This ensures we use the same rate that was used for monthly payroll calculation
  // Use UTC month/year to match how dates are stored
  const month = date.getUTCMonth() + 1;
  const year = date.getUTCFullYear();
  const payrollRecord = await prisma.payroll.findUnique({
    where: {
      userId_month_year: {
        userId,
        month,
        year,
      },
    },
    select: {
      hourlyRate: true,
      paymentType: true,
    },
  });

  // Use hourly rate from payroll record if available, otherwise fall back to user profile
  const hourlyRate = payrollRecord?.hourlyRate || paymentInfo.hourlyRate;
  const effectivePaymentType = payrollRecord?.paymentType || paymentInfo.paymentType;

  // Calculate hours worked for ALL employees (both hourly and salaried)
  let dayHours = 0;

  // Try to parse check-in/check-out history from notes
  let checkInOutHistory: Array<{ type: 'in' | 'out'; time: string }> = [];
  
  if (attendance.notes) {
    try {
      const notesData = JSON.parse(attendance.notes);
      if (notesData.checkInOutHistory && Array.isArray(notesData.checkInOutHistory)) {
        checkInOutHistory = notesData.checkInOutHistory;
      }
    } catch (e) {
      // If parsing fails, fall back to simple check-in/check-out
    }
  }

  if (checkInOutHistory.length > 0) {
    // Sort history by time
    const sortedHistory = [...checkInOutHistory].sort(
      (a, b) => new Date(a.time).getTime() - new Date(b.time).getTime()
    );

    let lastCheckIn: Date | null = null;

    // Calculate total time from all check-in/check-out pairs
    for (const event of sortedHistory) {
      const eventTime = new Date(event.time);

      if (event.type === 'in') {
        lastCheckIn = eventTime;
      } else if (event.type === 'out' && lastCheckIn) {
        const seconds = differenceInSeconds(eventTime, lastCheckIn);
        if (seconds > 0) {
          dayHours += seconds / 3600;
        }
        lastCheckIn = null;
      }
    }

    // If there's a check-in without a check-out, calculate to checkOutTime or end of day
    if (lastCheckIn) {
      const endTime = attendance.checkOutTime ? new Date(attendance.checkOutTime) : dayEnd;
      const seconds = differenceInSeconds(endTime, lastCheckIn);
      if (seconds > 0) {
        dayHours += seconds / 3600;
      }
    }
  } else {
    // Fallback: simple check-in to check-out calculation
    if (attendance.checkInTime && attendance.checkOutTime) {
      const checkIn = new Date(attendance.checkInTime);
      const checkOut = new Date(attendance.checkOutTime);
      const seconds = differenceInSeconds(checkOut, checkIn);
      if (seconds > 0) {
        dayHours = seconds / 3600;
      } else {
        dayHours = Math.abs(seconds) / 3600;
      }
    } else if (attendance.checkInTime) {
      // If checked in but not checked out, calculate to end of day
      const checkIn = new Date(attendance.checkInTime);
      const endTime = attendance.checkOutTime ? new Date(attendance.checkOutTime) : dayEnd;
      const seconds = differenceInSeconds(endTime, checkIn);
      if (seconds > 0) {
        dayHours = seconds / 3600;
      }
    }
  }

  // Ensure dayHours is not negative
  if (dayHours < 0) {
    dayHours = Math.abs(dayHours);
  }

  // Round to 2 decimal places
  dayHours = Math.round(dayHours * 100) / 100;

  // Calculate earnings: multiply hours by hourly rate if hourly rate exists
  // Priority: Use hourlyRate from Payroll record, then fall back to User profile
  let earnings = 0;
  if (hourlyRate && hourlyRate > 0 && dayHours > 0) {
    earnings = calculateHourlyPay(dayHours, hourlyRate);
  } else if (dayHours > 0) {
    // Debug: Log when hours exist but earnings aren't calculated
    console.log(`[calculateDailyHoursAndEarnings] Day ${date.toDateString()}: ${dayHours}h worked but no earnings calculated.`, {
      payrollHourlyRate: payrollRecord?.hourlyRate,
      userHourlyRate: paymentInfo.hourlyRate,
      effectiveHourlyRate: hourlyRate,
      paymentType: effectivePaymentType,
      monthlySalary: paymentInfo.monthlySalary
    });
  }

  return { hours: dayHours, earnings };
}


