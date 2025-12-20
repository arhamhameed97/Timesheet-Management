import { NextRequest, NextResponse } from 'next/server';
import { getAuthContext, unauthorizedResponse } from '@/lib/middleware-helpers';
import { prisma } from '@/lib/db';
import { PayrollStatus } from '@prisma/client';

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
    const currentDate = new Date();
    const currentMonth = currentDate.getMonth() + 1;
    const currentYear = currentDate.getFullYear();

    // Current month earnings
    const currentMonthPayroll = parsedPayroll.find(
      (p) => p.month === currentMonth && p.year === currentYear
    );
    const currentMonthEarnings = currentMonthPayroll?.netSalary || 0;

    // Year-to-date total
    const yearToDateTotal = parsedPayroll
      .filter((p) => p.year === currentYear)
      .reduce((sum, p) => sum + p.netSalary, 0);

    // All-time total
    const allTimeTotal = parsedPayroll.reduce((sum, p) => sum + p.netSalary, 0);

    // Average monthly earnings (from all records)
    const averageMonthlyEarnings =
      parsedPayroll.length > 0 ? allTimeTotal / parsedPayroll.length : 0;

    // Pending payrolls count
    const pendingCount = parsedPayroll.filter(
      (p) => p.status === PayrollStatus.PENDING
    ).length;

    // Calculate total hours worked
    // Current month hours
    const currentMonthHours = currentMonthPayroll?.hoursWorked || 0;
    
    // Year-to-date hours
    const yearToDateHours = parsedPayroll
      .filter((p) => p.year === currentYear && p.hoursWorked !== null)
      .reduce((sum, p) => sum + Math.abs(p.hoursWorked || 0), 0);
    
    // All-time total hours
    const allTimeHours = parsedPayroll
      .filter((p) => p.hoursWorked !== null)
      .reduce((sum, p) => sum + Math.abs(p.hoursWorked || 0), 0);

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

