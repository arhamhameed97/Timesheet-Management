import { NextRequest, NextResponse } from 'next/server';
import { getAuthContext, unauthorizedResponse, forbiddenResponse, badRequestResponse } from '@/lib/middleware-helpers';
import { prisma } from '@/lib/db';
import { canManageUser } from '@/lib/permissions';
import { generateTimesheetsForPeriod, generateMonthlyTimesheets } from '@/lib/timesheet-helpers';
import { UserRole } from '@prisma/client';
import { z } from 'zod';

const generateTimesheetSchema = z.object({
  userId: z.string().optional(), // Optional - defaults to current user
  startDate: z.string().optional(), // ISO date string
  endDate: z.string().optional(), // ISO date string
  month: z.number().min(1).max(12).optional(), // 1-12
  year: z.number().min(2000).optional(),
}).refine((data) => {
  // Either provide date range OR month/year
  const hasDateRange = data.startDate && data.endDate;
  const hasMonthYear = data.month && data.year;
  return hasDateRange || hasMonthYear;
}, {
  message: 'Either provide startDate and endDate, or month and year',
});

export async function POST(request: NextRequest) {
  try {
    const context = await getAuthContext(request);
    if (!context) {
      return unauthorizedResponse();
    }

    const body = await request.json();
    const validationResult = generateTimesheetSchema.safeParse(body);
    
    if (!validationResult.success) {
      return NextResponse.json(
        { error: 'Validation error', details: validationResult.error.errors },
        { status: 400 }
      );
    }

    const validatedData = validationResult.data;

    // Determine target user
    let targetUserId = context.userId;

    // If userId is provided, check permissions
    if (validatedData.userId && validatedData.userId !== context.userId) {
      const canGenerate = await canManageUser(context, validatedData.userId);
      if (!canGenerate) {
        return forbiddenResponse('You do not have permission to generate timesheets for this user');
      }
      targetUserId = validatedData.userId;
    }

    let result;

    // Generate based on provided parameters
    if (validatedData.month && validatedData.year) {
      // Generate for specific month
      result = await generateMonthlyTimesheets(
        targetUserId,
        validatedData.month,
        validatedData.year
      );
    } else if (validatedData.startDate && validatedData.endDate) {
      // Generate for date range
      const startDate = new Date(validatedData.startDate);
      const endDate = new Date(validatedData.endDate);
      
      if (endDate < startDate) {
        return badRequestResponse('End date must be after start date');
      }

      result = await generateTimesheetsForPeriod(targetUserId, startDate, endDate);
    } else {
      return badRequestResponse('Either provide startDate and endDate, or month and year');
    }

    return NextResponse.json({
      success: true,
      result,
      message: `Generated ${result.created} new timesheets, updated ${result.updated} existing timesheets, skipped ${result.skipped} timesheets`,
    });
  } catch (error: any) {
    console.error('Generate timesheets error:', error);
    return NextResponse.json(
      { error: 'Failed to generate timesheets', details: error.message },
      { status: 500 }
    );
  }
}
