import { NextRequest, NextResponse } from 'next/server';
import { getAuthContext, unauthorizedResponse, forbiddenResponse } from '@/lib/middleware-helpers';
import { calculateDailyHoursAndEarnings, getDailyPayrollOverride } from '@/lib/payroll-helpers';
import { canViewUser } from '@/lib/permissions';
import { UserRole } from '@prisma/client';
import { prisma } from '@/lib/db';
import { differenceInSeconds } from 'date-fns';

export async function GET(request: NextRequest) {
  try {
    const context = await getAuthContext(request);
    if (!context) {
      return unauthorizedResponse();
    }

    const { searchParams } = new URL(request.url);
    const requestedUserId = searchParams.get('userId');
    const userId = requestedUserId || context.userId;
    const month = searchParams.get('month');
    const year = searchParams.get('year');

    // Permission check: employees can only view their own daily earnings
    // Admins/managers can view subordinates' daily earnings
    if (userId !== context.userId) {
      if (context.role === UserRole.EMPLOYEE) {
        return NextResponse.json(
          { error: 'You can only view your own daily earnings' },
          { status: 403 }
        );
      }
      
      // Check if admin/manager can view this user
      const canView = await canViewUser(context, userId);
      if (!canView) {
        return forbiddenResponse('You do not have permission to view this employee\'s daily earnings');
      }
    }

    if (!month || !year) {
      return NextResponse.json(
        { error: 'Month and year are required' },
        { status: 400 }
      );
    }

    const monthNum = parseInt(month);
    const yearNum = parseInt(year);

    if (isNaN(monthNum) || isNaN(yearNum) || monthNum < 1 || monthNum > 12) {
      return NextResponse.json(
        { error: 'Invalid month or year' },
        { status: 400 }
      );
    }

    // Get number of days in the month
    const daysInMonth = new Date(yearNum, monthNum, 0).getDate();
    const dailyEarnings: Record<string, { hours: number; earnings: number; hourlyRate: number | null; overtimeHours: number; regularHours: number; isOverride: boolean; originalData?: { hours: number; earnings: number; hourlyRate: number | null; overtimeHours: number; regularHours: number } | null }> = {};

    // Get user payment info for debugging
    const { getEmployeePaymentInfo, getHourlyRateForDate, calculateDailyOvertime, getOvertimeConfig, calculateOvertimePay } = await import('@/lib/payroll-helpers');
    const paymentInfo = await getEmployeePaymentInfo(userId);
    console.log(`[daily-earnings] User ${userId} payment info:`, paymentInfo);

    // Calculate earnings for each day of the month
    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(yearNum, monthNum - 1, day);
      const result = await calculateDailyHoursAndEarnings(userId, date);
      
      // Get original data if override exists
      let originalData = null;
      if (result.isOverride) {
        const dayStart = new Date(date);
        dayStart.setHours(0, 0, 0, 0);
        
        const attendance = await prisma.attendance.findUnique({
          where: {
            userId_date: {
              userId,
              date: dayStart,
            },
          },
        });

        if (attendance && attendance.checkInTime && attendance.checkOutTime) {
          const checkIn = new Date(attendance.checkInTime);
          const checkOut = new Date(attendance.checkOutTime);
          const seconds = differenceInSeconds(checkOut, checkIn);
          const hours = Math.abs(seconds) / 3600;
          const hourlyRate = await getHourlyRateForDate(userId, date);
          const overtimeBreakdown = await calculateDailyOvertime(userId, date, hours);
          
          let earnings = 0;
          if (hourlyRate && hourlyRate > 0) {
            const config = await getOvertimeConfig(userId);
            const regularPay = overtimeBreakdown.regularHours * hourlyRate;
            const overtimePay = calculateOvertimePay(overtimeBreakdown.overtimeHours, hourlyRate, config?.overtimeMultiplier || 1.5);
            earnings = regularPay + overtimePay;
          }
          
          originalData = {
            hours,
            earnings,
            hourlyRate,
            overtimeHours: overtimeBreakdown.overtimeHours,
            regularHours: overtimeBreakdown.regularHours,
          };
        }
      }
      
      dailyEarnings[day.toString()] = {
        hours: result.hours,
        earnings: result.earnings,
        hourlyRate: result.hourlyRate,
        overtimeHours: result.overtimeHours,
        regularHours: result.regularHours,
        isOverride: result.isOverride,
        originalData,
      };
      
      // Debug: Log days with hours or earnings
      if (result.hours > 0) {
        console.log(`Day ${day}: ${result.hours}h (${result.regularHours}h reg + ${result.overtimeHours}h OT) - $${result.earnings} (hourlyRate: ${result.hourlyRate || paymentInfo?.hourlyRate || 'not set'})${result.isOverride ? ' [OVERRIDE]' : ''}`);
      }
    }

    return NextResponse.json({ dailyEarnings });
  } catch (error) {
    console.error('Get daily earnings error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch daily earnings' },
      { status: 500 }
    );
  }
}









