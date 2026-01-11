import { prisma } from './db';
import { TimesheetStatus } from '@prisma/client';
import {
  calculateHoursWorked,
  getHourlyRateForDate,
  getOvertimeConfig,
  calculateOvertimePay,
  calculateDailyOvertime,
} from './payroll-helpers';
import { differenceInSeconds, startOfMonth, endOfMonth, eachDayOfInterval, format } from 'date-fns';

export interface TimesheetGenerationResult {
  created: number;
  updated: number;
  skipped: number;
  errors: Array<{ date: string; error: string }>;
}

/**
 * Generate timesheets for a user for a specific date range based on attendance records
 */
export async function generateTimesheetsForPeriod(
  userId: string,
  startDate: Date,
  endDate: Date
): Promise<TimesheetGenerationResult> {
  const result: TimesheetGenerationResult = {
    created: 0,
    updated: 0,
    skipped: 0,
    errors: [],
  };

  // Get all attendance records for the period
  const attendanceRecords = await prisma.attendance.findMany({
    where: {
      userId,
      date: {
        gte: startDate,
        lte: endDate,
      },
      checkInTime: { not: null },
      checkOutTime: { not: null },
    },
    orderBy: {
      date: 'asc',
    },
  });

  // Get overtime config for the user
  const overtimeConfig = await getOvertimeConfig(userId);

  // Process each attendance record
  for (const attendance of attendanceRecords) {
    try {
      const date = new Date(attendance.date);
      date.setHours(0, 0, 0, 0);

      // Calculate hours worked
      const checkIn = new Date(attendance.checkInTime!);
      const checkOut = new Date(attendance.checkOutTime!);
      const seconds = differenceInSeconds(checkOut, checkIn);
      const hours = Math.abs(seconds) / 3600;

      // Calculate overtime breakdown
      const overtimeBreakdown = await calculateDailyOvertime(userId, date, hours);
      const regularHours = overtimeBreakdown.regularHours;
      const overtimeHours = overtimeBreakdown.overtimeHours;

      // Get hourly rate for this date
      const hourlyRate = await getHourlyRateForDate(userId, date);

      // Calculate earnings if hourly rate exists
      let earnings = 0;
      if (hourlyRate && hourlyRate > 0) {
        const regularPay = regularHours * hourlyRate;
        const overtimePay = calculateOvertimePay(
          overtimeHours,
          hourlyRate,
          overtimeConfig?.overtimeMultiplier || 1.5
        );
        earnings = regularPay + overtimePay;
      }

      // Check if timesheet already exists
      const existingTimesheet = await prisma.timesheet.findUnique({
        where: {
          userId_date: {
            userId,
            date,
          },
        },
      });

      if (existingTimesheet) {
        // Update existing timesheet only if it's in DRAFT status (auto-generated)
        // Don't overwrite manually submitted/approved timesheets
        if (existingTimesheet.status === TimesheetStatus.DRAFT) {
          await prisma.timesheet.update({
            where: { id: existingTimesheet.id },
            data: {
              hours,
              notes: attendance.notes || existingTimesheet.notes,
            },
          });
          result.updated++;
        } else {
          result.skipped++;
        }
      } else {
        // Create new timesheet
        await prisma.timesheet.create({
          data: {
            userId,
            date,
            hours,
            status: TimesheetStatus.DRAFT,
            notes: attendance.notes || null,
          },
        });
        result.created++;
      }
    } catch (error: any) {
      result.errors.push({
        date: format(new Date(attendance.date), 'yyyy-MM-dd'),
        error: error.message || 'Unknown error',
      });
    }
  }

  return result;
}

/**
 * Generate timesheets for a user for a specific month
 */
export async function generateMonthlyTimesheets(
  userId: string,
  month: number,
  year: number
): Promise<TimesheetGenerationResult> {
  // month is 1-indexed (1-12)
  const monthDate = new Date(year, month - 1, 1);
  const monthStart = startOfMonth(monthDate);
  const monthEnd = endOfMonth(monthDate);
  // Set end date to end of day
  monthEnd.setHours(23, 59, 59, 999);

  return generateTimesheetsForPeriod(userId, monthStart, monthEnd);
}

/**
 * Generate timesheets for all active employees for a specific month
 */
export async function generateMonthlyTimesheetsForAllEmployees(
  month: number,
  year: number,
  companyId?: string | null
): Promise<{
  totalProcessed: number;
  results: Array<{ userId: string; result: TimesheetGenerationResult }>;
}> {
  const where: any = {
    isActive: true,
    role: {
      not: 'SUPER_ADMIN', // Don't generate for super admins
    },
  };

  if (companyId) {
    where.companyId = companyId;
  }

  const employees = await prisma.user.findMany({
    where,
    select: { id: true },
  });

  const results: Array<{ userId: string; result: TimesheetGenerationResult }> = [];

  for (const employee of employees) {
    const result = await generateMonthlyTimesheets(employee.id, month, year);
    results.push({ userId: employee.id, result });
  }

  return {
    totalProcessed: employees.length,
    results,
  };
}

/**
 * Get enriched timesheet data with attendance details, rates, and earnings
 */
export async function getEnrichedTimesheetData(timesheetId: string) {
  const timesheet = await prisma.timesheet.findUnique({
    where: { id: timesheetId },
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
  });

  if (!timesheet) {
    return null;
  }

  // Get attendance record for this date
  const attendance = await prisma.attendance.findUnique({
    where: {
      userId_date: {
        userId: timesheet.userId,
        date: timesheet.date,
      },
    },
  });

  // Get hourly rate for this date
  const hourlyRate = await getHourlyRateForDate(timesheet.userId, timesheet.date);

  // Calculate overtime breakdown
  const overtimeBreakdown = await calculateDailyOvertime(timesheet.userId, timesheet.date, timesheet.hours);
  const regularHours = overtimeBreakdown.regularHours;
  const overtimeHours = overtimeBreakdown.overtimeHours;

  // Calculate earnings
  let earnings = 0;
  if (hourlyRate && hourlyRate > 0) {
    const overtimeConfig = await getOvertimeConfig(timesheet.userId);
    const regularPay = regularHours * hourlyRate;
    const overtimePay = calculateOvertimePay(
      overtimeHours,
      hourlyRate,
      overtimeConfig?.overtimeMultiplier || 1.5
    );
    earnings = regularPay + overtimePay;
  }

  return {
    ...timesheet,
    attendance: attendance
      ? {
          checkInTime: attendance.checkInTime?.toISOString() || null,
          checkOutTime: attendance.checkOutTime?.toISOString() || null,
          status: attendance.status,
          notes: attendance.notes,
        }
      : null,
    hourlyRate,
    regularHours,
    overtimeHours,
    earnings,
  };
}

/**
 * Get enriched timesheet data for multiple timesheets
 */
export async function getEnrichedTimesheetDataForPeriod(
  userId: string,
  startDate: Date,
  endDate: Date
) {
  const timesheets = await prisma.timesheet.findMany({
    where: {
      userId,
      date: {
        gte: startDate,
        lte: endDate,
      },
    },
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
    orderBy: {
      date: 'asc',
    },
  });

  // Enrich each timesheet with attendance, rates, and earnings
  const enrichedTimesheets = await Promise.all(
    timesheets.map(async (timesheet) => {
      const attendance = await prisma.attendance.findUnique({
        where: {
          userId_date: {
            userId: timesheet.userId,
            date: timesheet.date,
          },
        },
      });

      const hourlyRate = await getHourlyRateForDate(timesheet.userId, timesheet.date);
      const overtimeBreakdown = await calculateDailyOvertime(
        timesheet.userId,
        timesheet.date,
        timesheet.hours
      );
      const regularHours = overtimeBreakdown.regularHours;
      const overtimeHours = overtimeBreakdown.overtimeHours;

      let earnings = 0;
      if (hourlyRate && hourlyRate > 0) {
        const overtimeConfig = await getOvertimeConfig(timesheet.userId);
        const regularPay = regularHours * hourlyRate;
        const overtimePay = calculateOvertimePay(
          overtimeHours,
          hourlyRate,
          overtimeConfig?.overtimeMultiplier || 1.5
        );
        earnings = regularPay + overtimePay;
      }

      return {
        ...timesheet,
        attendance: attendance
          ? {
              checkInTime: attendance.checkInTime?.toISOString() || null,
              checkOutTime: attendance.checkOutTime?.toISOString() || null,
              status: attendance.status,
              notes: attendance.notes,
            }
          : null,
        hourlyRate,
        regularHours,
        overtimeHours,
        earnings,
      };
    })
  );

  // Calculate totals
  const totals = enrichedTimesheets.reduce(
    (acc, ts) => ({
      totalHours: acc.totalHours + ts.hours,
      totalRegularHours: acc.totalRegularHours + ts.regularHours,
      totalOvertimeHours: acc.totalOvertimeHours + ts.overtimeHours,
      totalEarnings: acc.totalEarnings + ts.earnings,
    }),
    {
      totalHours: 0,
      totalRegularHours: 0,
      totalOvertimeHours: 0,
      totalEarnings: 0,
    }
  );

  return {
    timesheets: enrichedTimesheets,
    totals,
  };
}
