'use client';

import { useState, useEffect } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { format, startOfMonth, endOfMonth, subMonths, startOfDay, endOfDay, subDays } from 'date-fns';
import { Download, RefreshCw, FileText, Calendar, User, Filter } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

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
    company?: { name: string } | null;
    designation?: { name: string } | null;
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
  approver?: {
    id: string;
    name: string;
    email: string;
  } | null;
  approvedAt?: string | null;
}

interface Employee {
  id: string;
  name: string;
  email: string;
}

type PeriodType = 'month' | 'custom';
type PresetPeriod = 'last7days' | 'last30days' | 'thismonth' | 'lastmonth' | 'custom';

export default function TimesheetsPage() {
  const { toast } = useToast();
  const [timesheets, setTimesheets] = useState<EnrichedTimesheet[]>([]);
  const [totals, setTotals] = useState({
    totalHours: 0,
    totalRegularHours: 0,
    totalOvertimeHours: 0,
    totalEarnings: 0,
  });
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [canViewOthers, setCanViewOthers] = useState(false);

  // Period selection state
  const [periodType, setPeriodType] = useState<PeriodType>('month');
  const [selectedMonth, setSelectedMonth] = useState(format(new Date(), 'yyyy-MM'));
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear().toString());
  const [presetPeriod, setPresetPeriod] = useState<PresetPeriod>('thismonth');
  const [customStartDate, setCustomStartDate] = useState(() => {
    const now = new Date();
    return format(startOfMonth(now), 'yyyy-MM-dd');
  });
  const [customEndDate, setCustomEndDate] = useState(() => {
    const now = new Date();
    return format(endOfMonth(now), 'yyyy-MM-dd');
  });
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>('');

  useEffect(() => {
    fetchCurrentUser();
    fetchEmployees();
  }, []);

  useEffect(() => {
    fetchTimesheets();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [periodType, selectedMonth, selectedYear, presetPeriod, customStartDate, customEndDate, selectedEmployeeId]);

  const fetchCurrentUser = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/auth/me', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.ok) {
        const data = await response.json();
        setCurrentUser(data.user);
        // Check if user can view others' timesheets
        const role = data.user.role;
        setCanViewOthers(['SUPER_ADMIN', 'COMPANY_ADMIN', 'MANAGER', 'TEAM_LEAD'].includes(role));
      }
    } catch (error) {
      console.error('Failed to fetch current user:', error);
    }
  };

  const fetchEmployees = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/employees', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.ok) {
        const data = await response.json();
        setEmployees(data.employees || []);
      }
    } catch (error) {
      console.error('Failed to fetch employees:', error);
    }
  };

  const getDateRange = (): { startDate: string; endDate: string } => {
    if (periodType === 'month') {
      const [year, month] = selectedMonth.split('-').map(Number);
      return {
        startDate: format(startOfMonth(new Date(year, month - 1)), 'yyyy-MM-dd'),
        endDate: format(endOfMonth(new Date(year, month - 1)), 'yyyy-MM-dd'),
      };
    } else {
      // Custom period
      if (presetPeriod === 'last7days') {
        const end = endOfDay(new Date());
        const start = startOfDay(subDays(end, 6));
        return {
          startDate: format(start, 'yyyy-MM-dd'),
          endDate: format(end, 'yyyy-MM-dd'),
        };
      } else if (presetPeriod === 'last30days') {
        const end = endOfDay(new Date());
        const start = startOfDay(subDays(end, 29));
        return {
          startDate: format(start, 'yyyy-MM-dd'),
          endDate: format(end, 'yyyy-MM-dd'),
        };
      } else if (presetPeriod === 'thismonth') {
        const now = new Date();
        return {
          startDate: format(startOfMonth(now), 'yyyy-MM-dd'),
          endDate: format(endOfMonth(now), 'yyyy-MM-dd'),
        };
      } else if (presetPeriod === 'lastmonth') {
        const lastMonth = subMonths(new Date(), 1);
        return {
          startDate: format(startOfMonth(lastMonth), 'yyyy-MM-dd'),
          endDate: format(endOfMonth(lastMonth), 'yyyy-MM-dd'),
        };
      } else {
        // Custom range
        return {
          startDate: customStartDate || format(startOfMonth(new Date()), 'yyyy-MM-dd'),
          endDate: customEndDate || format(endOfMonth(new Date()), 'yyyy-MM-dd'),
        };
      }
    }
  };

  const fetchTimesheets = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const dateRange = getDateRange();
      
      let url = '/api/timesheets?enriched=true';
      
      if (periodType === 'month') {
        const [year, month] = selectedMonth.split('-').map(Number);
        url += `&month=${month}&year=${year}`;
      } else {
        url += `&startDate=${dateRange.startDate}&endDate=${dateRange.endDate}`;
      }

      if (selectedEmployeeId && canViewOthers) {
        url += `&userId=${selectedEmployeeId}`;
      }

      const response = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.ok) {
        const data = await response.json();
        setTimesheets(data.timesheets || []);
        setTotals(data.totals || {
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
      setLoading(false);
    }
  };

  const handleGenerateTimesheets = async () => {
    setGenerating(true);
    try {
      const token = localStorage.getItem('token');
      const dateRange = getDateRange();
      
      const body: any = {};
      if (periodType === 'month') {
        const [year, month] = selectedMonth.split('-').map(Number);
        body.month = month;
        body.year = year;
      } else {
        body.startDate = dateRange.startDate;
        body.endDate = dateRange.endDate;
      }

      if (selectedEmployeeId && canViewOthers) {
        body.userId = selectedEmployeeId;
      }

      const response = await fetch('/api/timesheets/generate', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });

      if (response.ok) {
        const data = await response.json();
        toast({
          title: 'Success',
          description: data.message || 'Timesheets generated successfully',
        });
        fetchTimesheets();
      } else {
        const errorData = await response.json();
        toast({
          title: 'Error',
          description: errorData.error || 'Failed to generate timesheets',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Failed to generate timesheets:', error);
      toast({
        title: 'Error',
        description: 'Failed to generate timesheets',
        variant: 'destructive',
      });
    } finally {
      setGenerating(false);
    }
  };

  const handleExportPDF = async (type: 'summary' | 'detailed') => {
    try {
      const token = localStorage.getItem('token');
      const dateRange = getDateRange();
      
      const userId = selectedEmployeeId && canViewOthers ? selectedEmployeeId : undefined;
      let url = `/api/timesheets/export/period?type=${type}&startDate=${dateRange.startDate}&endDate=${dateRange.endDate}`;
      if (userId) {
        url += `&userId=${userId}`;
      }

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

  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Timesheets</h1>
            <p className="text-muted-foreground mt-1">View and manage timesheets</p>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={handleGenerateTimesheets}
              disabled={generating}
            >
              <RefreshCw className={`mr-2 h-4 w-4 ${generating ? 'animate-spin' : ''}`} />
              Generate Timesheets
            </Button>
            <Button
              variant="outline"
              onClick={() => handleExportPDF('summary')}
              disabled={timesheets.length === 0}
            >
              <FileText className="mr-2 h-4 w-4" />
              Export Summary PDF
            </Button>
            <Button
              variant="outline"
              onClick={() => handleExportPDF('detailed')}
              disabled={timesheets.length === 0}
            >
              <Download className="mr-2 h-4 w-4" />
              Export Detailed PDF
            </Button>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Filter className="h-5 w-5" />
              Filters
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="space-y-2">
                <Label>Period Type</Label>
                <Select
                  value={periodType}
                  onValueChange={(value) => setPeriodType(value as PeriodType)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="month">By Month</SelectItem>
                    <SelectItem value="custom">Custom Range</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {periodType === 'month' ? (
                <div className="space-y-2">
                  <Label>Month</Label>
                  <Input
                    type="month"
                    value={selectedMonth}
                    onChange={(e) => setSelectedMonth(e.target.value)}
                  />
                </div>
              ) : (
                <>
                  <div className="space-y-2">
                    <Label>Preset Period</Label>
                    <Select
                      value={presetPeriod}
                      onValueChange={(value) => {
                        const newPreset = value as PresetPeriod;
                        setPresetPeriod(newPreset);
                        if (newPreset !== 'custom') {
                          // Calculate dates based on preset
                          let start: Date, end: Date;
                          if (newPreset === 'last7days') {
                            end = endOfDay(new Date());
                            start = startOfDay(subDays(end, 6));
                          } else if (newPreset === 'last30days') {
                            end = endOfDay(new Date());
                            start = startOfDay(subDays(end, 29));
                          } else if (newPreset === 'thismonth') {
                            const now = new Date();
                            start = startOfMonth(now);
                            end = endOfMonth(now);
                          } else {
                            const lastMonth = subMonths(new Date(), 1);
                            start = startOfMonth(lastMonth);
                            end = endOfMonth(lastMonth);
                          }
                          setCustomStartDate(format(start, 'yyyy-MM-dd'));
                          setCustomEndDate(format(end, 'yyyy-MM-dd'));
                        }
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="last7days">Last 7 Days</SelectItem>
                        <SelectItem value="last30days">Last 30 Days</SelectItem>
                        <SelectItem value="thismonth">This Month</SelectItem>
                        <SelectItem value="lastmonth">Last Month</SelectItem>
                        <SelectItem value="custom">Custom Range</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  {presetPeriod === 'custom' && (
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
                </>
              )}

              {canViewOthers && (
                <div className="space-y-2">
                  <Label>Employee</Label>
                  <Select
                    value={selectedEmployeeId}
                    onValueChange={setSelectedEmployeeId}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="All Employees" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">All Employees</SelectItem>
                      {employees.map((emp) => (
                        <SelectItem key={emp.id} value={emp.id}>
                          {emp.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {totals.totalHours > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Summary</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Total Hours</p>
                  <p className="text-2xl font-bold">{totals.totalHours.toFixed(2)}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Regular Hours</p>
                  <p className="text-2xl font-bold">{totals.totalRegularHours.toFixed(2)}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Overtime Hours</p>
                  <p className="text-2xl font-bold">{totals.totalOvertimeHours.toFixed(2)}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Total Earnings</p>
                  <p className="text-2xl font-bold">{formatCurrency(totals.totalEarnings)}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle>Timesheet List</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-center py-8">Loading...</div>
            ) : timesheets.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                No timesheets found for the selected period.
                {periodType === 'month' && (
                  <div className="mt-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleGenerateTimesheets}
                      disabled={generating}
                    >
                      Generate Timesheets
                    </Button>
                  </div>
                )}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      {canViewOthers && <TableHead>Employee</TableHead>}
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
                        {canViewOthers && (
                          <TableCell>{timesheet.user.name}</TableCell>
                        )}
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
      </div>
    </MainLayout>
  );
}
