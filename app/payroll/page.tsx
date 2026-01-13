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
import { Plus, Check, X, DollarSign, Trash2, Eye, ChevronDown, ChevronRight, Clock, Users, Calendar, Table as TableIcon, Save } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { UserRole, PayrollStatus } from '@prisma/client';

type PaymentType = 'HOURLY' | 'SALARY';
import { PayrollCalendar } from '@/components/payroll/PayrollCalendar';
import { EmployeeSearchSelector } from '@/components/payroll/EmployeeSearchSelector';
import { EarningsChart } from '@/components/payroll/EarningsChart';
import { DailyPayrollEditDialog } from '@/components/payroll/DailyPayrollEditDialog';

interface Bonus {
  name: string;
  amount: number;
}

interface Deduction {
  name: string;
  amount: number;
}

interface Payroll {
  id: string;
  month: number;
  year: number;
  paymentType: 'HOURLY' | 'SALARY' | null;
  hoursWorked: number | null;
  hourlyRate: number | null;
  baseSalary: number;
  bonuses: Bonus[] | null;
  deductions: Deduction[] | null;
  totalBonuses: number;
  totalDeductions: number;
  netSalary: number;
  status: PayrollStatus;
  notes: string | null;
  user: {
    id: string;
    name: string;
    email: string;
  };
}

interface Employee {
  id: string;
  name: string;
  email: string;
  paymentType: 'HOURLY' | 'SALARY' | null;
  hourlyRate: number | null;
  monthlySalary: number | null;
}

const months = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

export default function PayrollPage() {
  const [payroll, setPayroll] = useState<Payroll[]>([]);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<any>(null);
  const [open, setOpen] = useState(false);
  const [selectedPayroll, setSelectedPayroll] = useState<Payroll | null>(null);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'table' | 'calendar'>('table');
  const [stats, setStats] = useState<any>(null);
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [dailyEarnings, setDailyEarnings] = useState<Record<string, { hours: number; earnings: number; hourlyRate: number | null; overtimeHours: number; regularHours: number; isOverride: boolean; originalData?: { hours: number; earnings: number; hourlyRate: number | null; overtimeHours: number; regularHours: number } | null }>>({});
  const [calendarMonth, setCalendarMonth] = useState(new Date().getMonth() + 1);
  const [calendarYear, setCalendarYear] = useState(new Date().getFullYear());
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editDialogDate, setEditDialogDate] = useState<Date | null>(null);
  const [editDialogData, setEditDialogData] = useState<any>(null);
  const [employeeStats, setEmployeeStats] = useState<any>(null);
  const [editPanelHours, setEditPanelHours] = useState<string>('');
  const [editPanelRate, setEditPanelRate] = useState<string>('');
  const [editPanelRegularHours, setEditPanelRegularHours] = useState<string>('');
  const [editPanelOvertimeHours, setEditPanelOvertimeHours] = useState<string>('');
  const [editPanelEarnings, setEditPanelEarnings] = useState<string>('');
  const [formData, setFormData] = useState({
    userId: '',
    month: new Date().getMonth() + 1,
    year: new Date().getFullYear(),
    paymentType: '' as '' | 'HOURLY' | 'SALARY',
    hoursWorked: '',
    hourlyRate: '',
    baseSalary: '',
    bonuses: [] as Bonus[],
    deductions: [] as Deduction[],
    notes: '',
  });

  useEffect(() => {
    fetchUser();
    fetchPayroll();
  }, []);

  useEffect(() => {
    if (user) {
      if (user.role === UserRole.EMPLOYEE) {
        fetchStats();
        fetchDailyEarnings(calendarMonth, calendarYear);
      } else {
        fetchEmployees();
      }
    }
  }, [user, calendarMonth, calendarYear]);

  useEffect(() => {
    // Fetch daily earnings when employee is selected in admin/manager view
    if (user && user.role !== UserRole.EMPLOYEE && selectedEmployeeId && viewMode === 'calendar') {
      fetchDailyEarnings(calendarMonth, calendarYear, selectedEmployeeId);
      fetchEmployeeStats(selectedEmployeeId);
    }
  }, [user, selectedEmployeeId, calendarMonth, calendarYear, viewMode]);

  // Calculate earnings dynamically when rate or hours change in edit panel
  useEffect(() => {
    const rate = parseFloat(editPanelRate) || 0;
    const regHours = parseFloat(editPanelRegularHours) || 0;
    const otHours = parseFloat(editPanelOvertimeHours) || 0;
    
    if (rate > 0 && (regHours > 0 || otHours > 0)) {
      const calculatedEarnings = (regHours * rate) + (otHours * rate * 1.5);
      // Only update if user hasn't manually edited earnings significantly
      const currentEarnings = parseFloat(editPanelEarnings) || 0;
      if (Math.abs(currentEarnings - calculatedEarnings) < 0.01 || currentEarnings === 0) {
        setEditPanelEarnings(calculatedEarnings.toFixed(2));
      }
    }
  }, [editPanelRate, editPanelRegularHours, editPanelOvertimeHours]);

  const fetchEmployeeStats = async (userId: string) => {
    try {
      const token = localStorage.getItem('token');
      if (!token) return;
      
      const response = await fetch(`/api/payroll/stats?userId=${userId}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setEmployeeStats(data);
      }
    } catch (error) {
      console.error('Failed to fetch employee stats:', error);
    }
  };

  const fetchUser = async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        console.error('No token found');
        setLoading(false);
        return;
      }
      const response = await fetch('/api/auth/me', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setUser(data.user);
      } else {
        console.error('Failed to fetch user:', response.status, response.statusText);
        setLoading(false);
      }
    } catch (error) {
      console.error('Failed to fetch user:', error);
      setLoading(false);
    }
  };

  const fetchPayroll = async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        console.error('No token found');
        setLoading(false);
        return;
      }
      const response = await fetch('/api/payroll', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setPayroll(data.payroll || []);
      } else {
        console.error('Failed to fetch payroll:', response.status, response.statusText);
      }
    } catch (error) {
      console.error('Failed to fetch payroll:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchEmployees = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/employees', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setEmployees(data.employees || []);
      }
    } catch (error) {
      console.error('Failed to fetch employees:', error);
    }
  };

  const fetchStats = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/payroll/stats', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setStats(data);
      }
    } catch (error) {
      console.error('Failed to fetch stats:', error);
    }
  };

  const fetchDailyEarnings = async (month: number, year: number, userId?: string) => {
    try {
      const token = localStorage.getItem('token');
      if (!token) return;
      
      const url = userId 
        ? `/api/payroll/daily-earnings?userId=${userId}&month=${month}&year=${year}`
        : `/api/payroll/daily-earnings?month=${month}&year=${year}`;
      
      const response = await fetch(url, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        console.log('Daily earnings fetched for', month, year, ':', data.dailyEarnings);
        
        // Debug: Log a few sample values to see what we're getting
        if (data.dailyEarnings) {
          const sampleDays = Object.entries(data.dailyEarnings).slice(0, 3);
          sampleDays.forEach(([day, earnings]: [string, any]) => {
            console.log(`Day ${day}: hours=${earnings?.hours}, earnings=${earnings?.earnings}`);
          });
        }
        
        // Ensure we set an empty object if no data, so calendar knows data was fetched
        setDailyEarnings(data.dailyEarnings || {});
      } else {
        const errorData = await response.json().catch(() => ({}));
        console.error('Failed to fetch daily earnings:', response.status, response.statusText, errorData);
        // Set empty object to indicate fetch was attempted
        setDailyEarnings({});
      }
    } catch (error) {
      console.error('Failed to fetch daily earnings:', error);
    }
  };

  const handleEmployeeSelect = (employeeId: string) => {
    setSelectedEmployeeId(employeeId);
    const employee = employees.find((e) => e.id === employeeId);
    setSelectedEmployee(employee || null);
    setViewMode('calendar');
    // Reset calendar to current month
    setCalendarMonth(new Date().getMonth() + 1);
    setCalendarYear(new Date().getFullYear());
  };

  const handleDayEdit = async (date: Date, data: any) => {
    setEditDialogDate(date);
    setEditDialogData(data);
    setEditDialogOpen(true);
  };

  const handleSaveDailyOverride = async (overrideData: {
    hourlyRate?: number;
    regularHours?: number;
    overtimeHours?: number;
    totalHours?: number;
    earnings?: number;
    notes?: string;
  }) => {
    if (!selectedEmployeeId || !editDialogDate) return;

    try {
      const token = localStorage.getItem('token');
      if (!token) return;

      // Format date as YYYY-MM-DD in UTC
      const year = editDialogDate.getUTCFullYear();
      const month = String(editDialogDate.getUTCMonth() + 1).padStart(2, '0');
      const day = String(editDialogDate.getUTCDate()).padStart(2, '0');
      const dateStr = `${year}-${month}-${day}`;

      const response = await fetch('/api/payroll/daily-override', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId: selectedEmployeeId,
          date: dateStr,
          ...overrideData,
        }),
      });

      if (response.ok) {
        // Refresh daily earnings
        await fetchDailyEarnings(calendarMonth, calendarYear, selectedEmployeeId);
        // Refresh payroll list
        await fetchPayroll();
      } else {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to save override');
      }
    } catch (error: any) {
      console.error('Error saving daily override:', error);
      throw error;
    }
  };

  const handleDeleteDailyOverride = async () => {
    if (!selectedEmployeeId || !editDialogDate) return;

    if (!confirm('Are you sure you want to remove this override? It will revert to the original attendance data.')) {
      return;
    }

    try {
      const token = localStorage.getItem('token');
      if (!token) return;

      // Format date as YYYY-MM-DD in UTC
      const year = editDialogDate.getUTCFullYear();
      const month = String(editDialogDate.getUTCMonth() + 1).padStart(2, '0');
      const day = String(editDialogDate.getUTCDate()).padStart(2, '0');
      const dateStr = `${year}-${month}-${day}`;
      
      const response = await fetch(`/api/payroll/daily-override?userId=${selectedEmployeeId}&date=${dateStr}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.ok) {
        // Clear edit panel
        setEditDialogDate(null);
        setEditDialogData(null);
        // Refresh daily earnings
        await fetchDailyEarnings(calendarMonth, calendarYear, selectedEmployeeId);
        // Refresh payroll list
        await fetchPayroll();
        // Refresh employee stats
        await fetchEmployeeStats(selectedEmployeeId);
      } else {
        const errorData = await response.json();
        alert(errorData.error || 'Failed to delete override');
        throw new Error(errorData.error || 'Failed to delete override');
      }
    } catch (error: any) {
      console.error('Error deleting daily override:', error);
      alert(error.message || 'Failed to delete override');
    }
  };

  const handleEmployeeSelectForPayroll = async (employeeId: string) => {
    const employee = employees.find((e) => e.id === employeeId);
    if (employee) {
      setSelectedEmployee(employee);
      setFormData((prev) => ({
        ...prev,
        userId: employeeId,
        paymentType: (employee.paymentType || 'SALARY') as 'HOURLY' | 'SALARY',
        hourlyRate: employee.hourlyRate?.toString() || '',
        baseSalary: employee.monthlySalary?.toString() || '',
      }));

      // If hourly, calculate hours worked
      if (employee.paymentType === 'HOURLY') {
        try {
          const token = localStorage.getItem('token');
          const response = await fetch(
            `/api/payroll?userId=${employeeId}&month=${formData.month}&year=${formData.year}`,
            {
              headers: {
                Authorization: `Bearer ${token}`,
              },
            }
          );
          // Calculate hours from attendance (this would ideally be done via an API endpoint)
          // For now, we'll let the backend calculate it
        } catch (error) {
          console.error('Failed to fetch hours:', error);
        }
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const token = localStorage.getItem('token');
      
      // Ensure baseSalary is a valid number
      const baseSalary = formData.baseSalary ? parseFloat(formData.baseSalary) : 0;
      
      const requestBody: any = {
        userId: formData.userId,
        month: formData.month,
        year: formData.year,
        paymentType: formData.paymentType,
        baseSalary: !isNaN(baseSalary) && baseSalary >= 0 ? baseSalary : 0,
      };

      if (formData.paymentType === 'HOURLY') {
        // Only include hoursWorked if provided (otherwise backend will calculate)
        if (formData.hoursWorked && formData.hoursWorked.trim()) {
          const hours = parseFloat(formData.hoursWorked);
          if (!isNaN(hours) && hours > 0) {
            requestBody.hoursWorked = hours;
          }
        }
        // hourlyRate is required for HOURLY
        if (formData.hourlyRate && formData.hourlyRate.trim()) {
          const rate = parseFloat(formData.hourlyRate);
          if (!isNaN(rate) && rate > 0) {
            requestBody.hourlyRate = rate;
          }
        }
      }
      
      // Filter out bonuses with empty names or zero amounts
      const validBonuses = formData.bonuses.filter(b => b.name.trim() && b.amount > 0);
      if (validBonuses.length > 0) {
        requestBody.bonuses = validBonuses;
      }
      
      // Filter out deductions with empty names or zero amounts
      const validDeductions = formData.deductions.filter(d => d.name.trim() && d.amount > 0);
      if (validDeductions.length > 0) {
        requestBody.deductions = validDeductions;
      }
      
      if (formData.notes) {
        requestBody.notes = formData.notes;
      }

      const response = await fetch('/api/payroll', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      if (response.ok) {
        setOpen(false);
        resetForm();
        fetchPayroll();
        alert('Payroll created successfully');
      } else {
        const data = await response.json();
        let errorMessage = data.error || 'Failed to create payroll';
        if (data.details && Array.isArray(data.details)) {
          const details = data.details.map((d: any) => `${d.path.join('.')}: ${d.message}`).join('\n');
          errorMessage = `${errorMessage}\n\n${details}`;
        }
        alert(errorMessage);
      }
    } catch (error) {
      console.error('Failed to create payroll:', error);
      alert('Failed to create payroll');
    }
  };

  const resetForm = () => {
    setFormData({
      userId: '',
      month: new Date().getMonth() + 1,
      year: new Date().getFullYear(),
      paymentType: '' as '' | 'HOURLY' | 'SALARY',
      hoursWorked: '',
      hourlyRate: '',
      baseSalary: '',
      bonuses: [],
      deductions: [],
      notes: '',
    });
    setSelectedEmployee(null);
  };

  const addBonus = () => {
    setFormData((prev) => ({
      ...prev,
      bonuses: [...prev.bonuses, { name: '', amount: 0 }],
    }));
  };

  const removeBonus = (index: number) => {
    setFormData((prev) => ({
      ...prev,
      bonuses: prev.bonuses.filter((_, i) => i !== index),
    }));
  };

  const updateBonus = (index: number, field: 'name' | 'amount', value: string | number) => {
    setFormData((prev) => {
      const newBonuses = [...prev.bonuses];
      newBonuses[index] = { ...newBonuses[index], [field]: value };
      return { ...prev, bonuses: newBonuses };
    });
  };

  const addDeduction = () => {
    setFormData((prev) => ({
      ...prev,
      deductions: [...prev.deductions, { name: '', amount: 0 }],
    }));
  };

  const removeDeduction = (index: number) => {
    setFormData((prev) => ({
      ...prev,
      deductions: prev.deductions.filter((_, i) => i !== index),
    }));
  };

  const updateDeduction = (index: number, field: 'name' | 'amount', value: string | number) => {
    setFormData((prev) => {
      const newDeductions = [...prev.deductions];
      newDeductions[index] = { ...newDeductions[index], [field]: value };
      return { ...prev, deductions: newDeductions };
    });
  };

  const calculateTotalBonuses = () => {
    return formData.bonuses.reduce((sum, b) => sum + (b.amount || 0), 0);
  };

  const calculateTotalDeductions = () => {
    return formData.deductions.reduce((sum, d) => sum + (d.amount || 0), 0);
  };

  const calculateNetSalary = () => {
    let base = 0;
    if (formData.paymentType === 'HOURLY') {
      const hours = parseFloat(formData.hoursWorked) || 0;
      const rate = parseFloat(formData.hourlyRate) || 0;
      base = hours * rate;
    } else {
      base = parseFloat(formData.baseSalary) || 0;
    }
    return base + calculateTotalBonuses() - calculateTotalDeductions();
  };

  const calculateBaseSalary = () => {
    if (formData.paymentType === 'HOURLY') {
      const hours = parseFloat(formData.hoursWorked) || 0;
      const rate = parseFloat(formData.hourlyRate) || 0;
      return hours * rate;
    } else {
      return parseFloat(formData.baseSalary) || 0;
    }
  };

  const handleApprove = async (id: string) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/payroll/${id}`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ status: 'APPROVED' }),
      });

      if (response.ok) {
        fetchPayroll();
      } else {
        const data = await response.json();
        alert(data.error || 'Failed to approve payroll');
      }
    } catch (error) {
      console.error('Failed to approve payroll:', error);
      alert('Failed to approve payroll');
    }
  };

  const handleReject = async (id: string) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/payroll/${id}`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ status: 'REJECTED' }),
      });

      if (response.ok) {
        fetchPayroll();
      } else {
        const data = await response.json();
        alert(data.error || 'Failed to reject payroll');
      }
    } catch (error) {
      console.error('Failed to reject payroll:', error);
      alert('Failed to reject payroll');
    }
  };

  const getStatusColor = (status: PayrollStatus) => {
    switch (status) {
      case PayrollStatus.APPROVED:
        return 'bg-green-100 text-green-800';
      case PayrollStatus.REJECTED:
        return 'bg-red-100 text-red-800';
      case PayrollStatus.PAID:
        return 'bg-blue-100 text-blue-800';
      default:
        return 'bg-yellow-100 text-yellow-800';
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  };

  // Show loading state while fetching user
  if (loading || !user) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <div className="text-lg font-semibold mb-2">Loading...</div>
            <div className="text-sm text-muted-foreground">Fetching payroll information</div>
          </div>
        </div>
      </MainLayout>
    );
  }

  // Employee View
  if (user?.role === UserRole.EMPLOYEE) {
    return (
      <MainLayout>
        <div className="space-y-6">
          <div>
            <h1 className="text-3xl font-bold text-foreground">My Payroll</h1>
            <p className="text-muted-foreground mt-1">View your payroll history and earnings</p>
          </div>

          {/* Summary Cards */}
          {stats && (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Current Month</CardTitle>
                  <DollarSign className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{formatCurrency(Math.abs(stats.stats?.currentMonthEarnings || 0))}</div>
                  <p className="text-xs text-muted-foreground">This month&apos;s earnings</p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Year to Date</CardTitle>
                  <DollarSign className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{formatCurrency(Math.abs(stats.stats?.yearToDateTotal || 0))}</div>
                  <p className="text-xs text-muted-foreground">Total earnings this year</p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Average Monthly</CardTitle>
                  <DollarSign className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{formatCurrency(Math.abs(stats.stats?.averageMonthlyEarnings || 0))}</div>
                  <p className="text-xs text-muted-foreground">Average per month</p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total Hours</CardTitle>
                  <Clock className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{((stats.stats?.yearToDateHours ?? 0) || 0).toFixed(2)}h</div>
                  <p className="text-xs text-muted-foreground">This year</p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Pending</CardTitle>
                  <DollarSign className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{stats.stats?.pendingCount || 0}</div>
                  <p className="text-xs text-muted-foreground">Pending payrolls</p>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Calendar and Chart */}
          <div className="grid gap-6 md:grid-cols-2">
            <PayrollCalendar
              payrollRecords={payroll.map((p) => ({
                id: p.id,
                month: p.month,
                year: p.year,
                netSalary: Math.abs(p.netSalary),
                status: p.status,
              }))}
              dailyEarnings={dailyEarnings}
              onDateClick={(payrollRecord, date) => {
                if (payrollRecord) {
                  const found = payroll.find((p: Payroll) => p.id === payrollRecord.id);
                  if (found) setSelectedPayroll(found);
                }
              }}
              onMonthChange={(month, year) => {
                setCalendarMonth(month);
                setCalendarYear(year);
                if (user?.role === UserRole.EMPLOYEE) {
                  fetchDailyEarnings(month, year);
                }
              }}
            />
            <EarningsChart payrollData={payroll} />
          </div>

          {/* Payroll History */}
          <Card>
            <CardHeader>
              <CardTitle>Payroll History</CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="text-center py-8">Loading...</div>
              ) : payroll.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No payroll records found.
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Period</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Hours</TableHead>
                      <TableHead>Base</TableHead>
                      <TableHead>Bonuses</TableHead>
                      <TableHead>Deductions</TableHead>
                      <TableHead>Net Salary</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {payroll.map((record) => {
                      const isExpanded = expandedRows.has(record.id);
                      const hasBonuses = record.bonuses && record.bonuses.length > 0;
                      const hasDeductions = record.deductions && record.deductions.length > 0;
                      const canExpand = hasBonuses || hasDeductions;

                      return (
                        <>
                          <TableRow 
                            key={record.id}
                            className={canExpand ? 'cursor-pointer hover:bg-muted/50' : ''}
                            onClick={() => {
                              if (canExpand) {
                                const newExpanded = new Set(expandedRows);
                                if (isExpanded) {
                                  newExpanded.delete(record.id);
                                } else {
                                  newExpanded.add(record.id);
                                }
                                setExpandedRows(newExpanded);
                              }
                            }}
                          >
                            <TableCell>
                              {canExpand && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="mr-2 h-4 w-4 p-0"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    const newExpanded = new Set(expandedRows);
                                    if (isExpanded) {
                                      newExpanded.delete(record.id);
                                    } else {
                                      newExpanded.add(record.id);
                                    }
                                    setExpandedRows(newExpanded);
                                  }}
                                >
                                  {isExpanded ? (
                                    <ChevronDown className="h-4 w-4" />
                                  ) : (
                                    <ChevronRight className="h-4 w-4" />
                                  )}
                                </Button>
                              )}
                              {months[record.month - 1]} {record.year}
                            </TableCell>
                            <TableCell>{record.paymentType || '-'}</TableCell>
                            <TableCell>
                              {record.hoursWorked ? `${Math.abs(record.hoursWorked).toFixed(2)}h` : '-'}
                            </TableCell>
                            <TableCell>
                              {record.paymentType === 'HOURLY' 
                                ? formatCurrency(Math.abs(record.baseSalary))
                                : formatCurrency(record.baseSalary)}
                            </TableCell>
                            <TableCell>{formatCurrency(record.totalBonuses)}</TableCell>
                            <TableCell>{formatCurrency(record.totalDeductions)}</TableCell>
                            <TableCell className="font-semibold">
                              {formatCurrency(Math.abs(record.netSalary))}
                            </TableCell>
                            <TableCell>
                              <span className={`px-2 py-1 text-xs rounded-full ${getStatusColor(record.status)}`}>
                                {record.status}
                              </span>
                            </TableCell>
                            <TableCell>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelectedPayroll(record);
                                }}
                              >
                                <Eye className="h-4 w-4" />
                              </Button>
                            </TableCell>
                          </TableRow>
                          {isExpanded && (hasBonuses || hasDeductions) && (
                            <TableRow>
                              <TableCell colSpan={10} className="bg-muted/50">
                                <div className="p-4 space-y-4">
                                  {hasBonuses && (
                                    <div>
                                      <h4 className="font-semibold text-sm mb-2 text-green-700">Bonuses</h4>
                                      <div className="space-y-1">
                                        {record.bonuses!.map((bonus, idx) => (
                                          <div key={idx} className="flex justify-between text-sm">
                                            <span>{bonus.name}</span>
                                            <span className="font-semibold text-green-600 dark:text-green-400">
                                              {formatCurrency(bonus.amount)}
                                            </span>
                                          </div>
                                        ))}
                                        <div className="flex justify-between text-sm font-semibold pt-1 border-t-2 border-border">
                                          <span>Total Bonuses</span>
                                          <span className="text-green-600 dark:text-green-400">
                                            {formatCurrency(record.totalBonuses)}
                                          </span>
                                        </div>
                                      </div>
                                    </div>
                                  )}
                                  {hasDeductions && (
                                    <div>
                                      <h4 className="font-semibold text-sm mb-2 text-red-700">Deductions</h4>
                                      <div className="space-y-1">
                                        {record.deductions!.map((deduction, idx) => (
                                          <div key={idx} className="flex justify-between text-sm">
                                            <span>{deduction.name}</span>
                                            <span className="font-semibold text-red-600 dark:text-red-400">
                                              {formatCurrency(deduction.amount)}
                                            </span>
                                          </div>
                                        ))}
                                        <div className="flex justify-between text-sm font-semibold pt-1 border-t-2 border-border">
                                          <span>Total Deductions</span>
                                          <span className="text-red-600 dark:text-red-400">
                                            {formatCurrency(record.totalDeductions)}
                                          </span>
                                        </div>
                                      </div>
                                    </div>
                                  )}
                                </div>
                              </TableCell>
                            </TableRow>
                          )}
                        </>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Payroll Details Dialog */}
        {selectedPayroll && (
          <Dialog open={!!selectedPayroll} onOpenChange={() => setSelectedPayroll(null)}>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>
                  Payroll Details - {months[selectedPayroll.month - 1]} {selectedPayroll.year}
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Payment Type</Label>
                    <p className="text-sm">{selectedPayroll.paymentType || '-'}</p>
                  </div>
                  {selectedPayroll.hoursWorked && (
                    <div>
                      <Label>Hours Worked</Label>
                      <p className="text-sm">{Math.abs(selectedPayroll.hoursWorked).toFixed(2)} hours</p>
                    </div>
                  )}
                  <div>
                    <Label>{selectedPayroll.paymentType === 'HOURLY' ? 'Hourly Pay' : 'Base Salary'}</Label>
                    <p className="text-sm font-semibold">
                      {formatCurrency(Math.abs(selectedPayroll.baseSalary))}
                    </p>
                  </div>
                  <div>
                    <Label>Net Salary</Label>
                    <p className="text-sm font-semibold text-green-600 dark:text-green-400">
                      {formatCurrency(Math.abs(selectedPayroll.netSalary))}
                    </p>
                  </div>
                </div>
                {selectedPayroll.bonuses && selectedPayroll.bonuses.length > 0 && (
                  <div>
                    <Label>Bonuses</Label>
                    <div className="mt-2 space-y-1">
                      {selectedPayroll.bonuses.map((bonus, idx) => (
                        <div key={idx} className="flex justify-between text-sm">
                          <span>{bonus.name}</span>
                          <span className="font-semibold text-green-600 dark:text-green-400">
                            {formatCurrency(bonus.amount)}
                          </span>
                        </div>
                      ))}
                      <div className="flex justify-between text-sm font-semibold pt-1 border-t-2 border-border">
                        <span>Total Bonuses</span>
                        <span className="text-green-600 dark:text-green-400">
                          {formatCurrency(selectedPayroll.totalBonuses)}
                        </span>
                      </div>
                    </div>
                  </div>
                )}
                {selectedPayroll.deductions && selectedPayroll.deductions.length > 0 && (
                  <div>
                    <Label>Deductions</Label>
                    <div className="mt-2 space-y-1">
                      {selectedPayroll.deductions.map((deduction, idx) => (
                        <div key={idx} className="flex justify-between text-sm">
                          <span>{deduction.name}</span>
                          <span className="font-semibold text-red-600 dark:text-red-400">
                            {formatCurrency(deduction.amount)}
                          </span>
                        </div>
                      ))}
                      <div className="flex justify-between text-sm font-semibold pt-1 border-t-2 border-border">
                        <span>Total Deductions</span>
                        <span className="text-red-600 dark:text-red-400">
                          {formatCurrency(selectedPayroll.totalDeductions)}
                        </span>
                      </div>
                    </div>
                  </div>
                )}
                {selectedPayroll.notes && (
                  <div>
                    <Label>Notes</Label>
                    <p className="text-sm text-muted-foreground">{selectedPayroll.notes}</p>
                  </div>
                )}
              </div>
            </DialogContent>
          </Dialog>
        )}
      </MainLayout>
    );
  }

  // Admin/Manager View
  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Payroll</h1>
            <p className="text-muted-foreground mt-1">Manage employee payroll</p>
          </div>
          <div className="flex items-center gap-3">
            {/* Modern Employee Search Selector */}
            {employees.length > 0 && (
              <EmployeeSearchSelector
                employees={employees}
                selectedEmployeeId={selectedEmployeeId}
                onSelect={(employeeId) => {
                  if (employeeId) {
                    handleEmployeeSelect(employeeId);
                  } else {
                    setSelectedEmployeeId(null);
                    setSelectedEmployee(null);
                    setViewMode('table');
                  }
                }}
                placeholder="Search employees..."
                className="min-w-[280px]"
              />
            )}
            {/* View Mode Toggle */}
            {selectedEmployeeId && (
              <div className="flex items-center gap-1 border rounded-md p-1">
                <Button
                  variant={viewMode === 'table' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setViewMode('table')}
                >
                  <TableIcon className="h-4 w-4 mr-1" />
                  Table
                </Button>
                <Button
                  variant={viewMode === 'calendar' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setViewMode('calendar')}
                >
                  <Calendar className="h-4 w-4 mr-1" />
                  Calendar
                </Button>
              </div>
            )}
            </div>
            <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button className="bg-primary hover:bg-primary/90" onClick={resetForm}>
                <Plus className="mr-2 h-4 w-4" />
                New Payroll
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Create Payroll</DialogTitle>
                <DialogDescription>
                  Generate payroll for an employee
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                {/* Step 1: Employee Selection */}
                <div className="space-y-2">
                  <Label htmlFor="employee">Employee *</Label>
                    <Select
                    value={formData.userId}
                    onValueChange={handleEmployeeSelectForPayroll}
                    required
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select employee" />
                    </SelectTrigger>
                    <SelectContent>
                      {employees.map((emp) => (
                        <SelectItem key={emp.id} value={emp.id}>
                          {emp.name} ({emp.email})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {selectedEmployee && (
                    <div className="p-2 bg-blue-500/20 dark:bg-blue-500/30 rounded border-2 border-blue-300/50 dark:border-blue-500/30 text-sm">
                      <p>
                        <strong>Payment Type:</strong> {formData.paymentType || selectedEmployee.paymentType || 'Not set'}
                      </p>
                      {(formData.paymentType === 'HOURLY' || (!formData.paymentType && selectedEmployee.paymentType === 'HOURLY')) && (
                        <>
                          {formData.hourlyRate ? (
                            <p>
                              <strong>Hourly Rate:</strong> {formatCurrency(parseFloat(formData.hourlyRate))}
                            </p>
                          ) : selectedEmployee.hourlyRate && (
                            <p>
                              <strong>Default Hourly Rate:</strong> {formatCurrency(selectedEmployee.hourlyRate)}
                            </p>
                          )}
                        </>
                      )}
                      {(formData.paymentType === 'SALARY' || (!formData.paymentType && selectedEmployee.paymentType === 'SALARY')) && (
                        <>
                          {formData.baseSalary ? (
                            <p>
                              <strong>Base Salary:</strong> {formatCurrency(parseFloat(formData.baseSalary))}
                            </p>
                          ) : selectedEmployee.monthlySalary && (
                            <p>
                              <strong>Default Monthly Salary:</strong> {formatCurrency(selectedEmployee.monthlySalary)}
                            </p>
                          )}
                        </>
                      )}
                    </div>
                  )}
                </div>

                {/* Step 2: Period */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="month">Month *</Label>
                    <Select
                      value={formData.month.toString()}
                      onValueChange={(value) => setFormData({ ...formData, month: parseInt(value) })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {months.map((month, index) => (
                          <SelectItem key={index} value={(index + 1).toString()}>
                            {month}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="year">Year *</Label>
                    <Input
                      id="year"
                      type="number"
                      min="2000"
                      max="2100"
                      value={formData.year}
                      onChange={(e) => setFormData({ ...formData, year: parseInt(e.target.value) })}
                      required
                    />
                  </div>
                </div>

                {/* Step 3: Payment Configuration */}
                    <div className="p-4 bg-muted/50 rounded-lg border-2 border-border">
                  <Label className="text-sm font-semibold mb-2 block">Payment Configuration</Label>
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="paymentType">Payment Type *</Label>
                      <Select
                        value={formData.paymentType}
                        onValueChange={(value) => setFormData({ ...formData, paymentType: value as 'HOURLY' | 'SALARY' })}
                        required
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select payment type" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="HOURLY">Hourly</SelectItem>
                          <SelectItem value="SALARY">Salary</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {formData.paymentType === 'HOURLY' && (
                      <>
                        <div className="space-y-2">
                          <Label htmlFor="hoursWorked">Hours Worked *</Label>
                          <Input
                            id="hoursWorked"
                            type="number"
                            step="0.01"
                            min="0"
                            value={formData.hoursWorked}
                            onChange={(e) => setFormData({ ...formData, hoursWorked: e.target.value })}
                            placeholder="Will be calculated from attendance if not provided"
                          />
                          <p className="text-xs text-muted-foreground">
                            Leave empty to auto-calculate from attendance records
                          </p>
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="hourlyRate">Hourly Rate ($) *</Label>
                          <Input
                            id="hourlyRate"
                            type="number"
                            step="0.01"
                            min="0"
                            value={formData.hourlyRate}
                            onChange={(e) => setFormData({ ...formData, hourlyRate: e.target.value })}
                            required
                          />
                        </div>
                        {formData.hoursWorked && formData.hourlyRate && (
                          <div className="p-2 bg-blue-500/20 dark:bg-blue-500/30 rounded border-2 border-blue-300/50 dark:border-blue-500/30 text-sm">
                            <strong>Base Salary Preview:</strong>{' '}
                            {formatCurrency(parseFloat(formData.hoursWorked) * parseFloat(formData.hourlyRate))}
                          </div>
                        )}
                      </>
                    )}

                    {formData.paymentType === 'SALARY' && (
                      <div className="space-y-2">
                        <Label htmlFor="baseSalary">Base Salary ($) *</Label>
                        <Input
                          id="baseSalary"
                          type="number"
                          step="0.01"
                          min="0"
                          value={formData.baseSalary}
                          onChange={(e) => setFormData({ ...formData, baseSalary: e.target.value })}
                          required
                        />
                      </div>
                    )}
                  </div>
                </div>

                {/* Step 4: Bonuses */}
                <div className="p-4 bg-green-500/20 dark:bg-green-500/30 rounded-lg border-2 border-green-300/50 dark:border-green-500/30">
                  <div className="flex items-center justify-between mb-2">
                    <Label className="text-sm font-semibold">Bonuses</Label>
                    <Button type="button" variant="outline" size="sm" onClick={addBonus}>
                      <Plus className="h-4 w-4 mr-1" />
                      Add Bonus
                    </Button>
                  </div>
                  <div className="space-y-2">
                    {formData.bonuses.map((bonus, index) => (
                      <div key={index} className="flex gap-2 items-end">
                        <div className="flex-1">
                          <Input
                            placeholder="Bonus name"
                            value={bonus.name}
                            onChange={(e) => updateBonus(index, 'name', e.target.value)}
                          />
                        </div>
                        <div className="flex-1">
                          <Input
                            type="number"
                            step="0.01"
                            min="0"
                            placeholder="Amount"
                            value={bonus.amount || ''}
                            onChange={(e) => updateBonus(index, 'amount', parseFloat(e.target.value) || 0)}
                          />
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => removeBonus(index)}
                        >
                          <Trash2 className="h-4 w-4 text-red-600 dark:text-red-400" />
                        </Button>
                      </div>
                    ))}
                    {formData.bonuses.length === 0 && (
                      <p className="text-xs text-muted-foreground">No bonuses added</p>
                    )}
                    {formData.bonuses.length > 0 && (
                      <div className="pt-2 border-t-2 border-border">
                        <p className="text-sm font-semibold">
                          Total Bonuses: {formatCurrency(calculateTotalBonuses())}
                        </p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Step 5: Deductions */}
                <div className="p-4 bg-red-500/20 dark:bg-red-500/30 rounded-lg border-2 border-red-300/50 dark:border-red-500/30">
                  <div className="flex items-center justify-between mb-2">
                    <Label className="text-sm font-semibold">Deductions</Label>
                    <Button type="button" variant="outline" size="sm" onClick={addDeduction}>
                      <Plus className="h-4 w-4 mr-1" />
                      Add Deduction
                    </Button>
                  </div>
                  <div className="space-y-2">
                    {formData.deductions.map((deduction, index) => (
                      <div key={index} className="flex gap-2 items-end">
                        <div className="flex-1">
                          <Input
                            placeholder="Deduction name"
                            value={deduction.name}
                            onChange={(e) => updateDeduction(index, 'name', e.target.value)}
                          />
                        </div>
                        <div className="flex-1">
                          <Input
                            type="number"
                            step="0.01"
                            min="0"
                            placeholder="Amount"
                            value={deduction.amount || ''}
                            onChange={(e) => updateDeduction(index, 'amount', parseFloat(e.target.value) || 0)}
                          />
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => removeDeduction(index)}
                        >
                          <Trash2 className="h-4 w-4 text-red-600 dark:text-red-400" />
                        </Button>
                      </div>
                    ))}
                    {formData.deductions.length === 0 && (
                      <p className="text-xs text-muted-foreground">No deductions added</p>
                    )}
                    {formData.deductions.length > 0 && (
                      <div className="pt-2 border-t-2 border-border">
                        <p className="text-sm font-semibold">
                          Total Deductions: {formatCurrency(calculateTotalDeductions())}
                        </p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Step 6: Summary */}
                <div className="p-4 bg-blue-500/20 dark:bg-blue-500/30 rounded-lg border-2 border-blue-300/50 dark:border-blue-500/30">
                  <Label className="text-sm font-semibold mb-2 block">Summary</Label>
                  <div className="space-y-1 text-sm">
                    <div className="flex justify-between">
                      <span>{formData.paymentType === 'HOURLY' ? 'Hourly Pay' : 'Base Salary'}:</span>
                      <span className="font-semibold">
                        {formatCurrency(calculateBaseSalary())}
                      </span>
                    </div>
                    <div className="flex justify-between text-green-600 dark:text-green-400">
                      <span>Total Bonuses:</span>
                      <span className="font-semibold">{formatCurrency(calculateTotalBonuses())}</span>
                    </div>
                    <div className="flex justify-between text-red-600 dark:text-red-400">
                      <span>Total Deductions:</span>
                      <span className="font-semibold">{formatCurrency(calculateTotalDeductions())}</span>
                    </div>
                    <div className="flex justify-between pt-2 border-t-2 border-border font-bold text-lg">
                      <span>Net Salary:</span>
                      <span className="text-green-600 dark:text-green-400">{formatCurrency(calculateNetSalary())}</span>
                    </div>
                  </div>
                </div>

                {/* Notes */}
                <div className="space-y-2">
                  <Label htmlFor="notes">Notes</Label>
                  <Input
                    id="notes"
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    placeholder="Optional notes"
                  />
                </div>

                <div className="flex justify-end gap-2">
                  <Button type="button" variant="outline" onClick={() => { setOpen(false); resetForm(); }}>
                    Cancel
                  </Button>
                  <Button type="submit">Create Payroll</Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {/* Calendar View for Selected Employee */}
        {selectedEmployeeId && viewMode === 'calendar' && (
          <div className="space-y-6">
            {/* Employee Summary Stats */}
            {selectedEmployee && employeeStats && (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Employee</CardTitle>
                    <Users className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{selectedEmployee.name}</div>
                    <p className="text-xs text-muted-foreground">{selectedEmployee.email}</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Total Hours</CardTitle>
                    <Clock className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">
                      {((employeeStats.stats?.yearToDateHours ?? 0) || 0).toFixed(2)}h
                    </div>
                    <p className="text-xs text-muted-foreground">This year</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Hourly Rate</CardTitle>
                    <DollarSign className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">
                      {selectedEmployee.hourlyRate 
                        ? formatCurrency(selectedEmployee.hourlyRate)
                        : 'N/A'}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {selectedEmployee.paymentType || 'Not set'}
                    </p>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Current Month</CardTitle>
                    <DollarSign className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">
                      {formatCurrency(Math.abs(employeeStats.stats?.currentMonthEarnings || 0))}
                    </div>
                    <p className="text-xs text-muted-foreground">This month&apos;s earnings</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Year to Date</CardTitle>
                    <DollarSign className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">
                      {formatCurrency(Math.abs(employeeStats.stats?.yearToDateTotal || 0))}
                    </div>
                    <p className="text-xs text-muted-foreground">Total earnings this year</p>
                  </CardContent>
                </Card>
              </div>
            )}

            {/* Calendar and Edit Panel */}
            <div className="grid gap-6 md:grid-cols-2">
              <PayrollCalendar
                payrollRecords={payroll
                  .filter((p) => p.user.id === selectedEmployeeId)
                  .map((p) => ({
                    id: p.id,
                    month: p.month,
                    year: p.year,
                    netSalary: Math.abs(p.netSalary),
                    status: p.status,
                  }))}
                dailyEarnings={dailyEarnings}
                onDateClick={(payrollRecord, date) => {
                  if (payrollRecord) {
                    const found = payroll.find((p: Payroll) => p.id === payrollRecord.id);
                    if (found) setSelectedPayroll(found);
                  }
                }}
                onMonthChange={(month, year) => {
                  setCalendarMonth(month);
                  setCalendarYear(year);
                }}
                isEditable={true}
                employeeId={selectedEmployeeId}
                onDayEdit={(date, data) => {
                  // Ensure date is normalized to UTC midnight
                  const normalizedDate = new Date(Date.UTC(
                    date.getFullYear(),
                    date.getMonth(),
                    date.getDate(),
                    0, 0, 0, 0
                  ));
                  setEditDialogDate(normalizedDate);
                  setEditDialogData(data);
                  // Initialize edit panel fields
                  setEditPanelHours(data.hours?.toFixed(2) || '0');
                  setEditPanelRate(data.hourlyRate?.toFixed(2) || '');
                  setEditPanelRegularHours(data.regularHours?.toFixed(2) || '0');
                  setEditPanelOvertimeHours(data.overtimeHours?.toFixed(2) || '0');
                  setEditPanelEarnings(data.earnings?.toFixed(2) || '0');
                }}
              />
              
              {/* Edit Panel */}
              <Card>
                <CardHeader>
                  <CardTitle>Edit Daily Payroll</CardTitle>
                  <p className="text-sm text-muted-foreground mt-1">
                    {editDialogDate 
                      ? `Editing: ${editDialogDate.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}`
                      : 'Click on a date in the calendar to edit'}
                  </p>
                </CardHeader>
                <CardContent>
                  {editDialogDate && editDialogData ? (
                    <div className="space-y-4">
                      {/* Original Data Display */}
                      {editDialogData.originalData && (
                        <div className="p-4 bg-muted/50 rounded-lg border-2 border-border">
                          <h4 className="font-semibold mb-2 text-sm">Original Attendance Data</h4>
                          <div className="grid grid-cols-2 gap-2 text-sm">
                            <div>
                              <span className="text-muted-foreground">Hours:</span>{' '}
                              <span className="font-medium">{editDialogData.originalData.hours.toFixed(2)}h</span>
                            </div>
                            <div>
                              <span className="text-muted-foreground">Regular:</span>{' '}
                              <span className="font-medium">{editDialogData.originalData.regularHours.toFixed(2)}h</span>
                            </div>
                            <div>
                              <span className="text-muted-foreground">Overtime:</span>{' '}
                              <span className="font-medium">{editDialogData.originalData.overtimeHours.toFixed(2)}h</span>
                            </div>
                            <div>
                              <span className="text-muted-foreground">Rate:</span>{' '}
                              <span className="font-medium">
                                {editDialogData.originalData.hourlyRate ? `$${editDialogData.originalData.hourlyRate.toFixed(2)}/hr` : 'N/A'}
                              </span>
                            </div>
                            <div className="col-span-2">
                              <span className="text-muted-foreground">Earnings:</span>{' '}
                              <span className="font-medium">${editDialogData.originalData.earnings.toFixed(2)}</span>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Override Indicator */}
                      {editDialogData.isOverride && (
                        <div className="p-3 bg-yellow-500/20 dark:bg-yellow-500/30 border-2 border-yellow-300/50 dark:border-yellow-500/30 rounded-md">
                          <div className="flex items-center gap-2 text-sm font-semibold text-yellow-700 dark:text-yellow-400">
                            <span>⚠️</span>
                            <span>Manual Override Active</span>
                          </div>
                        </div>
                      )}

                      {/* Editable Fields */}
                      <div className="space-y-3">
                        <div className="grid grid-cols-2 gap-3">
                          <div className="space-y-1">
                            <Label htmlFor="edit-hourly-rate" className="text-xs">Hourly Rate ($)</Label>
                            <Input
                              id="edit-hourly-rate"
                              type="number"
                              step="0.01"
                              min="0"
                              value={editPanelRate}
                              onChange={(e) => {
                                setEditPanelRate(e.target.value);
                                // Recalculate earnings
                                const rate = parseFloat(e.target.value) || 0;
                                const regHours = parseFloat(editPanelRegularHours) || 0;
                                const otHours = parseFloat(editPanelOvertimeHours) || 0;
                                const calculatedEarnings = (regHours * rate) + (otHours * rate * 1.5);
                                setEditPanelEarnings(calculatedEarnings.toFixed(2));
                              }}
                              placeholder="Rate"
                            />
                          </div>
                          <div className="space-y-1">
                            <Label htmlFor="edit-total-hours" className="text-xs">Total Hours</Label>
                            <Input
                              id="edit-total-hours"
                              type="number"
                              step="0.01"
                              min="0"
                              max="24"
                              value={editPanelHours}
                              onChange={(e) => {
                                setEditPanelHours(e.target.value);
                                // Update total if regular + overtime don't match
                                const total = parseFloat(e.target.value) || 0;
                                const regHours = parseFloat(editPanelRegularHours) || 0;
                                const otHours = parseFloat(editPanelOvertimeHours) || 0;
                                if (Math.abs(total - (regHours + otHours)) > 0.01) {
                                  // Adjust regular hours to match total
                                  setEditPanelRegularHours(Math.max(0, total - otHours).toFixed(2));
                                }
                                // Recalculate earnings
                                const rate = parseFloat(editPanelRate) || 0;
                                const newRegHours = Math.max(0, total - otHours);
                                const calculatedEarnings = (newRegHours * rate) + (otHours * rate * 1.5);
                                setEditPanelEarnings(calculatedEarnings.toFixed(2));
                              }}
                              placeholder="Hours"
                            />
                          </div>
                          <div className="space-y-1">
                            <Label htmlFor="edit-regular-hours" className="text-xs">Regular Hours</Label>
                            <Input
                              id="edit-regular-hours"
                              type="number"
                              step="0.01"
                              min="0"
                              value={editPanelRegularHours}
                              onChange={(e) => {
                                setEditPanelRegularHours(e.target.value);
                                // Update total hours
                                const regHours = parseFloat(e.target.value) || 0;
                                const otHours = parseFloat(editPanelOvertimeHours) || 0;
                                setEditPanelHours((regHours + otHours).toFixed(2));
                                // Recalculate earnings
                                const rate = parseFloat(editPanelRate) || 0;
                                const calculatedEarnings = (regHours * rate) + (otHours * rate * 1.5);
                                setEditPanelEarnings(calculatedEarnings.toFixed(2));
                              }}
                              placeholder="Regular"
                            />
                          </div>
                          <div className="space-y-1">
                            <Label htmlFor="edit-overtime-hours" className="text-xs">Overtime Hours</Label>
                            <Input
                              id="edit-overtime-hours"
                              type="number"
                              step="0.01"
                              min="0"
                              value={editPanelOvertimeHours}
                              onChange={(e) => {
                                setEditPanelOvertimeHours(e.target.value);
                                // Update total hours
                                const otHours = parseFloat(e.target.value) || 0;
                                const regHours = parseFloat(editPanelRegularHours) || 0;
                                setEditPanelHours((regHours + otHours).toFixed(2));
                                // Recalculate earnings
                                const rate = parseFloat(editPanelRate) || 0;
                                const calculatedEarnings = (regHours * rate) + (otHours * rate * 1.5);
                                setEditPanelEarnings(calculatedEarnings.toFixed(2));
                              }}
                              placeholder="Overtime"
                            />
                          </div>
                        </div>
                        <div className="space-y-1">
                          <Label htmlFor="edit-earnings" className="text-xs">Earnings ($)</Label>
                          <Input
                            id="edit-earnings"
                            type="number"
                            step="0.01"
                            min="0"
                            value={editPanelEarnings}
                            onChange={(e) => setEditPanelEarnings(e.target.value)}
                            placeholder="Calculated automatically"
                            className="font-semibold text-green-600 dark:text-green-400"
                          />
                          <p className="text-xs text-muted-foreground">
                            Earnings are calculated automatically based on rate and hours
                          </p>
                        </div>
                      </div>

                      <div className="flex flex-col gap-2 pt-2">
                        <div className="flex gap-2">
                          <Button
                            onClick={async () => {
                              try {
                                await handleSaveDailyOverride({
                                  hourlyRate: parseFloat(editPanelRate) || undefined,
                                  regularHours: parseFloat(editPanelRegularHours) || undefined,
                                  overtimeHours: parseFloat(editPanelOvertimeHours) || undefined,
                                  totalHours: parseFloat(editPanelHours) || undefined,
                                  earnings: parseFloat(editPanelEarnings) || undefined,
                                });
                                // Refresh the edit panel data
                                await fetchDailyEarnings(calendarMonth, calendarYear, selectedEmployeeId);
                              } catch (error) {
                                console.error('Error saving:', error);
                              }
                            }}
                            className="flex-1"
                          >
                            <Save className="h-4 w-4 mr-2" />
                            Quick Save
                          </Button>
                          <Button
                            variant="outline"
                            onClick={() => {
                              // Prepare data for edit dialog
                              const updatedData = {
                                ...editDialogData,
                                hours: parseFloat(editPanelHours) || 0,
                                hourlyRate: parseFloat(editPanelRate) || null,
                                regularHours: parseFloat(editPanelRegularHours) || 0,
                                overtimeHours: parseFloat(editPanelOvertimeHours) || 0,
                                earnings: parseFloat(editPanelEarnings) || 0,
                              };
                              handleDayEdit(editDialogDate, updatedData);
                            }}
                            className="flex-1"
                          >
                            <Eye className="h-4 w-4 mr-2" />
                            Full Editor
                          </Button>
                        </div>
                        {editDialogData.isOverride && (
                          <Button
                            variant="destructive"
                            onClick={handleDeleteDailyOverride}
                            className="w-full"
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Remove Override
                          </Button>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-8 text-muted-foreground">
                      <Calendar className="h-12 w-12 mx-auto mb-2 opacity-50" />
                      <p>Select a date from the calendar to view and edit details</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        )}

        {/* Payroll Records Table */}
        <Card>
          <CardHeader>
            <CardTitle>Payroll Records</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-center py-8">Loading...</div>
            ) : payroll.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No payroll records found.
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Employee</TableHead>
                    <TableHead>Period</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Hours</TableHead>
                    <TableHead>Base</TableHead>
                    <TableHead>Bonuses</TableHead>
                    <TableHead>Deductions</TableHead>
                    <TableHead>Net Salary</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {payroll.map((record) => {
                    const isExpanded = expandedRows.has(record.id);
                    const hasBonuses = record.bonuses && record.bonuses.length > 0;
                    const hasDeductions = record.deductions && record.deductions.length > 0;
                    const canExpand = hasBonuses || hasDeductions;

                    return (
                      <>
                        <TableRow 
                          key={record.id}
                          className={canExpand ? 'cursor-pointer hover:bg-muted/50' : ''}
                          onClick={() => {
                            if (canExpand) {
                              const newExpanded = new Set(expandedRows);
                              if (isExpanded) {
                                newExpanded.delete(record.id);
                              } else {
                                newExpanded.add(record.id);
                              }
                              setExpandedRows(newExpanded);
                            }
                          }}
                        >
                          <TableCell className="font-medium">
                            {canExpand && (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="mr-2 h-4 w-4 p-0"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  const newExpanded = new Set(expandedRows);
                                  if (isExpanded) {
                                    newExpanded.delete(record.id);
                                  } else {
                                    newExpanded.add(record.id);
                                  }
                                  setExpandedRows(newExpanded);
                                }}
                              >
                                {isExpanded ? (
                                  <ChevronDown className="h-4 w-4" />
                                ) : (
                                  <ChevronRight className="h-4 w-4" />
                                )}
                              </Button>
                            )}
                            {record.user.name}
                          </TableCell>
                          <TableCell>
                            {months[record.month - 1]} {record.year}
                          </TableCell>
                          <TableCell>{record.paymentType || '-'}</TableCell>
                          <TableCell>
                            {record.hoursWorked ? `${Math.abs(record.hoursWorked).toFixed(2)}h` : '-'}
                          </TableCell>
                          <TableCell>
                            {record.paymentType === 'HOURLY' 
                              ? formatCurrency(Math.abs(record.baseSalary))
                              : formatCurrency(record.baseSalary)}
                          </TableCell>
                          <TableCell>{formatCurrency(record.totalBonuses)}</TableCell>
                          <TableCell>{formatCurrency(record.totalDeductions)}</TableCell>
                          <TableCell className="font-semibold">
                            {formatCurrency(Math.abs(record.netSalary))}
                          </TableCell>
                          <TableCell>
                            <span className={`px-2 py-1 text-xs rounded-full ${getStatusColor(record.status)}`}>
                              {record.status}
                            </span>
                          </TableCell>
                          <TableCell className="text-right">
                            {record.status === PayrollStatus.PENDING && (
                              <div className="flex justify-end gap-2">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleApprove(record.id);
                                  }}
                                >
                                  <Check className="h-4 w-4 text-green-600 dark:text-green-400" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleReject(record.id);
                                  }}
                                >
                                  <X className="h-4 w-4 text-red-600 dark:text-red-400" />
                                </Button>
                              </div>
                            )}
                          </TableCell>
                        </TableRow>
                        {isExpanded && (hasBonuses || hasDeductions) && (
                          <TableRow>
                            <TableCell colSpan={10} className="bg-muted/50">
                              <div className="p-4 space-y-4">
                                {hasBonuses && (
                                  <div>
                                    <h4 className="font-semibold text-sm mb-2 text-green-700">Bonuses</h4>
                                    <div className="space-y-1">
                                      {record.bonuses!.map((bonus, idx) => (
                                        <div key={idx} className="flex justify-between text-sm">
                                          <span>{bonus.name}</span>
                                          <span className="font-semibold text-green-600 dark:text-green-400">
                                            {formatCurrency(bonus.amount)}
                                          </span>
                                        </div>
                                      ))}
                                      <div className="flex justify-between text-sm font-semibold pt-1 border-t-2 border-border">
                                        <span>Total Bonuses</span>
                                        <span className="text-green-600 dark:text-green-400">
                                          {formatCurrency(record.totalBonuses)}
                                        </span>
                                      </div>
                                    </div>
                                  </div>
                                )}
                                {hasDeductions && (
                                  <div>
                                    <h4 className="font-semibold text-sm mb-2 text-red-700">Deductions</h4>
                                    <div className="space-y-1">
                                      {record.deductions!.map((deduction, idx) => (
                                        <div key={idx} className="flex justify-between text-sm">
                                          <span>{deduction.name}</span>
                                          <span className="font-semibold text-red-600 dark:text-red-400">
                                            {formatCurrency(deduction.amount)}
                                          </span>
                                        </div>
                                      ))}
                                      <div className="flex justify-between text-sm font-semibold pt-1 border-t-2 border-border">
                                        <span>Total Deductions</span>
                                        <span className="text-red-600 dark:text-red-400">
                                          {formatCurrency(record.totalDeductions)}
                                        </span>
                                      </div>
                                    </div>
                                  </div>
                                )}
                              </div>
                            </TableCell>
                          </TableRow>
                        )}
                      </>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Daily Payroll Edit Dialog */}
        {selectedEmployeeId && editDialogDate && (
          <DailyPayrollEditDialog
            open={editDialogOpen}
            onOpenChange={setEditDialogOpen}
            date={editDialogDate}
            userId={selectedEmployeeId}
            currentData={editDialogData}
            originalData={editDialogData?.originalData || (editDialogData && !editDialogData.isOverride ? editDialogData : null)}
            onSave={handleSaveDailyOverride}
            onDelete={editDialogData?.isOverride ? handleDeleteDailyOverride : undefined}
          />
        )}
      </div>
    </MainLayout>
  );
}







