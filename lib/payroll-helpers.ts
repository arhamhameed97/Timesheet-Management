import { prisma } from './db';
import { differenceInSeconds, startOfMonth, endOfMonth, startOfWeek, endOfWeek, isWithinInterval } from 'date-fns';
import { PaymentType } from '@prisma/client';

export interface EmployeePaymentInfo {
  paymentType: PaymentType | null;
  hourlyRate: number | null;
  monthlySalary: number | null;
}

/**
 * Get employee payment information
 */
export async function getEmployeePaymentInfo(userId: string): Promise<EmployeePaymentInfo | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      paymentType: true,
      hourlyRate: true,
      monthlySalary: true,
    },
  });

  if (!user) {
    return null;
  }

  return {
    paymentType: user.paymentType,
    hourlyRate: user.hourlyRate,
    monthlySalary: user.monthlySalary,
  };
}

/**
 * Calculate total hours worked from attendance records for a given month/year
 * This matches the calculation logic used in the attendance page
 * Now returns breakdown of regular and overtime hours
 */
export async function calculateHoursWorked(
  userId: string,
  month: number,
  year: number
): Promise<{ totalHours: number; regularHours: number; overtimeHours: number; dailyHours: Array<{ date: string; hours: number; overtimeHours: number }> }> {
  // Calculate the start and end of the month using UTC to match database storage
  // This ensures consistent timezone handling with attendance records
  // month parameter is 1-12 (1-indexed)
  // Date.UTC uses 0-indexed months, so month - 1 for the start
  const monthStart = new Date(Date.UTC(year, month - 1, 1, 0, 0, 0, 0));
  // To get last day of current month: Date.UTC(year, month, 0) gives last day of (month-1)
  // So we need Date.UTC(year, month + 1, 0) to get last day of month
  // Example: month=1 (Jan) -> Date.UTC(year, 2, 0) = Jan 31st
  // Example: month=12 (Dec) -> Date.UTC(year, 13, 0) = Dec 31st
  const monthEnd = new Date(Date.UTC(year, month + 1, 0, 23, 59, 59, 999));

  // Get all attendance records for the month
  const attendanceRecords = await prisma.attendance.findMany({
    where: {
      userId,
      date: {
        gte: monthStart,
        lte: monthEnd,
      },
      checkInTime: { not: null },
      checkOutTime: { not: null },
    },
    orderBy: {
      date: 'asc',
    },
  });

  console.log(`[calculateHoursWorked] User: ${userId}, Month: ${month}/${year}`);
  console.log(`[calculateHoursWorked] Date range: ${monthStart.toISOString()} to ${monthEnd.toISOString()}`);
  console.log(`[calculateHoursWorked] Found ${attendanceRecords.length} attendance records`);

  let totalSeconds = 0;
  const dailyHours: Array<{ date: string; hours: number; overtimeHours: number }> = [];

  // Get overtime config
  const config = await getOvertimeConfig(userId);
  const weeklyThreshold = config?.weeklyThresholdHours || 40;

  // Track weekly hours for overtime calculation
  const weeklyHoursMap = new Map<string, number>(); // week key -> total hours

  for (const record of attendanceRecords) {
    if (record.checkInTime && record.checkOutTime) {
      const checkIn = new Date(record.checkInTime);
      const checkOut = new Date(record.checkOutTime);
      
      // Calculate seconds difference - ensure positive value
      const seconds = differenceInSeconds(checkOut, checkIn);
      
      // Use absolute value to prevent negative hours (in case of data issues)
      // But also log a warning if we get negative values
      if (seconds < 0) {
        console.warn(
          `Warning: Negative time difference for user ${userId} on ${record.date}. ` +
          `Check-in: ${checkIn.toISOString()}, Check-out: ${checkOut.toISOString()}`
        );
      }
      
      const dayHours = Math.abs(seconds) / 3600;
      totalSeconds += Math.abs(seconds);

      // Calculate overtime for this day
      const recordDate = new Date(record.date);
      const weekStart = startOfWeek(recordDate, { weekStartsOn: 1 });
      const weekKey = weekStart.toISOString();
      
      const weekTotalBefore = weeklyHoursMap.get(weekKey) || 0;
      const weekTotalAfter = weekTotalBefore + dayHours;
      weeklyHoursMap.set(weekKey, weekTotalAfter);

      // Calculate overtime hours for this day
      const regularHoursBeforeToday = Math.min(weekTotalBefore, weeklyThreshold);
      const remainingRegularCapacity = Math.max(0, weeklyThreshold - regularHoursBeforeToday);
      const dayRegularHours = Math.min(dayHours, remainingRegularCapacity);
      const dayOvertimeHours = Math.max(0, dayHours - remainingRegularCapacity);

      dailyHours.push({
        date: record.date.toISOString().split('T')[0],
        hours: dayHours,
        overtimeHours: dayOvertimeHours,
      });
    }
  }

  const totalHours = totalSeconds / 3600;
  
  // Calculate total regular and overtime hours
  let totalRegularHours = 0;
  let totalOvertimeHours = 0;
  
  for (const day of dailyHours) {
    totalRegularHours += day.hours - day.overtimeHours;
    totalOvertimeHours += day.overtimeHours;
  }

  return {
    totalHours,
    regularHours: totalRegularHours,
    overtimeHours: totalOvertimeHours,
    dailyHours,
  };
}

/**
 * Calculate hours and earnings for a specific date
 * This is used for the daily earnings calendar
 * Now includes overtime calculations and time-period based rates
 */
export async function calculateDailyHoursAndEarnings(
  userId: string,
  date: Date
): Promise<{ hours: number; earnings: number; hourlyRate: number | null; overtimeHours: number; regularHours: number }> {
  // Get the date at start of day
  const dayStart = new Date(date);
  dayStart.setHours(0, 0, 0, 0);
  
  const dayEnd = new Date(date);
  dayEnd.setHours(23, 59, 59, 999);

  // Get attendance record for this date
  const attendance = await prisma.attendance.findUnique({
    where: {
      userId_date: {
        userId,
        date: dayStart,
      },
    },
  });

  let hours = 0;
  let earnings = 0;
  let hourlyRate: number | null = null;
  let overtimeHours = 0;
  let regularHours = 0;

  if (attendance && attendance.checkInTime && attendance.checkOutTime) {
    const checkIn = new Date(attendance.checkInTime);
    const checkOut = new Date(attendance.checkOutTime);
    
    // Calculate seconds difference - ensure positive value
    const seconds = differenceInSeconds(checkOut, checkIn);
    
    // Use absolute value to prevent negative hours
    if (seconds < 0) {
      console.warn(
        `Warning: Negative time difference for user ${userId} on ${date.toISOString()}. ` +
        `Check-in: ${checkIn.toISOString()}, Check-out: ${checkOut.toISOString()}`
      );
    }
    
    hours = Math.abs(seconds) / 3600;

    // Get hourly rate for this date (checks time-period rates first)
    hourlyRate = await getHourlyRateForDate(userId, date);

    // Calculate overtime breakdown
    const overtimeBreakdown = await calculateDailyOvertime(userId, date, hours);
    regularHours = overtimeBreakdown.regularHours;
    overtimeHours = overtimeBreakdown.overtimeHours;

    // Calculate earnings if we have hourly rate
    if (hourlyRate && hourlyRate > 0) {
      const config = await getOvertimeConfig(userId);
      const regularPay = regularHours * hourlyRate;
      const overtimePay = calculateOvertimePay(overtimeHours, hourlyRate, config?.overtimeMultiplier || 1.5);
      earnings = regularPay + overtimePay;
    }
  }

  return { hours, earnings, hourlyRate, overtimeHours, regularHours };
}

/**
 * Calculate hourly pay
 */
export function calculateHourlyPay(hours: number, hourlyRate: number): number {
  return hours * hourlyRate;
}

/**
 * Calculate total bonuses
 */
export function calculateTotalBonuses(bonuses: Array<{ name: string; amount: number }>): number {
  return bonuses.reduce((sum, bonus) => sum + (bonus.amount || 0), 0);
}

/**
 * Calculate total deductions
 */
export function calculateTotalDeductions(deductions: Array<{ name: string; amount: number }>): number {
  return deductions.reduce((sum, deduction) => sum + (deduction.amount || 0), 0);
}

/**
 * Calculate net salary
 */
export function calculateNetSalary(
  baseSalary: number,
  bonuses: Array<{ name: string; amount: number }>,
  deductions: Array<{ name: string; amount: number }>
): number {
  const totalBonuses = calculateTotalBonuses(bonuses);
  const totalDeductions = calculateTotalDeductions(deductions);
  return baseSalary + totalBonuses - totalDeductions;
}

/**
 * Get hourly rate for a specific date
 * Priority: HourlyRatePeriod > Payroll hourlyRate > User profile hourlyRate
 */
export async function getHourlyRateForDate(
  userId: string,
  date: Date
): Promise<number | null> {
  const dateOnly = new Date(date);
  dateOnly.setHours(0, 0, 0, 0);

  // Check for hourly rate period that covers this date
  const ratePeriod = await prisma.hourlyRatePeriod.findFirst({
    where: {
      userId,
      startDate: { lte: dateOnly },
      endDate: { gte: dateOnly },
    },
    orderBy: {
      createdAt: 'desc', // Use most recent if multiple periods overlap
    },
  });

  if (ratePeriod) {
    return ratePeriod.hourlyRate;
  }

  // Check payroll for this month/year
  const month = date.getMonth() + 1;
  const year = date.getFullYear();
  const payroll = await prisma.payroll.findUnique({
    where: {
      userId_month_year: {
        userId,
        month,
        year,
      },
    },
    select: {
      paymentType: true,
      hourlyRate: true,
    },
  });

  if (payroll && payroll.paymentType === PaymentType.HOURLY && payroll.hourlyRate) {
    return payroll.hourlyRate;
  }

  // Fall back to user profile
  const paymentInfo = await getEmployeePaymentInfo(userId);
  if (paymentInfo?.paymentType === PaymentType.HOURLY && paymentInfo.hourlyRate) {
    return paymentInfo.hourlyRate;
  }

  return null;
}

/**
 * Get hourly rate for a date range (returns array of periods with rates)
 */
export async function getHourlyRateForPeriod(
  userId: string,
  startDate: Date,
  endDate: Date
): Promise<Array<{ startDate: Date; endDate: Date; hourlyRate: number }>> {
  const periods = await prisma.hourlyRatePeriod.findMany({
    where: {
      userId,
      OR: [
        {
          startDate: { lte: endDate },
          endDate: { gte: startDate },
        },
      ],
    },
    orderBy: {
      startDate: 'asc',
    },
  });

  return periods.map(p => ({
    startDate: p.startDate,
    endDate: p.endDate,
    hourlyRate: p.hourlyRate,
  }));
}

/**
 * Get overtime configuration for a user
 */
export async function getOvertimeConfig(userId: string): Promise<{
  weeklyThresholdHours: number;
  overtimeMultiplier: number;
} | null> {
  const config = await prisma.overtimeConfig.findUnique({
    where: { userId },
  });

  if (config) {
    return {
      weeklyThresholdHours: config.weeklyThresholdHours,
      overtimeMultiplier: config.overtimeMultiplier,
    };
  }

  // Return defaults if no config exists
  return {
    weeklyThresholdHours: 40,
    overtimeMultiplier: 1.5,
  };
}

/**
 * Calculate overtime hours based on weekly threshold
 */
export function calculateOvertimeHours(
  totalHours: number,
  weeklyThresholdHours: number
): number {
  return Math.max(0, totalHours - weeklyThresholdHours);
}

/**
 * Calculate overtime pay
 */
export function calculateOvertimePay(
  overtimeHours: number,
  hourlyRate: number,
  multiplier: number
): number {
  return overtimeHours * hourlyRate * multiplier;
}

/**
 * Calculate daily hours breakdown with overtime
 * Returns regular hours and overtime hours for a specific date
 */
export async function calculateDailyOvertime(
  userId: string,
  date: Date,
  hoursWorked: number
): Promise<{ regularHours: number; overtimeHours: number }> {
  const config = await getOvertimeConfig(userId);
  if (!config) {
    return { regularHours: hoursWorked, overtimeHours: 0 };
  }

  // Get week start and end for this date
  const weekStart = startOfWeek(date, { weekStartsOn: 1 }); // Monday
  const weekEnd = endOfWeek(date, { weekStartsOn: 1 }); // Sunday

  // Get all attendance records for this week
  const weekAttendance = await prisma.attendance.findMany({
    where: {
      userId,
      date: {
        gte: weekStart,
        lte: weekEnd,
      },
      checkInTime: { not: null },
      checkOutTime: { not: null },
    },
  });

  // Calculate total hours worked this week up to and including this date
  let weekTotalHours = 0;
  for (const record of weekAttendance) {
    if (record.checkInTime && record.checkOutTime) {
      const checkIn = new Date(record.checkInTime);
      const checkOut = new Date(record.checkOutTime);
      const recordDate = new Date(record.date);
      recordDate.setHours(0, 0, 0, 0);
      
      // Only count hours up to and including the target date
      if (recordDate <= date) {
        const seconds = differenceInSeconds(checkOut, checkIn);
        weekTotalHours += Math.abs(seconds) / 3600;
      }
    }
  }

  // Calculate how many hours were regular vs overtime before this day
  const hoursBeforeToday = weekTotalHours - hoursWorked;
  const regularHoursBeforeToday = Math.min(hoursBeforeToday, config.weeklyThresholdHours);
  const overtimeHoursBeforeToday = Math.max(0, hoursBeforeToday - config.weeklyThresholdHours);

  // Calculate remaining regular hours capacity
  const remainingRegularCapacity = Math.max(0, config.weeklyThresholdHours - regularHoursBeforeToday);

  // Split today's hours into regular and overtime
  const regularHours = Math.min(hoursWorked, remainingRegularCapacity);
  const overtimeHours = Math.max(0, hoursWorked - remainingRegularCapacity);

  return { regularHours, overtimeHours };
}



