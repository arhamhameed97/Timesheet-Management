'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Calendar, TrendingUp } from 'lucide-react';

interface AttendanceChartProps {
  dailyBreakdown: Array<{
    date: string;
    present: number;
    absent: number;
    late: number;
    total: number;
  }>;
  trends: Array<{
    period: string;
    attendanceRate: number;
    totalHours: number;
  }>;
}

export function AttendanceChart({ dailyBreakdown, trends }: AttendanceChartProps) {
  const [viewMode, setViewMode] = useState<'daily' | 'weekly'>('daily');

  const dailyData = dailyBreakdown.map(item => ({
    date: new Date(item.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    present: item.present,
    absent: item.absent,
    late: item.late,
    attendanceRate: item.total > 0 ? ((item.present / item.total) * 100).toFixed(1) : 0,
  }));

  const weeklyData = trends.map(item => ({
    period: item.period,
    attendanceRate: parseFloat(item.attendanceRate.toFixed(1)),
    totalHours: parseFloat(item.totalHours.toFixed(1)),
  }));

  const chartData = viewMode === 'daily' ? dailyData : weeklyData;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Attendance Trends
          </CardTitle>
          <div className="flex gap-2">
            <Button
              variant={viewMode === 'daily' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setViewMode('daily')}
            >
              <Calendar className="h-4 w-4 mr-1" />
              Daily
            </Button>
            <Button
              variant={viewMode === 'weekly' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setViewMode('weekly')}
            >
              Weekly
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {chartData.length === 0 ? (
          <div className="flex items-center justify-center h-64 text-muted-foreground">
            No attendance data available for the selected period
          </div>
        ) : viewMode === 'daily' ? (
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
              <XAxis 
                dataKey="date" 
                angle={-45}
                textAnchor="end"
                height={80}
                fontSize={12}
              />
              <YAxis />
              <Tooltip 
                formatter={(value: number, name: string) => {
                  if (name === 'attendanceRate') {
                    return [`${value}%`, 'Attendance Rate'];
                  }
                  return [value, name.charAt(0).toUpperCase() + name.slice(1)];
                }}
                labelStyle={{ color: '#000' }}
              />
              <Legend />
              <Bar dataKey="present" stackId="a" fill="#22c55e" name="Present" />
              <Bar dataKey="late" stackId="a" fill="#f59e0b" name="Late" />
              <Bar dataKey="absent" stackId="a" fill="#ef4444" name="Absent" />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
              <XAxis dataKey="period" />
              <YAxis yAxisId="left" />
              <YAxis yAxisId="right" orientation="right" />
              <Tooltip 
                formatter={(value: number, name: string) => {
                  if (name === 'attendanceRate') {
                    return [`${value}%`, 'Attendance Rate'];
                  }
                  return [`${value}h`, 'Total Hours'];
                }}
                labelStyle={{ color: '#000' }}
              />
              <Legend />
              <Line 
                yAxisId="left"
                type="monotone" 
                dataKey="attendanceRate" 
                stroke="#3b82f6" 
                strokeWidth={2}
                name="Attendance Rate (%)"
                dot={{ r: 4 }}
              />
              <Line 
                yAxisId="right"
                type="monotone" 
                dataKey="totalHours" 
                stroke="#8b5cf6" 
                strokeWidth={2}
                name="Total Hours"
                dot={{ r: 4 }}
              />
            </LineChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}
