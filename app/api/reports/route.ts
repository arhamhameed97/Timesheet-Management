import { NextRequest, NextResponse } from 'next/server';
import { getAuthContext, unauthorizedResponse } from '@/lib/middleware-helpers';
import { prisma } from '@/lib/db';
import { UserRole, AttendanceStatus, TimesheetStatus } from '@prisma/client';
import { 
  startOfMonth, 
  endOfMonth, 
  subMonths, 
  startOfYear, 
  endOfYear,
  startOfDay,
  endOfDay,
  format,
  differenceInSeconds,
  eachDayOfInterval,
  isWeekend,
  startOfWeek,
  endOfWeek,
} from 'date-fns';
import { calculateHoursWorked, getHourlyRateForDate, getOvertimeConfig, calculateOvertimePay } from '@/lib/payroll-helpers';
import { getEnrichedTimesheetDataForPeriod } from '@/lib/timesheet-helpers';

function getPeriodDates(period: string): { startDate: Date; endDate: Date } {
  const now = new Date();
  
  switch (period) {
    case 'currentMonth':
      return {
        startDate: startOfMonth(now),
        endDate: endOfMonth(now),
      };
    case 'lastMonth':
      const lastMonth = subMonths(now, 1);
      return {
        startDate: startOfMonth(lastMonth),
        endDate: endOfMonth(lastMonth),
      };
    case 'last3Months':
      return {
        startDate: startOfMonth(subMonths(now, 2)),
        endDate: endOfMonth(now),
      };
    case 'last6Months':
      return {
        startDate: startOfMonth(subMonths(now, 5)),
        endDate: endOfMonth(now),
      };
    case 'thisYear':
      return {
        startDate: startOfYear(now),
        endDate: endOfYear(now),
      };
    default:
      return {
        startDate: startOfMonth(now),
        endDate: endOfMonth(now),
      };
  }
}

function getPreviousPeriodDates(startDate: Date, endDate: Date): { startDate: Date; endDate: Date } {
  const duration = endDate.getTime() - startDate.getTime();
  return {
    startDate: new Date(startDate.getTime() - duration),
    endDate: new Date(startDate.getTime() - 1),
  };
}

function calculateWorkingDays(startDate: Date, endDate: Date): number {
  const days = eachDayOfInterval({ start: startDate, end: endDate });
  return days.filter(day => !isWeekend(day)).length;
}

export async function GET(request: NextRequest) {
  try {
    const context = await getAuthContext(request);
    if (!context) {
      return unauthorizedResponse();
    }

    const { searchParams } = new URL(request.url);
    const period = searchParams.get('period') || 'currentMonth';
    const startDateParam = searchParams.get('startDate');
    const endDateParam = searchParams.get('endDate');

    let startDate: Date;
    let endDate: Date;

    if (startDateParam && endDateParam) {
      startDate = startOfDay(new Date(startDateParam));
      endDate = endOfDay(new Date(endDateParam));
    } else {
      const periodDates = getPeriodDates(period);
      startDate = periodDates.startDate;
      endDate = periodDates.endDate;
    }

    // Get previous period for comparison
    const previousPeriod = getPreviousPeriodDates(startDate, endDate);

    // Determine which employees to include based on role
    let employeeIds: string[] = [];
    let employees: Array<{ id: string; name: string; email: string }> = [];

    if (context.role === UserRole.SUPER_ADMIN) {
      const allEmployees = await prisma.user.findMany({
        where: {
          role: { not: UserRole.SUPER_ADMIN },
          isActive: true,
        },
        select: { id: true, name: true, email: true },
      });
      employeeIds = allEmployees.map(e => e.id);
      employees = allEmployees;
    } else if (context.role === UserRole.COMPANY_ADMIN || context.role === UserRole.MANAGER || context.role === UserRole.TEAM_LEAD) {
      if (!context.companyId) {
        return NextResponse.json({ error: 'Company ID not found' }, { status: 400 });
      }
      const companyEmployees = await prisma.user.findMany({
        where: {
          companyId: context.companyId,
          isActive: true,
          role: { not: UserRole.SUPER_ADMIN },
        },
        select: { id: true, name: true, email: true },
      });
      employeeIds = companyEmployees.map(e => e.id);
      employees = companyEmployees;
    } else {
      // Employee - only their own data
      const employee = await prisma.user.findUnique({
        where: { id: context.userId },
        select: { id: true, name: true, email: true },
      });
      if (employee) {
        employeeIds = [employee.id];
        employees = [employee];
      }
    }

    if (employeeIds.length === 0) {
      return NextResponse.json({
        summary: {
          totalEmployees: 0,
          attendanceRate: 0,
          totalHours: 0,
          growth: 0,
          averageHoursPerEmployee: 0,
          totalEarnings: 0,
        },
        attendance: {
          dailyBreakdown: [],
          employeeBreakdown: [],
          trends: [],
          patterns: {
            mostActiveDay: '',
            leastActiveDay: '',
            averageCheckInTime: '',
            averageCheckOutTime: '',
          },
        },
        timesheets: {
          statusBreakdown: { draft: 0, submitted: 0, approved: 0, rejected: 0 },
          employeeBreakdown: [],
          trends: [],
          earnings: {
            totalEarnings: 0,
            regularEarnings: 0,
            overtimeEarnings: 0,
            averageEarningsPerEmployee: 0,
          },
        },
        comparisons: {
          previousPeriod: {
            attendanceRate: 0,
            totalHours: 0,
            growth: 0,
          },
        },
      });
    }

    // Calculate working days
    const workingDays = calculateWorkingDays(startDate, endDate);
    const previousWorkingDays = calculateWorkingDays(previousPeriod.startDate, previousPeriod.endDate);

    // Get attendance records for current period
    const attendanceRecords = await prisma.attendance.findMany({
      where: {
        userId: { in: employeeIds },
        date: { gte: startDate, lte: endDate },
      },
      orderBy: { date: 'asc' },
    });

    // Get attendance records for previous period
    const previousAttendanceRecords = await prisma.attendance.findMany({
      where: {
        userId: { in: employeeIds },
        date: { gte: previousPeriod.startDate, lte: previousPeriod.endDate },
      },
    });

    // Get timesheets for current period
    const timesheets = await prisma.timesheet.findMany({
      where: {
        userId: { in: employeeIds },
        date: { gte: startDate, lte: endDate },
      },
      include: {
        user: { select: { id: true, name: true, email: true } },
        taskLogs: true,
      },
    });

    // Calculate daily attendance breakdown
    const dailyBreakdownMap = new Map<string, { present: number; absent: number; late: number; total: number }>();
    const allDays = eachDayOfInterval({ start: startDate, end: endDate });
    
    allDays.forEach(day => {
      const dayKey = format(day, 'yyyy-MM-dd');
      dailyBreakdownMap.set(dayKey, { present: 0, absent: 0, late: 0, total: employeeIds.length });
    });

    attendanceRecords.forEach(record => {
      const dayKey = format(record.date, 'yyyy-MM-dd');
      const breakdown = dailyBreakdownMap.get(dayKey) || { present: 0, absent: 0, late: 0, total: employeeIds.length };
      
      if (record.checkInTime) {
        if (record.status === AttendanceStatus.LATE) {
          breakdown.late++;
        }
        breakdown.present++;
      } else {
        breakdown.absent++;
      }
      dailyBreakdownMap.set(dayKey, breakdown);
    });

    const dailyBreakdown = Array.from(dailyBreakdownMap.entries()).map(([date, data]) => ({
      date,
      ...data,
    }));

    // Calculate employee attendance breakdown
    const employeeAttendanceMap = new Map<string, {
      employeeId: string;
      name: string;
      daysPresent: number;
      daysAbsent: number;
      attendanceRate: number;
      totalHours: number;
    }>();

    employees.forEach(emp => {
      employeeAttendanceMap.set(emp.id, {
        employeeId: emp.id,
        name: emp.name,
        daysPresent: 0,
        daysAbsent: 0,
        attendanceRate: 0,
        totalHours: 0,
      });
    });

    // Calculate hours for each employee
    const employeeHoursPromises = employees.map(async (emp) => {
      let totalHours = 0;
      const empAttendance = attendanceRecords.filter(a => a.userId === emp.id);
      
      for (const record of empAttendance) {
        if (record.checkInTime && record.checkOutTime) {
          const checkIn = new Date(record.checkInTime);
          const checkOut = new Date(record.checkOutTime);
          const seconds = differenceInSeconds(checkOut, checkIn);
          totalHours += Math.abs(seconds) / 3600;
        }
      }

      const empData = employeeAttendanceMap.get(emp.id)!;
      const daysPresent = empAttendance.filter(a => a.checkInTime).length;
      const daysAbsent = workingDays - daysPresent;
      
      empData.daysPresent = daysPresent;
      empData.daysAbsent = daysAbsent;
      empData.attendanceRate = workingDays > 0 ? (daysPresent / workingDays) * 100 : 0;
      empData.totalHours = totalHours;
    });

    await Promise.all(employeeHoursPromises);

    const employeeBreakdown = Array.from(employeeAttendanceMap.values());

    // Calculate total attendance metrics
    const totalPresentDays = attendanceRecords.filter(a => a.checkInTime).length;
    const totalPossibleDays = employeeIds.length * workingDays;
    const attendanceRate = totalPossibleDays > 0 ? (totalPresentDays / totalPossibleDays) * 100 : 0;

    // Calculate total hours
    let totalHours = 0;
    for (const record of attendanceRecords) {
      if (record.checkInTime && record.checkOutTime) {
        const checkIn = new Date(record.checkInTime);
        const checkOut = new Date(record.checkOutTime);
        const seconds = differenceInSeconds(checkOut, checkIn);
        totalHours += Math.abs(seconds) / 3600;
      }
    }

    // Calculate previous period metrics
    const previousPresentDays = previousAttendanceRecords.filter(a => a.checkInTime).length;
    const previousPossibleDays = employeeIds.length * previousWorkingDays;
    const previousAttendanceRate = previousPossibleDays > 0 ? (previousPresentDays / previousPossibleDays) * 100 : 0;

    let previousTotalHours = 0;
    for (const record of previousAttendanceRecords) {
      if (record.checkInTime && record.checkOutTime) {
        const checkIn = new Date(record.checkInTime);
        const checkOut = new Date(record.checkOutTime);
        const seconds = differenceInSeconds(checkOut, checkIn);
        previousTotalHours += Math.abs(seconds) / 3600;
      }
    }

    const growth = previousTotalHours > 0 ? ((totalHours - previousTotalHours) / previousTotalHours) * 100 : 0;

    // Calculate attendance patterns
    const checkInTimes: number[] = [];
    const checkOutTimes: number[] = [];
    const dayOfWeekCounts = new Map<number, number>();

    attendanceRecords.forEach(record => {
      if (record.checkInTime) {
        const checkIn = new Date(record.checkInTime);
        checkInTimes.push(checkIn.getHours() * 60 + checkIn.getMinutes());
        
        const dayOfWeek = checkIn.getDay();
        dayOfWeekCounts.set(dayOfWeek, (dayOfWeekCounts.get(dayOfWeek) || 0) + 1);
      }
      if (record.checkOutTime) {
        const checkOut = new Date(record.checkOutTime);
        checkOutTimes.push(checkOut.getHours() * 60 + checkOut.getMinutes());
      }
    });

    const averageCheckInMinutes = checkInTimes.length > 0 
      ? checkInTimes.reduce((a, b) => a + b, 0) / checkInTimes.length 
      : 0;
    const averageCheckOutMinutes = checkOutTimes.length > 0 
      ? checkOutTimes.reduce((a, b) => a + b, 0) / checkOutTimes.length 
      : 0;

    const averageCheckInTime = averageCheckInMinutes > 0
      ? `${Math.floor(averageCheckInMinutes / 60)}:${String(Math.floor(averageCheckInMinutes % 60)).padStart(2, '0')}`
      : '';
    const averageCheckOutTime = averageCheckOutMinutes > 0
      ? `${Math.floor(averageCheckOutMinutes / 60)}:${String(Math.floor(averageCheckOutMinutes % 60)).padStart(2, '0')}`
      : '';

    // Find most/least active days
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    let mostActiveDay = '';
    let leastActiveDay = '';
    let maxCount = 0;
    let minCount = Infinity;

    dayOfWeekCounts.forEach((count, dayOfWeek) => {
      if (count > maxCount) {
        maxCount = count;
        mostActiveDay = dayNames[dayOfWeek];
      }
      if (count < minCount) {
        minCount = count;
        leastActiveDay = dayNames[dayOfWeek];
      }
    });

    // Calculate timesheet breakdown
    const statusBreakdown = {
      draft: timesheets.filter(t => t.status === TimesheetStatus.DRAFT).length,
      submitted: timesheets.filter(t => t.status === TimesheetStatus.SUBMITTED).length,
      approved: timesheets.filter(t => t.status === TimesheetStatus.APPROVED).length,
      rejected: timesheets.filter(t => t.status === TimesheetStatus.REJECTED).length,
    };

    // Calculate employee timesheet breakdown
    const employeeTimesheetMap = new Map<string, {
      employeeId: string;
      name: string;
      totalHours: number;
      regularHours: number;
      overtimeHours: number;
      totalEarnings: number;
      statusCounts: Record<string, number>;
    }>();

    employees.forEach(emp => {
      employeeTimesheetMap.set(emp.id, {
        employeeId: emp.id,
        name: emp.name,
        totalHours: 0,
        regularHours: 0,
        overtimeHours: 0,
        totalEarnings: 0,
        statusCounts: { draft: 0, submitted: 0, approved: 0, rejected: 0 },
      });
    });

    // Get enriched timesheet data for earnings calculation
    for (const emp of employees) {
      try {
        const enrichedData = await getEnrichedTimesheetDataForPeriod(emp.id, startDate, endDate);
        const empTimesheets = enrichedData.timesheets;
        const empData = employeeTimesheetMap.get(emp.id)!;

        empTimesheets.forEach(ts => {
          empData.totalHours += ts.hours;
          empData.regularHours += ts.regularHours;
          empData.overtimeHours += ts.overtimeHours;
          empData.totalEarnings += ts.earnings;
          empData.statusCounts[ts.status.toLowerCase()] = (empData.statusCounts[ts.status.toLowerCase()] || 0) + 1;
        });
      } catch (error) {
        console.error(`Error calculating timesheet data for employee ${emp.id}:`, error);
      }
    }

    const employeeTimesheetBreakdown = Array.from(employeeTimesheetMap.values());

    // Calculate earnings totals
    const totalEarnings = employeeTimesheetBreakdown.reduce((sum, emp) => sum + emp.totalEarnings, 0);
    const regularEarnings = employeeTimesheetBreakdown.reduce((sum, emp) => {
      // Calculate regular earnings from regular hours
      // We need to get the hourly rate for each employee
      // For now, estimate from total earnings and hours
      if (emp.totalHours > 0 && emp.totalEarnings > 0) {
        // Estimate hourly rate (this is approximate)
        const estimatedHourlyRate = emp.totalEarnings / emp.totalHours;
        return sum + (emp.regularHours * estimatedHourlyRate);
      }
      return sum;
    }, 0);
    const overtimeEarnings = Math.max(0, totalEarnings - regularEarnings);
    const averageEarningsPerEmployee = employeeIds.length > 0 ? totalEarnings / employeeIds.length : 0;

    // Calculate trends (weekly breakdown)
    const trends: Array<{ period: string; attendanceRate: number; totalHours: number }> = [];
    const weeks = [];
    let currentWeekStart = startOfWeek(startDate, { weekStartsOn: 1 });
    
    while (currentWeekStart <= endDate) {
      const weekEnd = endOfWeek(currentWeekStart, { weekStartsOn: 1 });
      const weekEndDate = weekEnd > endDate ? endDate : weekEnd;
      weeks.push({ start: currentWeekStart, end: weekEndDate });
      currentWeekStart = new Date(weekEndDate.getTime() + 86400000); // Add 1 day
    }

    for (const week of weeks) {
      const weekAttendance = attendanceRecords.filter(a => {
        const recordDate = new Date(a.date);
        return recordDate >= week.start && recordDate <= week.end;
      });
      
      const weekPresentDays = weekAttendance.filter(a => a.checkInTime).length;
      const weekWorkingDays = calculateWorkingDays(week.start, week.end);
      const weekPossibleDays = employeeIds.length * weekWorkingDays;
      const weekAttendanceRate = weekPossibleDays > 0 ? (weekPresentDays / weekPossibleDays) * 100 : 0;

      let weekHours = 0;
      weekAttendance.forEach(record => {
        if (record.checkInTime && record.checkOutTime) {
          const checkIn = new Date(record.checkInTime);
          const checkOut = new Date(record.checkOutTime);
          const seconds = differenceInSeconds(checkOut, checkIn);
          weekHours += Math.abs(seconds) / 3600;
        }
      });

      trends.push({
        period: format(week.start, 'MMM dd'),
        attendanceRate: weekAttendanceRate,
        totalHours: weekHours,
      });
    }

    // Timesheet trends
    const timesheetTrends: Array<{ period: string; totalHours: number; approvedHours: number; averageHours: number }> = [];
    for (const week of weeks) {
      const weekTimesheets = timesheets.filter(t => {
        const tsDate = new Date(t.date);
        return tsDate >= week.start && tsDate <= week.end;
      });
      
      const weekTotalHours = weekTimesheets.reduce((sum, t) => sum + t.hours, 0);
      const weekApprovedHours = weekTimesheets
        .filter(t => t.status === TimesheetStatus.APPROVED)
        .reduce((sum, t) => sum + t.hours, 0);
      const weekAverageHours = weekTimesheets.length > 0 ? weekTotalHours / weekTimesheets.length : 0;

      timesheetTrends.push({
        period: format(week.start, 'MMM dd'),
        totalHours: weekTotalHours,
        approvedHours: weekApprovedHours,
        averageHours: weekAverageHours,
      });
    }

    return NextResponse.json({
      summary: {
        totalEmployees: employeeIds.length,
        attendanceRate: Math.round(attendanceRate * 100) / 100,
        totalHours: Math.round(totalHours * 100) / 100,
        growth: Math.round(growth * 100) / 100,
        averageHoursPerEmployee: employeeIds.length > 0 ? Math.round((totalHours / employeeIds.length) * 100) / 100 : 0,
        totalEarnings: Math.round(totalEarnings * 100) / 100,
      },
      attendance: {
        dailyBreakdown,
        employeeBreakdown,
        trends,
        patterns: {
          mostActiveDay: mostActiveDay || 'N/A',
          leastActiveDay: leastActiveDay || 'N/A',
          averageCheckInTime: averageCheckInTime || 'N/A',
          averageCheckOutTime: averageCheckOutTime || 'N/A',
        },
      },
      timesheets: {
        statusBreakdown,
        employeeBreakdown: employeeTimesheetBreakdown,
        trends: timesheetTrends,
        earnings: {
          totalEarnings: Math.round(totalEarnings * 100) / 100,
          regularEarnings: Math.round(regularEarnings * 100) / 100,
          overtimeEarnings: Math.round(overtimeEarnings * 100) / 100,
          averageEarningsPerEmployee: Math.round(averageEarningsPerEmployee * 100) / 100,
        },
      },
      comparisons: {
        previousPeriod: {
          attendanceRate: Math.round(previousAttendanceRate * 100) / 100,
          totalHours: Math.round(previousTotalHours * 100) / 100,
          growth: Math.round(growth * 100) / 100,
        },
      },
    });
  } catch (error) {
    console.error('Get reports error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch reports' },
      { status: 500 }
    );
  }
}
