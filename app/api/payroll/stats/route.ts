import { NextRequest, NextResponse } from 'next/server';
import { getAuthContext, unauthorizedResponse } from '@/lib/middleware-helpers';
import { prisma } from '@/lib/db';
import { calculateHoursWorked } from '@/lib/payroll-helpers';
import { startOfYear, endOfYear, startOfMonth, endOfMonth } from 'date-fns';

export async function GET(request: NextRequest) {
  try {
    const context = await getAuthContext(request);
    if (!context) {
      return unauthorizedResponse();
    }

    const userId = context.userId;

    // Get all payroll records for the user
    const payrollRecords = await prisma.payroll.findMany({
      where: {
        userId,
      },
      orderBy: [
        { year: 'desc' },
        { month: 'desc' },
      ],
    });

    // Calculate current month earnings
    const now = new Date();
    const currentMonth = now.getMonth() + 1;
    const currentYear = now.getFullYear();
    
    const currentMonthPayroll = payrollRecords.find(
      (p) => p.month === currentMonth && p.year === currentYear
    );
    const currentMonthEarnings = currentMonthPayroll?.netSalary || 0;

    // Calculate year-to-date totals
    const yearStart = startOfYear(now);
    const yearEnd = endOfYear(now);
    
    const yearToDatePayrolls = payrollRecords.filter((p) => {
      const payrollDate = new Date(p.year, p.month - 1, 1);
      return payrollDate >= yearStart && payrollDate <= yearEnd;
    });

    const yearToDateTotal = yearToDatePayrolls.reduce(
      (sum, p) => sum + (p.netSalary || 0),
      0
    );

    // Calculate average monthly earnings
    const allTimePayrolls = payrollRecords.filter((p) => p.netSalary > 0);
    const averageMonthlyEarnings =
      allTimePayrolls.length > 0
        ? allTimePayrolls.reduce((sum, p) => sum + (p.netSalary || 0), 0) / allTimePayrolls.length
        : 0;

    // Calculate year-to-date hours from attendance (not from payroll records)
    // This ensures consistency with the attendance page
    let yearToDateHours = 0;
    try {
      // Calculate hours for each month in the current year
      for (let month = 1; month <= currentMonth; month++) {
        const hours = await calculateHoursWorked(userId, month, currentYear);
        yearToDateHours += hours;
      }
    } catch (error) {
      console.error('Error calculating year-to-date hours:', error);
      // Fallback: calculate from payroll records if available
      yearToDateHours = yearToDatePayrolls.reduce(
        (sum, p) => sum + (p.hoursWorked || 0),
        0
      );
    }

    // Count pending payrolls
    const pendingCount = payrollRecords.filter(
      (p) => p.status === 'PENDING'
    ).length;

    return NextResponse.json({
      stats: {
        currentMonthEarnings,
        yearToDateTotal,
        averageMonthlyEarnings,
        yearToDateHours,
        pendingCount,
      },
    });
  } catch (error) {
    console.error('Get payroll stats error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch payroll stats' },
      { status: 500 }
    );
  }
}

