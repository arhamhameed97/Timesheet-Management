'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

interface PayrollData {
  month: number;
  year: number;
  netSalary: number;
  status: string;
}

interface EarningsChartProps {
  payrollData: PayrollData[];
  timePeriod?: '3months' | '6months' | '1year' | 'all';
  chartType?: 'line' | 'bar';
}

export function EarningsChart({ 
  payrollData, 
  timePeriod = 'all',
  chartType = 'line' 
}: EarningsChartProps) {
  const [currentPeriod, setCurrentPeriod] = useState<'3months' | '6months' | '1year' | 'all'>(timePeriod);
  const [currentChartType, setCurrentChartType] = useState<'line' | 'bar'>(chartType);

  // Filter data based on time period
  const getFilteredData = () => {
    const now = new Date();
    let cutoffDate: Date;

    switch (currentPeriod) {
      case '3months':
        cutoffDate = new Date(now.getFullYear(), now.getMonth() - 3, 1);
        break;
      case '6months':
        cutoffDate = new Date(now.getFullYear(), now.getMonth() - 6, 1);
        break;
      case '1year':
        cutoffDate = new Date(now.getFullYear() - 1, now.getMonth(), 1);
        break;
      case 'all':
      default:
        return payrollData;
    }

    return payrollData.filter((p) => {
      const payrollDate = new Date(p.year, p.month - 1, 1);
      return payrollDate >= cutoffDate;
    });
  };

  // Transform data for chart
  const getChartData = () => {
    const filtered = getFilteredData();
    
    // Group by month/year and sum earnings
    const grouped = filtered.reduce((acc, p) => {
      const key = `${p.year}-${String(p.month).padStart(2, '0')}`;
      if (!acc[key]) {
        acc[key] = {
          period: key,
          month: p.month,
          year: p.year,
          earnings: 0,
          count: 0,
        };
      }
      acc[key].earnings += Math.abs(p.netSalary);
      acc[key].count += 1;
      return acc;
    }, {} as Record<string, { period: string; month: number; year: number; earnings: number; count: number }>);

    // Convert to array and sort by date
    return Object.values(grouped)
      .sort((a, b) => {
        if (a.year !== b.year) return a.year - b.year;
        return a.month - b.month;
      })
      .map((item) => ({
        period: new Date(item.year, item.month - 1, 1).toLocaleDateString('en-US', { month: 'short', year: 'numeric' }),
        earnings: Math.abs(Math.round(item.earnings * 100) / 100),
      }));
  };

  const chartData = getChartData();

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Earnings Over Time</CardTitle>
          <div className="flex items-center gap-2">
            <div className="flex gap-1 border rounded-md">
              <Button
                variant={currentChartType === 'line' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setCurrentChartType('line')}
                className="h-8"
              >
                Line
              </Button>
              <Button
                variant={currentChartType === 'bar' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setCurrentChartType('bar')}
                className="h-8"
              >
                Bar
              </Button>
            </div>
          </div>
        </div>
        <div className="flex gap-2 mt-2">
          <Button
            variant={currentPeriod === '3months' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setCurrentPeriod('3months')}
          >
            3 Months
          </Button>
          <Button
            variant={currentPeriod === '6months' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setCurrentPeriod('6months')}
          >
            6 Months
          </Button>
          <Button
            variant={currentPeriod === '1year' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setCurrentPeriod('1year')}
          >
            1 Year
          </Button>
          <Button
            variant={currentPeriod === 'all' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setCurrentPeriod('all')}
          >
            All Time
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {chartData.length === 0 ? (
          <div className="flex items-center justify-center h-64 text-gray-500">
            No payroll data available for the selected period
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={300}>
            {currentChartType === 'line' ? (
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="period" />
                <YAxis />
                <Tooltip 
                  formatter={(value: number) => `$${value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                />
                <Legend />
                <Line 
                  type="monotone" 
                  dataKey="earnings" 
                  stroke="#8884d8" 
                  strokeWidth={2}
                  name="Earnings"
                />
              </LineChart>
            ) : (
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="period" />
                <YAxis />
                <Tooltip 
                  formatter={(value: number) => `$${value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                />
                <Legend />
                <Bar dataKey="earnings" fill="#8884d8" name="Earnings" />
              </BarChart>
            )}
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}








