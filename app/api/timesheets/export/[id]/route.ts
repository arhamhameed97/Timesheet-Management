import { NextRequest, NextResponse } from 'next/server';
import { getAuthContext, unauthorizedResponse, forbiddenResponse } from '@/lib/middleware-helpers';
import { canManageUser } from '@/lib/permissions';
import { getEnrichedTimesheetData, getEnrichedTimesheetDataForPeriod } from '@/lib/timesheet-helpers';
import { renderToBuffer } from '@react-pdf/renderer';
import { TimesheetPDFSummary } from '@/components/timesheets/TimesheetPDFSummary';
import { TimesheetPDFDetailed } from '@/components/timesheets/TimesheetPDFDetailed';
import React from 'react';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const context = await getAuthContext(request);
    if (!context) {
      return unauthorizedResponse();
    }

    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type') || 'detailed'; // 'summary' or 'detailed'
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    // If id is 'period', we're exporting a date range
    if (params.id === 'period' && startDate && endDate) {
      const userId = searchParams.get('userId') || context.userId;
      
      // Check permissions
      if (userId !== context.userId) {
        const canView = await canManageUser(context, userId);
        if (!canView) {
          return forbiddenResponse('You do not have permission to export this timesheet');
        }
      }

      const start = new Date(startDate);
      const end = new Date(endDate);
      
      const data = await getEnrichedTimesheetDataForPeriod(userId, start, end);
      
      if (!data || data.timesheets.length === 0) {
        return NextResponse.json(
          { error: 'No timesheets found for the specified period' },
          { status: 404 }
        );
      }

      // Get user info
      const { prisma } = await import('@/lib/db');
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: {
          name: true,
          email: true,
          company: { select: { name: true } },
          designation: { select: { name: true } },
        },
      });

      if (!user) {
        return NextResponse.json(
          { error: 'User not found' },
          { status: 404 }
        );
      }

      // Calculate average hourly rate
      const ratesWithValues = data.timesheets
        .map(ts => ts.hourlyRate)
        .filter((rate): rate is number => rate !== null && rate > 0);
      const averageHourlyRate = ratesWithValues.length > 0
        ? ratesWithValues.reduce((sum, rate) => sum + rate, 0) / ratesWithValues.length
        : null;

      // Determine status (use most common status or highest priority)
      const statusCounts = new Map<string, number>();
      data.timesheets.forEach(ts => {
        statusCounts.set(ts.status, (statusCounts.get(ts.status) || 0) + 1);
      });
      const status = Array.from(statusCounts.entries())
        .sort((a, b) => b[1] - a[1])[0]?.[0] || 'DRAFT';

      // Get approver info (from first approved timesheet)
      const approvedTimesheet = data.timesheets.find(ts => ts.approver);
      const approver = approvedTimesheet?.approver || null;
      const approvedAt = approvedTimesheet?.approvedAt?.toISOString() || null;

      let pdfDoc;
      if (type === 'summary') {
        pdfDoc = React.createElement(TimesheetPDFSummary, {
          employee: user,
          period: { startDate, endDate },
          totals: data.totals,
          averageHourlyRate,
          status,
          approver,
          approvedAt,
        });
      } else {
        pdfDoc = React.createElement(TimesheetPDFDetailed, {
          employee: user,
          period: { startDate, endDate },
          entries: data.timesheets.map(ts => ({
            id: ts.id,
            date: ts.date.toISOString(),
            hours: ts.hours,
            regularHours: ts.regularHours,
            overtimeHours: ts.overtimeHours,
            hourlyRate: ts.hourlyRate,
            earnings: ts.earnings,
            attendance: ts.attendance,
            taskLogs: ts.taskLogs,
          })),
          totals: data.totals,
          status,
          approver,
          approvedAt,
        });
      }

      const pdfBuffer = await renderToBuffer(pdfDoc);

      return new NextResponse(pdfBuffer, {
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': `attachment; filename="timesheet-${type}-${startDate}-${endDate}.pdf"`,
        },
      });
    }

    // Single timesheet export
    const timesheetId = params.id;
    const enrichedData = await getEnrichedTimesheetData(timesheetId);

    if (!enrichedData) {
      return NextResponse.json(
        { error: 'Timesheet not found' },
        { status: 404 }
      );
    }

    // Check permissions
    if (enrichedData.userId !== context.userId) {
      const canView = await canManageUser(context, enrichedData.userId);
      if (!canView) {
        return forbiddenResponse('You do not have permission to export this timesheet');
      }
    }

    // Get date range for single timesheet (just that date)
    const dateStr = enrichedData.date.toISOString().split('T')[0];

    let pdfDoc;
    if (type === 'summary') {
      pdfDoc = React.createElement(TimesheetPDFSummary, {
        employee: enrichedData.user,
        period: { startDate: dateStr, endDate: dateStr },
        totals: {
          totalHours: enrichedData.hours,
          totalRegularHours: enrichedData.regularHours,
          totalOvertimeHours: enrichedData.overtimeHours,
          totalEarnings: enrichedData.earnings,
        },
        averageHourlyRate: enrichedData.hourlyRate,
        status: enrichedData.status,
        approver: enrichedData.approver || null,
        approvedAt: enrichedData.approvedAt?.toISOString() || null,
      });
    } else {
      pdfDoc = React.createElement(TimesheetPDFDetailed, {
        employee: enrichedData.user,
        period: { startDate: dateStr, endDate: dateStr },
        entries: [{
          id: enrichedData.id,
          date: enrichedData.date.toISOString(),
          hours: enrichedData.hours,
          regularHours: enrichedData.regularHours,
          overtimeHours: enrichedData.overtimeHours,
          hourlyRate: enrichedData.hourlyRate,
          earnings: enrichedData.earnings,
          attendance: enrichedData.attendance,
          taskLogs: enrichedData.taskLogs,
        }],
        totals: {
          totalHours: enrichedData.hours,
          totalRegularHours: enrichedData.regularHours,
          totalOvertimeHours: enrichedData.overtimeHours,
          totalEarnings: enrichedData.earnings,
        },
        status: enrichedData.status,
        approver: enrichedData.approver || null,
        approvedAt: enrichedData.approvedAt?.toISOString() || null,
      });
    }

    const pdfBuffer = await renderToBuffer(pdfDoc);

    return new NextResponse(pdfBuffer, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="timesheet-${type}-${dateStr}.pdf"`,
      },
    });
  } catch (error: any) {
    console.error('Export timesheet PDF error:', error);
    return NextResponse.json(
      { error: 'Failed to export timesheet', details: error.message },
      { status: 500 }
    );
  }
}
