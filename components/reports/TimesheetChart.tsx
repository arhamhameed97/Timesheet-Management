'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { FileText, TrendingUp } from 'lucide-react';

interface TimesheetChartProps {
  statusBreakdown: {
    draft: number;
    submitted: number;
    approved: number;
    rejected: number;
  };
  trends: Array<{
    period: string;
    totalHours: number;
    approvedHours: number;
    averageHours: number;
  }>;
}

const COLORS = {
  draft: '#94a3b8',
  submitted: '#f59e0b',
  approved: '#22c55e',
  rejected: '#ef4444',
};

export function TimesheetChart({ statusBreakdown, trends }: TimesheetChartProps) {
  const pieData = [
    { name: 'Approved', value: statusBreakdown.approved, color: COLORS.approved },
    { name: 'Submitted', value: statusBreakdown.submitted, color: COLORS.submitted },
    { name: 'Draft', value: statusBreakdown.draft, color: COLORS.draft },
    { name: 'Rejected', value: statusBreakdown.rejected, color: COLORS.rejected },
  ].filter(item => item.value > 0);

  const totalTimesheets = statusBreakdown.draft + statusBreakdown.submitted + statusBreakdown.approved + statusBreakdown.rejected;

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Timesheet Status Distribution
          </CardTitle>
        </CardHeader>
        <CardContent>
          {totalTimesheets === 0 ? (
            <div className="flex items-center justify-center h-64 text-muted-foreground">
              No timesheet data available
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {pieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Hours Trend
          </CardTitle>
        </CardHeader>
        <CardContent>
          {trends.length === 0 ? (
            <div className="flex items-center justify-center h-64 text-muted-foreground">
              No timesheet trend data available
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={trends}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                <XAxis dataKey="period" />
                <YAxis />
                <Tooltip 
                  formatter={(value: number, name: string) => {
                    return [`${value.toFixed(1)}h`, name === 'totalHours' ? 'Total Hours' : name === 'approvedHours' ? 'Approved Hours' : 'Average Hours'];
                  }}
                  labelStyle={{ color: '#000' }}
                />
                <Legend />
                <Bar dataKey="totalHours" fill="#3b82f6" name="Total Hours" />
                <Bar dataKey="approvedHours" fill="#22c55e" name="Approved Hours" />
                <Bar dataKey="averageHours" fill="#8b5cf6" name="Average Hours" />
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
