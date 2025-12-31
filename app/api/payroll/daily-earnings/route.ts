import { NextRequest, NextResponse } from 'next/server';
import { getAuthContext, unauthorizedResponse } from '@/lib/middleware-helpers';
import { calculateDailyHoursAndEarnings } from '@/lib/payroll-helpers';

export async function GET(request: NextRequest) {
  try {
    const context = await getAuthContext(request);
    if (!context) {
      return unauthorizedResponse();
    }

    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId') || context.userId;
    const month = searchParams.get('month');
    const year = searchParams.get('year');

    // Employees can only view their own daily earnings
    if (userId !== context.userId && context.role === 'EMPLOYEE') {
      return NextResponse.json(
        { error: 'You can only view your own daily earnings' },
        { status: 403 }
      );
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
    const dailyEarnings: Record<string, { hours: number; earnings: number }> = {};

    // Get user payment info for debugging
    const { getEmployeePaymentInfo } = await import('@/lib/payroll-helpers');
    const paymentInfo = await getEmployeePaymentInfo(userId);
    console.log(`[daily-earnings] User ${userId} payment info:`, paymentInfo);

    // Calculate earnings for each day of the month
    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(yearNum, monthNum - 1, day);
      const result = await calculateDailyHoursAndEarnings(userId, date);
      dailyEarnings[day.toString()] = result;
      
      // Debug: Log days with hours or earnings
      if (result.hours > 0) {
        console.log(`Day ${day}: ${result.hours}h - $${result.earnings} (hourlyRate: ${paymentInfo?.hourlyRate || 'not set'})`);
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





