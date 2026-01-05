import { NextRequest, NextResponse } from 'next/server';
import { getAuthContext, unauthorizedResponse } from '@/lib/middleware-helpers';
import { prisma } from '@/lib/db';
import { calculateHoursWorked } from '@/lib/payroll-helpers';
import { startOfYear, endOfYear, startOfMonth, endOfMonth } from 'date-fns';
import { PayrollStatus } from '@prisma/client';

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
    
    // Debug logging
    console.log(`[payroll-stats] User: ${userId}, Current: ${currentMonth}/${currentYear}`);
    console.log(`[payroll-stats] Total payroll records: ${payrollRecords.length}`);
    if (payrollRecords.length > 0) {
      const yearRange = payrollRecords.map(p => `${p.year}-${p.month}`).join(', ');
      console.log(`[payroll-stats] Payroll years/months: ${yearRange}`);
    }
    
    // Count all payrolls for current month except REJECTED ones
    const currentMonthPayroll = payrollRecords.find(
      (p) => p.month === currentMonth && 
             p.year === currentYear &&
             p.status !== PayrollStatus.REJECTED
    );
    const currentMonthEarnings = currentMonthPayroll ? Math.abs(currentMonthPayroll.netSalary || 0) : 0;

    // Calculate year-to-date totals
    // Include all payrolls from current year except REJECTED ones
    // This includes PENDING, APPROVED, and PAID payrolls
    const yearToDatePayrolls = payrollRecords.filter((p) => {
      return p.year === currentYear && p.status !== PayrollStatus.REJECTED;
    });
    
    console.log(`[payroll-stats] Year-to-date payrolls (${currentYear}): ${yearToDatePayrolls.length}`);
    yearToDatePayrolls.forEach(p => {
      console.log(`[payroll-stats]   - ${p.month}/${p.year}: $${p.netSalary} (${p.status})`);
    });

    const yearToDateTotal = yearToDatePayrolls.reduce(
      (sum, p) => sum + Math.abs(p.netSalary || 0),
      0
    );
    
    console.log(`[payroll-stats] Year-to-date total: $${yearToDateTotal}`);

    // Calculate average monthly earnings
    // Count all payrolls except REJECTED ones for average
    const allTimePayrolls = payrollRecords.filter((p) => 
      p.status !== PayrollStatus.REJECTED &&
      p.netSalary > 0
    );
    const averageMonthlyEarnings =
      allTimePayrolls.length > 0
        ? allTimePayrolls.reduce((sum, p) => sum + Math.abs(p.netSalary || 0), 0) / allTimePayrolls.length
        : 0;

    // Calculate year-to-date hours from attendance (not from payroll records)
    // This ensures consistency with the attendance page
    let yearToDateHours = 0;
    try {
      // Calculate hours for each month from January up to and including the current month
      for (let month = 1; month <= currentMonth; month++) {
        const hours = await calculateHoursWorked(userId, month, currentYear);
        console.log(`[payroll-stats] Hours for ${month}/${currentYear}: ${hours.toFixed(2)}h`);
        yearToDateHours += hours;
      }
      console.log(`[payroll-stats] Total year-to-date hours: ${yearToDateHours.toFixed(2)}h`);
    } catch (error) {
      console.error('Error calculating year-to-date hours:', error);
      // Fallback: calculate from payroll records if available
      // Use all payrolls from current year up to current month, not just approved ones for hours
      const allYearPayrolls = payrollRecords.filter((p) => 
        p.year === currentYear && p.month <= currentMonth
      );
      yearToDateHours = allYearPayrolls.reduce(
        (sum, p) => sum + (p.hoursWorked || 0),
        0
      );
      console.log(`[payroll-stats] Fallback: Using payroll hours: ${yearToDateHours.toFixed(2)}h`);
    }

    // Count pending payrolls
    const pendingCount = payrollRecords.filter(
      (p) => p.status === PayrollStatus.PENDING
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



