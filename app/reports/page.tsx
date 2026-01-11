'use client';

import { useState, useEffect } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { BarChart3, TrendingUp, Users, Clock, RefreshCw, Download, Calendar } from 'lucide-react';
import { AttendanceChart } from '@/components/reports/AttendanceChart';
import { TimesheetChart } from '@/components/reports/TimesheetChart';
import { EmployeePerformanceTable } from '@/components/reports/EmployeePerformanceTable';
import { AttendanceSummaryCard } from '@/components/reports/AttendanceSummaryCard';
import { TimesheetSummaryCard } from '@/components/reports/TimesheetSummaryCard';
import { format, startOfMonth, endOfMonth, subMonths, startOfYear, endOfYear, startOfDay, endOfDay } from 'date-fns';
import { useToast } from '@/hooks/use-toast';

type PeriodType = 'currentMonth' | 'lastMonth' | 'last3Months' | 'last6Months' | 'thisYear' | 'custom';

interface ReportsData {
  summary: {
    totalEmployees: number;
    attendanceRate: number;
    totalHours: number;
    growth: number;
    averageHoursPerEmployee: number;
    totalEarnings: number;
  };
  attendance: {
    dailyBreakdown: Array<{ date: string; present: number; absent: number; late: number; total: number }>;
    employeeBreakdown: Array<{ employeeId: string; name: string; daysPresent: number; daysAbsent: number; attendanceRate: number; totalHours: number }>;
    trends: Array<{ period: string; attendanceRate: number; totalHours: number }>;
    patterns: {
      mostActiveDay: string;
      leastActiveDay: string;
      averageCheckInTime: string;
      averageCheckOutTime: string;
    };
  };
  timesheets: {
    statusBreakdown: { draft: number; submitted: number; approved: number; rejected: number };
    employeeBreakdown: Array<{ employeeId: string; name: string; totalHours: number; regularHours: number; overtimeHours: number; totalEarnings: number; statusCounts: Record<string, number> }>;
    trends: Array<{ period: string; totalHours: number; approvedHours: number; averageHours: number }>;
    earnings: {
      totalEarnings: number;
      regularEarnings: number;
      overtimeEarnings: number;
      averageEarningsPerEmployee: number;
    };
  };
  comparisons: {
    previousPeriod: {
      attendanceRate: number;
      totalHours: number;
      growth: number;
    };
  };
}

export default function ReportsPage() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<ReportsData | null>(null);
  const [period, setPeriod] = useState<PeriodType>('currentMonth');
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');

  useEffect(() => {
    fetchReports();
  }, [period, customStartDate, customEndDate]);

  const fetchReports = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      let url = '/api/reports?';
      
      if (period === 'custom' && customStartDate && customEndDate) {
        url += `startDate=${customStartDate}&endDate=${customEndDate}`;
      } else {
        url += `period=${period}`;
      }

      const response = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.ok) {
        const reportsData = await response.json();
        setData(reportsData);
      } else {
        const errorData = await response.json();
        toast({
          title: 'Error',
          description: errorData.error || 'Failed to fetch reports',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Failed to fetch reports:', error);
      toast({
        title: 'Error',
        description: 'Failed to fetch reports',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handlePeriodChange = (value: PeriodType) => {
    setPeriod(value);
    if (value !== 'custom') {
      setCustomStartDate('');
      setCustomEndDate('');
    } else {
      // Set default custom range to current month
      const now = new Date();
      setCustomStartDate(format(startOfMonth(now), 'yyyy-MM-dd'));
      setCustomEndDate(format(endOfMonth(now), 'yyyy-MM-dd'));
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  };

  if (loading) {
    return (
      <MainLayout>
        <div className="space-y-6">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Reports</h1>
            <p className="text-muted-foreground mt-1">View analytics and insights</p>
          </div>
          <div className="flex items-center justify-center h-96">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
              <p className="mt-4 text-muted-foreground">Loading reports...</p>
            </div>
          </div>
        </div>
      </MainLayout>
    );
  }

  if (!data) {
    return (
      <MainLayout>
        <div className="space-y-6">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Reports</h1>
            <p className="text-muted-foreground mt-1">View analytics and insights</p>
          </div>
          <Card>
            <CardContent className="py-12">
              <div className="text-center text-muted-foreground">
                <p>No data available. Please try selecting a different time period.</p>
                <Button onClick={fetchReports} className="mt-4" variant="outline">
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Retry
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Reports</h1>
            <p className="text-muted-foreground mt-1">View analytics and insights</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={fetchReports} disabled={loading}>
              <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>
        </div>

        {/* Time Period Selector */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Time Period
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Period</Label>
                <Select value={period} onValueChange={handlePeriodChange}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="currentMonth">This Month</SelectItem>
                    <SelectItem value="lastMonth">Last Month</SelectItem>
                    <SelectItem value="last3Months">Last 3 Months</SelectItem>
                    <SelectItem value="last6Months">Last 6 Months</SelectItem>
                    <SelectItem value="thisYear">This Year</SelectItem>
                    <SelectItem value="custom">Custom Range</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {period === 'custom' && (
                <>
                  <div className="space-y-2">
                    <Label>Start Date</Label>
                    <Input
                      type="date"
                      value={customStartDate}
                      onChange={(e) => setCustomStartDate(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>End Date</Label>
                    <Input
                      type="date"
                      value={customEndDate}
                      onChange={(e) => setCustomEndDate(e.target.value)}
                    />
                  </div>
                </>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Summary Cards */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Employees</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{data.summary.totalEmployees}</div>
              <p className="text-xs text-muted-foreground">Active employees</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Attendance Rate</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{data.summary.attendanceRate.toFixed(1)}%</div>
              <p className="text-xs text-muted-foreground">
                {data.comparisons.previousPeriod.attendanceRate > 0 && (
                  <span className={data.summary.attendanceRate >= data.comparisons.previousPeriod.attendanceRate ? 'text-green-600' : 'text-red-600'}>
                    {data.summary.attendanceRate >= data.comparisons.previousPeriod.attendanceRate ? '↑' : '↓'} {' '}
                    {Math.abs(data.summary.attendanceRate - data.comparisons.previousPeriod.attendanceRate).toFixed(1)}% vs previous
                  </span>
                )}
                {data.comparisons.previousPeriod.attendanceRate === 0 && 'This period'}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Hours</CardTitle>
              <BarChart3 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{data.summary.totalHours.toFixed(1)}</div>
              <p className="text-xs text-muted-foreground">
                {data.comparisons.previousPeriod.totalHours > 0 && (
                  <span className={data.summary.totalHours >= data.comparisons.previousPeriod.totalHours ? 'text-green-600' : 'text-red-600'}>
                    {data.summary.totalHours >= data.comparisons.previousPeriod.totalHours ? '↑' : '↓'} {' '}
                    {Math.abs(data.summary.totalHours - data.comparisons.previousPeriod.totalHours).toFixed(1)}h vs previous
                  </span>
                )}
                {data.comparisons.previousPeriod.totalHours === 0 && 'This period'}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Growth</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className={`text-2xl font-bold ${data.summary.growth >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {data.summary.growth >= 0 ? '+' : ''}{data.summary.growth.toFixed(1)}%
              </div>
              <p className="text-xs text-muted-foreground">vs previous period</p>
            </CardContent>
          </Card>
        </div>

        {/* Attendance Section */}
        <div className="grid gap-4 md:grid-cols-3">
          <div className="md:col-span-2">
            <AttendanceChart 
              dailyBreakdown={data.attendance.dailyBreakdown}
              trends={data.attendance.trends}
            />
          </div>
          <AttendanceSummaryCard
            patterns={data.attendance.patterns}
            attendanceRate={data.summary.attendanceRate}
            previousAttendanceRate={data.comparisons.previousPeriod.attendanceRate}
          />
        </div>

        {/* Employee Attendance Table */}
        <EmployeePerformanceTable
          employeeBreakdown={data.attendance.employeeBreakdown}
          type="attendance"
        />

        {/* Timesheet Section */}
        <TimesheetChart
          statusBreakdown={data.timesheets.statusBreakdown}
          trends={data.timesheets.trends}
        />

        <div className="grid gap-4 md:grid-cols-3">
          <div className="md:col-span-2">
            <EmployeePerformanceTable
              employeeBreakdown={data.attendance.employeeBreakdown}
              type="timesheet"
              timesheetData={data.timesheets.employeeBreakdown}
            />
          </div>
          <TimesheetSummaryCard
            earnings={data.timesheets.earnings}
            statusBreakdown={data.timesheets.statusBreakdown}
          />
        </div>
      </div>
    </MainLayout>
  );
}
