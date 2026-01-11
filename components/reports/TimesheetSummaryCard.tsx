'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { DollarSign, Clock, CheckCircle, XCircle } from 'lucide-react';

interface TimesheetSummaryCardProps {
  earnings: {
    totalEarnings: number;
    regularEarnings: number;
    overtimeEarnings: number;
    averageEarningsPerEmployee: number;
  };
  statusBreakdown: {
    draft: number;
    submitted: number;
    approved: number;
    rejected: number;
  };
}

export function TimesheetSummaryCard({ earnings, statusBreakdown }: TimesheetSummaryCardProps) {
  const totalTimesheets = statusBreakdown.draft + statusBreakdown.submitted + statusBreakdown.approved + statusBreakdown.rejected;
  const approvalRate = totalTimesheets > 0 
    ? (statusBreakdown.approved / totalTimesheets) * 100 
    : 0;

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <DollarSign className="h-5 w-5" />
          Earnings & Status Summary
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="p-3 bg-muted rounded-lg">
            <p className="text-sm text-muted-foreground mb-1">Total Earnings</p>
            <p className="text-2xl font-bold">{formatCurrency(earnings.totalEarnings)}</p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="p-3 border rounded-lg">
              <p className="text-sm text-muted-foreground mb-1">Regular Earnings</p>
              <p className="text-lg font-semibold">{formatCurrency(earnings.regularEarnings)}</p>
            </div>

            <div className="p-3 border rounded-lg">
              <p className="text-sm text-muted-foreground mb-1">Overtime Earnings</p>
              <p className="text-lg font-semibold">{formatCurrency(earnings.overtimeEarnings)}</p>
            </div>
          </div>

          <div className="p-3 border rounded-lg">
            <p className="text-sm text-muted-foreground mb-1">Average per Employee</p>
            <p className="text-lg font-semibold">{formatCurrency(earnings.averageEarningsPerEmployee)}</p>
          </div>

          <div className="pt-4 border-t">
            <p className="text-sm font-medium mb-3">Timesheet Status</p>
            <div className="grid grid-cols-2 gap-3">
              <div className="flex items-center gap-2 p-2 bg-green-50 dark:bg-green-950 rounded">
                <CheckCircle className="h-4 w-4 text-green-600" />
                <div>
                  <p className="text-xs text-muted-foreground">Approved</p>
                  <p className="font-semibold">{statusBreakdown.approved}</p>
                </div>
              </div>

              <div className="flex items-center gap-2 p-2 bg-yellow-50 dark:bg-yellow-950 rounded">
                <Clock className="h-4 w-4 text-yellow-600" />
                <div>
                  <p className="text-xs text-muted-foreground">Submitted</p>
                  <p className="font-semibold">{statusBreakdown.submitted}</p>
                </div>
              </div>

              <div className="flex items-center gap-2 p-2 bg-gray-50 dark:bg-gray-950 rounded">
                <Clock className="h-4 w-4 text-gray-600" />
                <div>
                  <p className="text-xs text-muted-foreground">Draft</p>
                  <p className="font-semibold">{statusBreakdown.draft}</p>
                </div>
              </div>

              <div className="flex items-center gap-2 p-2 bg-red-50 dark:bg-red-950 rounded">
                <XCircle className="h-4 w-4 text-red-600" />
                <div>
                  <p className="text-xs text-muted-foreground">Rejected</p>
                  <p className="font-semibold">{statusBreakdown.rejected}</p>
                </div>
              </div>
            </div>

            {totalTimesheets > 0 && (
              <div className="mt-3 p-2 bg-muted rounded">
                <p className="text-sm text-muted-foreground">Approval Rate</p>
                <p className="text-lg font-semibold">{approvalRate.toFixed(1)}%</p>
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
