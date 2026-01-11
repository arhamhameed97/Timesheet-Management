'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Calendar, Clock } from 'lucide-react';

interface AttendanceChartProps {
  dailyBreakdown: Array<{
    date: string;
    totalHours: number;
    averageHours: number;
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
    totalHours: parseFloat(item.totalHours.toFixed(2)),
    averageHours: parseFloat(item.averageHours.toFixed(2)),
  }));

  const weeklyData = trends.map(item => ({
    period: item.period,
    totalHours: parseFloat(item.totalHours.toFixed(2)),
  }));

  const chartData = viewMode === 'daily' ? dailyData : weeklyData;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Hourly Trends
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
            No hourly data available for the selected period
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
                  if (name === 'totalHours') {
                    return [`${value.toFixed(2)}h`, 'Total Hours'];
                  }
                  return [`${value.toFixed(2)}h`, 'Average Hours'];
                }}
                labelStyle={{ color: '#000' }}
              />
              <Legend />
              <Bar dataKey="totalHours" fill="#3b82f6" name="Total Hours" />
              <Bar dataKey="averageHours" fill="#8b5cf6" name="Average Hours" />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
              <XAxis dataKey="period" />
              <YAxis />
              <Tooltip 
                formatter={(value: number) => [`${value.toFixed(2)}h`, 'Total Hours']}
                labelStyle={{ color: '#000' }}
              />
              <Legend />
              <Line 
                type="monotone" 
                dataKey="totalHours" 
                stroke="#3b82f6" 
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
