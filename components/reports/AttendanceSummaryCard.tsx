'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Clock, TrendingUp, TrendingDown, Calendar } from 'lucide-react';

interface AttendanceSummaryCardProps {
  patterns: {
    mostActiveDay: string;
    leastActiveDay: string;
    averageCheckInTime: string;
    averageCheckOutTime: string;
  };
  attendanceRate: number;
  previousAttendanceRate: number;
}

export function AttendanceSummaryCard({ patterns, attendanceRate, previousAttendanceRate }: AttendanceSummaryCardProps) {
  const growth = previousAttendanceRate > 0 
    ? ((attendanceRate - previousAttendanceRate) / previousAttendanceRate) * 100 
    : 0;
  const isPositive = growth >= 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Clock className="h-5 w-5" />
          Attendance Patterns & Insights
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
            <div>
              <p className="text-sm text-muted-foreground">Current Attendance Rate</p>
              <p className="text-2xl font-bold">{attendanceRate.toFixed(1)}%</p>
            </div>
            {previousAttendanceRate > 0 && (
              <div className={`flex items-center gap-1 ${isPositive ? 'text-green-600' : 'text-red-600'}`}>
                {isPositive ? (
                  <TrendingUp className="h-5 w-5" />
                ) : (
                  <TrendingDown className="h-5 w-5" />
                )}
                <span className="font-semibold">
                  {isPositive ? '+' : ''}{growth.toFixed(1)}%
                </span>
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="p-3 border rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <p className="text-sm font-medium">Most Active Day</p>
              </div>
              <p className="text-lg font-bold">{patterns.mostActiveDay || 'N/A'}</p>
            </div>

            <div className="p-3 border rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <p className="text-sm font-medium">Least Active Day</p>
              </div>
              <p className="text-lg font-bold">{patterns.leastActiveDay || 'N/A'}</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="p-3 border rounded-lg">
              <p className="text-sm text-muted-foreground mb-1">Average Check-In</p>
              <p className="text-lg font-semibold">{patterns.averageCheckInTime || 'N/A'}</p>
            </div>

            <div className="p-3 border rounded-lg">
              <p className="text-sm text-muted-foreground mb-1">Average Check-Out</p>
              <p className="text-lg font-semibold">{patterns.averageCheckOutTime || 'N/A'}</p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
