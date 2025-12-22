import { NextRequest, NextResponse } from 'next/server';
import { getAuthContext, unauthorizedResponse } from '@/lib/middleware-helpers';
import { prisma } from '@/lib/db';
import { PayrollStatus } from '@prisma/client';
import { calculateHoursWorked, calculateDailyHoursAndEarnings } from '@/lib/payroll-helpers';

export async function GET(request: NextRequest) {
  try {
    const context = await getAuthContext(request);
    if (!context) {
      return unauthorizedResponse();
    }

    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId') || context.userId;

    // Employees can only view their own stats
    if (userId !== context.userId && context.role === 'EMPLOYEE') {
      return NextResponse.json(
        { error: 'You can only view your own payroll statistics' },
        { status: 403 }
      );
    }

    // Get all payroll records for the user
    const payrollRecords = await prisma.payroll.findMany({
      where: { userId },
      orderBy: [
        { year: 'desc' },
        { month: 'desc' },
      ],
    });

    // Parse bonuses and deductions
    const parsedPayroll = payrollRecords.map((p) => ({
      ...p,
      bonuses: p.bonuses ? (typeof p.bonuses === 'string' ? JSON.parse(p.bonuses) : p.bonuses) : [],
      deductions: p.deductions ? (typeof p.deductions === 'string' ? JSON.parse(p.deductions) : p.deductions) : [],
    }));

    // Calculate statistics
    // Use UTC to match attendance record dates
    const currentDate = new Date();
    const currentMonth = currentDate.getUTCMonth() + 1;
    const currentYear = currentDate.getUTCFullYear();

    // Calculate current month earnings from daily attendance records (not payroll records)
    // This ensures accuracy even if payroll hasn't been created yet
    // Use UTC dates to match attendance record dates
    let currentMonthEarnings = 0;
    const daysInCurrentMonth = new Date(currentYear, currentMonth, 0).getDate();
    for (let day = 1; day <= daysInCurrentMonth; day++) {
      const date = new Date(Date.UTC(currentYear, currentMonth - 1, day));
      const dailyData = await calculateDailyHoursAndEarnings(userId, date);
      currentMonthEarnings += dailyData.earnings;
    }
    currentMonthEarnings = Math.round(currentMonthEarnings * 100) / 100;

    // Calculate year-to-date total from daily attendance records (not payroll records)
    // Use UTC dates to match attendance record dates
    let yearToDateTotal = 0;
    for (let month = 1; month <= currentMonth; month++) {
      const daysInMonth = new Date(currentYear, month, 0).getDate();
      for (let day = 1; day <= daysInMonth; day++) {
        const date = new Date(Date.UTC(currentYear, month - 1, day));
        const dailyData = await calculateDailyHoursAndEarnings(userId, date);
        yearToDateTotal += dailyData.earnings;
      }
    }
    yearToDateTotal = Math.round(yearToDateTotal * 100) / 100;

    // All-time total
    const allTimeTotal = parsedPayroll.reduce((sum, p) => sum + p.netSalary, 0);

    // Average monthly earnings (from all records)
    const averageMonthlyEarnings =
      parsedPayroll.length > 0 ? allTimeTotal / parsedPayroll.length : 0;

    // Pending payrolls count
    const pendingCount = parsedPayroll.filter(
      (p) => p.status === PayrollStatus.PENDING
    ).length;

    // Calculate total hours worked from actual attendance records (not from Payroll records)
    // This ensures consistency with the calendar which calculates from attendance
    
    // Current month hours - calculate from attendance records
    const currentMonthHours = await calculateHoursWorked(userId, currentMonth, currentYear);
    
    // Year-to-date hours - calculate from attendance records for each month in the current year
    let yearToDateHours = 0;
    for (let month = 1; month <= currentMonth; month++) {
      const monthHours = await calculateHoursWorked(userId, month, currentYear);
      yearToDateHours += monthHours;
    }
    yearToDateHours = Math.round(yearToDateHours * 100) / 100;
    
    // All-time total hours - calculate from attendance records for all years with payroll
    // Get all unique years from payroll records
    const allYears = new Set<number>();
    parsedPayroll.forEach((p) => {
      allYears.add(p.year);
    });
    
    // If no payroll records, still calculate current year
    if (allYears.size === 0) {
      allYears.add(currentYear);
    }
    
    // Calculate hours for all months in all years that have payroll records
    let allTimeHours = 0;
    for (const year of allYears) {
      // Calculate for all 12 months of each year (not just months with payroll)
      // This ensures we capture all attendance, even if payroll wasn't created for some months
      for (let month = 1; month <= 12; month++) {
        const monthHours = await calculateHoursWorked(userId, month, year);
        allTimeHours += monthHours;
      }
    }
    allTimeHours = Math.round(allTimeHours * 100) / 100;

    // Monthly breakdown for the current year
    const monthlyBreakdown = Array.from({ length: 12 }, (_, i) => {
      const month = i + 1;
      const monthPayroll = parsedPayroll.find(
        (p) => p.month === month && p.year === currentYear
      );
      return {
        month,
        monthName: new Date(currentYear, i, 1).toLocaleString('default', { month: 'long' }),
        earnings: monthPayroll?.netSalary || 0,
        status: monthPayroll?.status || null,
      };
    });

    // Yearly breakdown
    const yearlyBreakdown = parsedPayroll.reduce((acc, p) => {
      const year = p.year;
      if (!acc[year]) {
        acc[year] = {
          year,
          totalEarnings: 0,
          payrollCount: 0,
        };
      }
      acc[year].totalEarnings += p.netSalary;
      acc[year].payrollCount += 1;
      return acc;
    }, {} as Record<number, { year: number; totalEarnings: number; payrollCount: number }>);

    const yearlyBreakdownArray = Object.values(yearlyBreakdown).sort(
      (a, b) => b.year - a.year
    );

    return NextResponse.json({
      stats: {
        currentMonthEarnings: Math.abs(currentMonthEarnings),
        yearToDateTotal: Math.abs(yearToDateTotal),
        allTimeTotal: Math.abs(allTimeTotal),
        averageMonthlyEarnings: Math.round(Math.abs(averageMonthlyEarnings) * 100) / 100,
        pendingCount,
        totalPayrolls: parsedPayroll.length,
        currentMonthHours: Math.abs(currentMonthHours),
        yearToDateHours: Math.round(yearToDateHours * 100) / 100,
        allTimeHours: Math.round(allTimeHours * 100) / 100,
      },
      monthlyBreakdown,
      yearlyBreakdown: yearlyBreakdownArray,
    });
  } catch (error) {
    console.error('Get payroll stats error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch payroll statistics' },
      { status: 500 }
    );
  }
}


