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
import { BarChart3, TrendingUp, Users, Clock, RefreshCw, Download, Calendar, FileText } from 'lucide-react';
import { AttendanceChart } from '@/components/reports/AttendanceChart';
import { TimesheetChart } from '@/components/reports/TimesheetChart';
import { EmployeePerformanceTable } from '@/components/reports/EmployeePerformanceTable';
import { AttendanceSummaryCard } from '@/components/reports/AttendanceSummaryCard';
import { TimesheetSummaryCard } from '@/components/reports/TimesheetSummaryCard';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { format, startOfMonth, endOfMonth, subMonths, startOfYear, endOfYear, startOfDay, endOfDay } from 'date-fns';
import { useToast } from '@/hooks/use-toast';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

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
    dailyBreakdown: Array<{ date: string; totalHours: number; averageHours: number }>;
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

interface EnrichedTimesheet {
  id: string;
  date: string;
  hours: number;
  regularHours: number;
  overtimeHours: number;
  hourlyRate: number | null;
  earnings: number;
  status: string;
  notes: string | null;
  user: {
    id: string;
    name: string;
    email: string;
  };
  attendance: {
    checkInTime: string | null;
    checkOutTime: string | null;
    status: string;
    notes: string | null;
  } | null;
  taskLogs: Array<{
    id: string;
    description: string;
    hours: number;
  }>;
}

export default function ReportsPage() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<ReportsData | null>(null);
  const [period, setPeriod] = useState<PeriodType>('currentMonth');
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');
  const [activeTab, setActiveTab] = useState('reports');
  
  // Timesheet tab state
  const [timesheetLoading, setTimesheetLoading] = useState(false);
  const [timesheets, setTimesheets] = useState<EnrichedTimesheet[]>([]);
  const [timesheetTotals, setTimesheetTotals] = useState({
    totalHours: 0,
    totalRegularHours: 0,
    totalOvertimeHours: 0,
    totalEarnings: 0,
  });
  const [timesheetPeriod, setTimesheetPeriod] = useState<PeriodType>('currentMonth');
  const [timesheetCustomStartDate, setTimesheetCustomStartDate] = useState('');
  const [timesheetCustomEndDate, setTimesheetCustomEndDate] = useState('');

  useEffect(() => {
    fetchReports();
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  const getTimesheetDateRange = () => {
    if (timesheetPeriod === 'month' && timesheetCustomStartDate) {
      const [year, month] = timesheetCustomStartDate.split('-').map(Number);
      return {
        startDate: format(startOfMonth(new Date(year, month - 1)), 'yyyy-MM-dd'),
        endDate: format(endOfMonth(new Date(year, month - 1)), 'yyyy-MM-dd'),
      };
    } else if (timesheetPeriod === 'custom' && timesheetCustomStartDate && timesheetCustomEndDate) {
      return {
        startDate: timesheetCustomStartDate,
        endDate: timesheetCustomEndDate,
      };
    } else {
      const now = new Date();
      return {
        startDate: format(startOfMonth(now), 'yyyy-MM-dd'),
        endDate: format(endOfMonth(now), 'yyyy-MM-dd'),
      };
    }
  };

  const fetchTimesheets = async () => {
    setTimesheetLoading(true);
    try {
      const token = localStorage.getItem('token');
      const dateRange = getTimesheetDateRange();
      
      let url = '/api/timesheets?enriched=true';
      
      if (timesheetPeriod === 'month' && timesheetCustomStartDate) {
        const [year, month] = timesheetCustomStartDate.split('-').map(Number);
        url += `&month=${month}&year=${year}`;
      } else {
        url += `&startDate=${dateRange.startDate}&endDate=${dateRange.endDate}`;
      }

      const response = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.ok) {
        const timesheetData = await response.json();
        setTimesheets(timesheetData.timesheets || []);
        setTimesheetTotals(timesheetData.totals || {
          totalHours: 0,
          totalRegularHours: 0,
          totalOvertimeHours: 0,
          totalEarnings: 0,
        });
      } else {
        const errorData = await response.json();
        toast({
          title: 'Error',
          description: errorData.error || 'Failed to fetch timesheets',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Failed to fetch timesheets:', error);
      toast({
        title: 'Error',
        description: 'Failed to fetch timesheets',
        variant: 'destructive',
      });
    } finally {
      setTimesheetLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'timesheets') {
      fetchTimesheets();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, timesheetPeriod, timesheetCustomStartDate, timesheetCustomEndDate]);

  const handleTimesheetPeriodChange = (value: PeriodType) => {
    setTimesheetPeriod(value);
    if (value !== 'custom' && value !== 'month') {
      setTimesheetCustomStartDate('');
      setTimesheetCustomEndDate('');
    } else if (value === 'month') {
      const now = new Date();
      setTimesheetCustomStartDate(format(startOfMonth(now), 'yyyy-MM'));
      setTimesheetCustomEndDate('');
    } else {
      const now = new Date();
      setTimesheetCustomStartDate(format(startOfMonth(now), 'yyyy-MM-dd'));
      setTimesheetCustomEndDate(format(endOfMonth(now), 'yyyy-MM-dd'));
    }
  };

  const handleExportTimesheetPDF = async (type: 'summary' | 'detailed') => {
    try {
      const token = localStorage.getItem('token');
      const dateRange = getTimesheetDateRange();
      
      const url = `/api/timesheets/export/period?type=${type}&startDate=${dateRange.startDate}&endDate=${dateRange.endDate}`;

      const response = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `timesheet-${type}-${dateRange.startDate}-${dateRange.endDate}.pdf`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
        toast({
          title: 'Success',
          description: 'PDF exported successfully',
        });
      } else {
        const errorData = await response.json();
        toast({
          title: 'Error',
          description: errorData.error || 'Failed to export PDF',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Failed to export PDF:', error);
      toast({
        title: 'Error',
        description: 'Failed to export PDF',
        variant: 'destructive',
      });
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  };

  const formatTime = (dateString: string | null) => {
    if (!dateString) return '-';
    return format(new Date(dateString), 'HH:mm');
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'APPROVED':
        return 'bg-green-100 text-green-800';
      case 'REJECTED':
        return 'bg-red-100 text-red-800';
      case 'SUBMITTED':
        return 'bg-yellow-100 text-yellow-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
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
            {activeTab === 'reports' && (
              <Button variant="outline" onClick={fetchReports} disabled={loading}>
                <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
            )}
            {activeTab === 'timesheets' && (
              <Button variant="outline" onClick={fetchTimesheets} disabled={timesheetLoading}>
                <RefreshCw className={`h-4 w-4 mr-2 ${timesheetLoading ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
            )}
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList>
            <TabsTrigger value="reports">
              <BarChart3 className="h-4 w-4 mr-2" />
              Reports
            </TabsTrigger>
            <TabsTrigger value="timesheets">
              <FileText className="h-4 w-4 mr-2" />
              Timesheets
            </TabsTrigger>
          </TabsList>

          <TabsContent value="reports" className="space-y-6 mt-6">

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
          </TabsContent>

          <TabsContent value="timesheets" className="space-y-6 mt-6">
            {/* Timesheet Period Selector */}
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
                    <Select value={timesheetPeriod} onValueChange={handleTimesheetPeriodChange}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="month">By Month</SelectItem>
                        <SelectItem value="custom">Custom Range</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {timesheetPeriod === 'month' ? (
                    <div className="space-y-2">
                      <Label>Month</Label>
                      <Input
                        type="month"
                        value={timesheetCustomStartDate}
                        onChange={(e) => setTimesheetCustomStartDate(e.target.value)}
                      />
                    </div>
                  ) : (
                    <>
                      <div className="space-y-2">
                        <Label>Start Date</Label>
                        <Input
                          type="date"
                          value={timesheetCustomStartDate}
                          onChange={(e) => setTimesheetCustomStartDate(e.target.value)}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>End Date</Label>
                        <Input
                          type="date"
                          value={timesheetCustomEndDate}
                          onChange={(e) => setTimesheetCustomEndDate(e.target.value)}
                        />
                      </div>
                    </>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Timesheet Summary */}
            {timesheetTotals.totalHours > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>Summary</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div>
                      <p className="text-sm text-muted-foreground">Total Hours</p>
                      <p className="text-2xl font-bold">{timesheetTotals.totalHours.toFixed(2)}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Regular Hours</p>
                      <p className="text-2xl font-bold">{timesheetTotals.totalRegularHours.toFixed(2)}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Overtime Hours</p>
                      <p className="text-2xl font-bold">{timesheetTotals.totalOvertimeHours.toFixed(2)}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Total Earnings</p>
                      <p className="text-2xl font-bold">{formatCurrency(timesheetTotals.totalEarnings)}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Export Buttons */}
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => handleExportTimesheetPDF('summary')}
                disabled={timesheets.length === 0}
              >
                <FileText className="mr-2 h-4 w-4" />
                Export Summary PDF
              </Button>
              <Button
                variant="outline"
                onClick={() => handleExportTimesheetPDF('detailed')}
                disabled={timesheets.length === 0}
              >
                <Download className="mr-2 h-4 w-4" />
                Export Detailed PDF
              </Button>
            </div>

            {/* Timesheet List */}
            <Card>
              <CardHeader>
                <CardTitle>My Timesheets</CardTitle>
              </CardHeader>
              <CardContent>
                {timesheetLoading ? (
                  <div className="text-center py-8">Loading...</div>
                ) : timesheets.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    No timesheets found for the selected period.
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Date</TableHead>
                          <TableHead>Check-In</TableHead>
                          <TableHead>Check-Out</TableHead>
                          <TableHead>Hours</TableHead>
                          <TableHead>Regular</TableHead>
                          <TableHead>Overtime</TableHead>
                          <TableHead>Rate</TableHead>
                          <TableHead>Earnings</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {timesheets.map((timesheet) => (
                          <TableRow key={timesheet.id}>
                            <TableCell>
                              {format(new Date(timesheet.date), 'MMM dd, yyyy')}
                            </TableCell>
                            <TableCell>
                              {formatTime(timesheet.attendance?.checkInTime || null)}
                            </TableCell>
                            <TableCell>
                              {formatTime(timesheet.attendance?.checkOutTime || null)}
                            </TableCell>
                            <TableCell>{timesheet.hours.toFixed(2)}</TableCell>
                            <TableCell>{timesheet.regularHours.toFixed(2)}</TableCell>
                            <TableCell>{timesheet.overtimeHours.toFixed(2)}</TableCell>
                            <TableCell>
                              {timesheet.hourlyRate
                                ? formatCurrency(timesheet.hourlyRate)
                                : '-'}
                            </TableCell>
                            <TableCell>{formatCurrency(timesheet.earnings)}</TableCell>
                            <TableCell>
                              <span
                                className={`px-2 py-1 text-xs rounded-full ${getStatusColor(
                                  timesheet.status
                                )}`}
                              >
                                {timesheet.status}
                              </span>
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex justify-end gap-2">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => {
                                    window.open(
                                      `/api/timesheets/export/${timesheet.id}?type=summary`,
                                      '_blank'
                                    );
                                  }}
                                >
                                  <FileText className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => {
                                    window.open(
                                      `/api/timesheets/export/${timesheet.id}?type=detailed`,
                                      '_blank'
                                    );
                                  }}
                                >
                                  <Download className="h-4 w-4" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </MainLayout>
  );
}
