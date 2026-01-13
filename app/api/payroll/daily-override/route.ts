import { NextRequest, NextResponse } from 'next/server';
import { getAuthContext, unauthorizedResponse, forbiddenResponse } from '@/lib/middleware-helpers';
import { prisma } from '@/lib/db';
import { canManageUser } from '@/lib/permissions';
import { UserRole } from '@prisma/client';
import { calculateOvertimePay, getOvertimeConfig, recalculateMonthlyPayroll } from '@/lib/payroll-helpers';
import { z } from 'zod';

const createDailyOverrideSchema = z.object({
  userId: z.string(),
  date: z.string(), // ISO date string
  hourlyRate: z.number().min(0).optional(),
  regularHours: z.number().min(0).optional(),
  overtimeHours: z.number().min(0).optional(),
  totalHours: z.number().min(0).optional(),
  earnings: z.number().min(0).optional(),
  notes: z.string().optional(),
});

export async function POST(request: NextRequest) {
  try {
    const context = await getAuthContext(request);
    if (!context) {
      return unauthorizedResponse();
    }

    // Only admins/managers can create overrides
    if (context.role === UserRole.EMPLOYEE) {
      return forbiddenResponse('Only admins and managers can edit daily payroll data');
    }

    const body = await request.json();
    const validationResult = createDailyOverrideSchema.safeParse(body);

    if (!validationResult.success) {
      return NextResponse.json(
        { error: 'Validation error', details: validationResult.error.errors },
        { status: 400 }
      );
    }

    const validatedData = validationResult.data;

    // Check permissions
    const canManage = await canManageUser(context, validatedData.userId);
    if (!canManage) {
      return forbiddenResponse('You do not have permission to edit this employee\'s payroll');
    }

    // Parse date - ensure it's in UTC to match database storage
    const dateParts = validatedData.date.split('-');
    if (dateParts.length !== 3) {
      return NextResponse.json(
        { error: 'Invalid date format. Expected YYYY-MM-DD' },
        { status: 400 }
      );
    }
    const year = parseInt(dateParts[0]);
    const month = parseInt(dateParts[1]) - 1; // JavaScript months are 0-indexed
    const day = parseInt(dateParts[2]);
    const date = new Date(Date.UTC(year, month, day, 0, 0, 0, 0));

    // Validate date is not in the future (optional, but good practice)
    if (date > new Date()) {
      return NextResponse.json(
        { error: 'Cannot create override for future dates' },
        { status: 400 }
      );
    }

    // Calculate total hours if not provided
    let totalHours = validatedData.totalHours;
    if (!totalHours) {
      const regularHours = validatedData.regularHours ?? 0;
      const overtimeHours = validatedData.overtimeHours ?? 0;
      totalHours = regularHours + overtimeHours;
    }

    // Validate total hours doesn't exceed 24
    if (totalHours > 24) {
      return NextResponse.json(
        { error: 'Total hours cannot exceed 24 hours per day' },
        { status: 400 }
      );
    }

    // Get hourly rate if not provided
    let hourlyRate = validatedData.hourlyRate;
    if (!hourlyRate) {
      const { getHourlyRateForDate } = await import('@/lib/payroll-helpers');
      const fetchedRate = await getHourlyRateForDate(validatedData.userId, date);
      hourlyRate = fetchedRate ?? undefined;
    }

    // Calculate earnings if not provided
    let earnings = validatedData.earnings;
    if (earnings === undefined && hourlyRate && totalHours > 0) {
      const regularHours = validatedData.regularHours ?? 0;
      const overtimeHours = validatedData.overtimeHours ?? 0;
      const config = await getOvertimeConfig(validatedData.userId);
      const regularPay = regularHours * hourlyRate;
      const overtimePay = calculateOvertimePay(overtimeHours, hourlyRate, config?.overtimeMultiplier || 1.5);
      earnings = regularPay + overtimePay;
    }

    // Create or update override
    const override = await prisma.dailyPayrollOverride.upsert({
      where: {
        userId_date: {
          userId: validatedData.userId,
          date,
        },
      },
      create: {
        userId: validatedData.userId,
        date,
        hourlyRate,
        regularHours: validatedData.regularHours ?? null,
        overtimeHours: validatedData.overtimeHours ?? null,
        totalHours,
        earnings: earnings ?? null,
        notes: validatedData.notes ?? null,
        createdBy: context.userId,
      },
      update: {
        hourlyRate,
        regularHours: validatedData.regularHours ?? null,
        overtimeHours: validatedData.overtimeHours ?? null,
        totalHours,
        earnings: earnings ?? null,
        notes: validatedData.notes ?? null,
      },
    });

    // Check if payroll exists for this month and recalculate
    const month = date.getMonth() + 1;
    const year = date.getFullYear();
    const payroll = await prisma.payroll.findUnique({
      where: {
        userId_month_year: {
          userId: validatedData.userId,
          month,
          year,
        },
      },
    });

    if (payroll) {
      try {
        await recalculateMonthlyPayroll(payroll.id);
      } catch (error) {
        console.error('Error recalculating payroll:', error);
        // Don't fail the request if recalculation fails
      }
    }

    // Get updated daily earnings for response
    const { calculateDailyHoursAndEarnings } = await import('@/lib/payroll-helpers');
    const updatedDailyData = await calculateDailyHoursAndEarnings(validatedData.userId, date);

    return NextResponse.json({
      override,
      dailyData: updatedDailyData,
    }, { status: 201 });
  } catch (error: any) {
    console.error('Create daily override error:', error);
    if (error.code === 'P2002') {
      return NextResponse.json(
        { error: 'Override already exists for this date' },
        { status: 409 }
      );
    }
    return NextResponse.json(
      { error: 'Failed to create daily override' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const context = await getAuthContext(request);
    if (!context) {
      return unauthorizedResponse();
    }

    // Only admins/managers can delete overrides
    if (context.role === UserRole.EMPLOYEE) {
      return forbiddenResponse('Only admins and managers can delete daily payroll overrides');
    }

    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    const dateStr = searchParams.get('date');

    if (!userId || !dateStr) {
      return NextResponse.json(
        { error: 'userId and date are required' },
        { status: 400 }
      );
    }

    // Check permissions
    const canManage = await canManageUser(context, userId);
    if (!canManage) {
      return forbiddenResponse('You do not have permission to delete this employee\'s payroll override');
    }

    // Parse date - ensure it's in UTC to match database storage
    // Date strings like "2026-01-07" should be parsed as UTC dates
    const dateParts = dateStr.split('-');
    if (dateParts.length !== 3) {
      return NextResponse.json(
        { error: 'Invalid date format. Expected YYYY-MM-DD' },
        { status: 400 }
      );
    }
    const year = parseInt(dateParts[0]);
    const month = parseInt(dateParts[1]) - 1; // JavaScript months are 0-indexed
    const day = parseInt(dateParts[2]);
    const date = new Date(Date.UTC(year, month, day, 0, 0, 0, 0));

    // Check if override exists first
    const existingOverride = await prisma.dailyPayrollOverride.findUnique({
      where: {
        userId_date: {
          userId,
          date,
        },
      },
    });

    if (!existingOverride) {
      return NextResponse.json(
        { error: 'Override not found' },
        { status: 404 }
      );
    }

    // Delete override
    await prisma.dailyPayrollOverride.delete({
      where: {
        userId_date: {
          userId,
          date,
        },
      },
    });

    // Check if payroll exists for this month and recalculate
    const month = date.getMonth() + 1;
    const year = date.getFullYear();
    const payroll = await prisma.payroll.findUnique({
      where: {
        userId_month_year: {
          userId,
          month,
          year,
        },
      },
    });

    if (payroll) {
      try {
        await recalculateMonthlyPayroll(payroll.id);
      } catch (error) {
        console.error('Error recalculating payroll:', error);
        // Don't fail the request if recalculation fails
      }
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Delete daily override error:', error);
    if (error.code === 'P2025') {
      return NextResponse.json(
        { error: 'Override not found' },
        { status: 404 }
      );
    }
    return NextResponse.json(
      { error: 'Failed to delete daily override' },
      { status: 500 }
    );
  }
}
