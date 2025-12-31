import { prisma } from './db';
import { differenceInSeconds, startOfMonth, endOfMonth } from 'date-fns';
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
 */
export async function calculateHoursWorked(
  userId: string,
  month: number,
  year: number
): Promise<number> {
  // Calculate the start and end of the month
  const monthStart = startOfMonth(new Date(year, month - 1, 1));
  const monthEnd = endOfMonth(new Date(year, month - 1, 1));

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
  });

  let totalSeconds = 0;

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
      
      // Use absolute value to ensure positive hours
      totalSeconds += Math.abs(seconds);
    }
  }

  // Convert seconds to hours
  return totalSeconds / 3600;
}

/**
 * Calculate hours and earnings for a specific date
 * This is used for the daily earnings calendar
 */
export async function calculateDailyHoursAndEarnings(
  userId: string,
  date: Date
): Promise<{ hours: number; earnings: number }> {
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

    // Get user payment info to calculate earnings
    const paymentInfo = await getEmployeePaymentInfo(userId);
    if (paymentInfo?.paymentType === PaymentType.HOURLY && paymentInfo.hourlyRate) {
      earnings = hours * paymentInfo.hourlyRate;
    }
  }

  return { hours, earnings };
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

