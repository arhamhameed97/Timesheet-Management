import { NextRequest, NextResponse } from 'next/server';
import { generateMonthlyTimesheetsForAllEmployees } from '@/lib/timesheet-helpers';

export async function GET(request: NextRequest) {
  try {
    // Verify cron secret for security
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET || 'default-secret-change-in-production';
    
    if (authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Get month and year from query params, or use previous month
    const { searchParams } = new URL(request.url);
    const monthParam = searchParams.get('month');
    const yearParam = searchParams.get('year');
    const companyId = searchParams.get('companyId');

    let month: number;
    let year: number;

    if (monthParam && yearParam) {
      month = parseInt(monthParam, 10);
      year = parseInt(yearParam, 10);
    } else {
      // Default to previous month
      const now = new Date();
      month = now.getMonth(); // 0-indexed (0-11)
      year = now.getFullYear();
      
      // If current month is January, previous month is December of previous year
      if (month === 0) {
        month = 12;
        year -= 1;
      }
      
      // Convert to 1-indexed for the function
      month = month; // Already 1-indexed after adjustment
    }

    // Validate month and year
    if (month < 1 || month > 12) {
      return NextResponse.json(
        { error: 'Invalid month. Must be between 1 and 12.' },
        { status: 400 }
      );
    }

    if (year < 2000 || year > 2100) {
      return NextResponse.json(
        { error: 'Invalid year.' },
        { status: 400 }
      );
    }

    // Generate timesheets for all employees
    const result = await generateMonthlyTimesheetsForAllEmployees(
      month,
      year,
      companyId || null
    );

    // Calculate summary statistics
    const summary = {
      totalProcessed: result.totalProcessed,
      totalCreated: result.results.reduce((sum, r) => sum + r.result.created, 0),
      totalUpdated: result.results.reduce((sum, r) => sum + r.result.updated, 0),
      totalSkipped: result.results.reduce((sum, r) => sum + r.result.skipped, 0),
      totalErrors: result.results.reduce((sum, r) => sum + r.result.errors.length, 0),
    };

    return NextResponse.json({
      success: true,
      month,
      year,
      companyId: companyId || 'all',
      summary,
      details: result.results,
      message: `Generated timesheets for ${summary.totalProcessed} employees. Created: ${summary.totalCreated}, Updated: ${summary.totalUpdated}, Skipped: ${summary.totalSkipped}, Errors: ${summary.totalErrors}`,
    });
  } catch (error: any) {
    console.error('Cron generate timesheets error:', error);
    return NextResponse.json(
      { error: 'Failed to generate timesheets', details: error.message },
      { status: 500 }
    );
  }
}
