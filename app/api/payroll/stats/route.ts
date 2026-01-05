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
      (sum, p) => {
        const netSalary = p.netSalary ?? 0;
        return sum + Math.abs(netSalary);
      },
      0
    );
    
    console.log(`[payroll-stats] Year-to-date total: $${yearToDateTotal}`);
    console.log(`[payroll-stats] Year-to-date payrolls breakdown:`, yearToDatePayrolls.map(p => ({
      month: p.month,
      year: p.year,
      netSalary: p.netSalary,
      status: p.status
    })));

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
        const hoursValue = hours ?? 0;
        console.log(`[payroll-stats] Hours for ${month}/${currentYear}: ${hoursValue.toFixed(2)}h`);
        yearToDateHours += hoursValue;
      }
      console.log(`[payroll-stats] Total year-to-date hours from attendance: ${yearToDateHours.toFixed(2)}h`);
    } catch (error) {
      console.error('Error calculating year-to-date hours from attendance:', error);
    }
    
    // If attendance-based calculation returned 0, try fallback to payroll records
    // This handles cases where attendance records might not have checkOutTime but payroll was created
    if (yearToDateHours === 0) {
      const allYearPayrolls = payrollRecords.filter((p) => 
        p.year === currentYear && p.month <= currentMonth && p.hoursWorked != null
      );
      const payrollHours = allYearPayrolls.reduce(
        (sum, p) => {
          const hours = p.hoursWorked ?? 0;
          return sum + hours;
        },
        0
      );
      if (payrollHours > 0) {
        console.log(`[payroll-stats] Using payroll hours as fallback: ${payrollHours.toFixed(2)}h`);
        yearToDateHours = payrollHours;
      }
    }
    
    // Ensure yearToDateHours is a valid number
    yearToDateHours = Number.isFinite(yearToDateHours) ? yearToDateHours : 0;

    // Count pending payrolls
    const pendingCount = payrollRecords.filter(
      (p) => p.status === PayrollStatus.PENDING
    ).length;

    // Ensure all values are valid numbers
    const stats = {
      currentMonthEarnings: Number.isFinite(currentMonthEarnings) ? currentMonthEarnings : 0,
      yearToDateTotal: Number.isFinite(yearToDateTotal) ? yearToDateTotal : 0,
      averageMonthlyEarnings: Number.isFinite(averageMonthlyEarnings) ? averageMonthlyEarnings : 0,
      yearToDateHours: Number.isFinite(yearToDateHours) ? yearToDateHours : 0,
      pendingCount: Number.isFinite(pendingCount) ? pendingCount : 0,
    };
    
    console.log(`[payroll-stats] Final stats:`, stats);
    
    return NextResponse.json({
      stats,
    });
  } catch (error) {
    console.error('Get payroll stats error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch payroll stats' },
      { status: 500 }
    );
  }
}



