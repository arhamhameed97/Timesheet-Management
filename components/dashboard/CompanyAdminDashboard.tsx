'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Users, Clock, FileText, DollarSign, Building2, CheckCircle, XCircle, Eye, Search } from 'lucide-react';
import { DesignationBadge } from '@/components/common/DesignationBadge';
import { RoleBadge } from '@/components/common/RoleBadge';
import { UserRole } from '@prisma/client';
import { format, differenceInSeconds } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import Link from 'next/link';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

interface CompanyAdminDashboardProps {
  stats: {
    totalEmployees: number;
    todayAttendance: number;
    pendingTimesheets: number;
    monthlyPayroll: number;
  };
  user: {
    name: string;
    role: UserRole;
    designation?: {
      id: string;
      name: string;
    } | null;
  };
}

interface EmployeeAttendance {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  attendanceStats?: {
    todayStatus: {
      checkedIn: boolean;
      checkedOut: boolean;
      checkInTime: string | null;
      checkOutTime: string | null;
    };
  };
}

export function CompanyAdminDashboard({ stats, user }: CompanyAdminDashboardProps) {
  const [recentAttendance, setRecentAttendance] = useState<EmployeeAttendance[]>([]);
  const [allEmployees, setAllEmployees] = useState<EmployeeAttendance[]>([]);
  const [loadingAttendance, setLoadingAttendance] = useState(true);
  const [selectedDate, setSelectedDate] = useState<string>(format(new Date(), 'yyyy-MM-dd'));
  const [employeeSearch, setEmployeeSearch] = useState<string>('');
  const [currentTime, setCurrentTime] = useState<Date>(new Date());

  useEffect(() => {
    fetchRecentAttendance();
  }, [selectedDate]);

  // Update current time every minute for real-time shift time calculation
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(new Date());
    }, 60000); // Update every minute

    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    // Filter employees based on search term
    if (employeeSearch.trim() === '') {
      setRecentAttendance(allEmployees);
    } else {
      const filtered = allEmployees.filter(emp =>
        emp.name.toLowerCase().includes(employeeSearch.toLowerCase()) ||
        emp.email.toLowerCase().includes(employeeSearch.toLowerCase())
      );
      setRecentAttendance(filtered);
    }
  }, [employeeSearch, allEmployees]);

  const fetchRecentAttendance = async () => {
    try {
      setLoadingAttendance(true);
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/employees?attendanceDate=${selectedDate}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        // Show ALL employees with their attendance status for the selected date
        // Don't filter by checkedIn status - show everyone
        const allEmployeesData = (data.employees || []) as EmployeeAttendance[];
        setAllEmployees(allEmployeesData);
        setRecentAttendance(allEmployeesData);
      }
    } catch (error) {
      console.error('Failed to fetch recent attendance:', error);
    } finally {
      setLoadingAttendance(false);
    }
  };

  const formatTime = (dateString: string | null) => {
    if (!dateString) return '-';
    return format(new Date(dateString), 'HH:mm');
  };

  const calculateShiftTime = (checkInTime: string | null, checkOutTime: string | null): string => {
    if (!checkInTime) return '-';
    
    const checkIn = new Date(checkInTime);
    const checkOut = checkOutTime ? new Date(checkOutTime) : currentTime; // Use current time if not checked out
    
    const totalSeconds = Math.abs(differenceInSeconds(checkOut, checkIn));
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    
    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    return `${minutes}m`;
  };

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center gap-3 mb-2">
          <h1 className="text-3xl font-bold text-gray-900">Company Admin Dashboard</h1>
          <RoleBadge role={user.role} />
          {user.designation && <DesignationBadge designation={user.designation} />}
        </div>
        <p className="text-gray-600 mt-1">Welcome back, {user.name}! Here&apos;s your company overview.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Employees</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalEmployees}</div>
            <p className="text-xs text-muted-foreground">Active employees</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Today&apos;s Attendance</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.todayAttendance}</div>
            <p className="text-xs text-muted-foreground">Checked in today</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending Timesheets</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.pendingTimesheets}</div>
            <p className="text-xs text-muted-foreground">Awaiting approval</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Monthly Payroll</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${stats.monthlyPayroll.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">This month</p>
          </CardContent>
        </Card>
      </div>

      {/* Today's Company Attendance */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Company Attendance</CardTitle>
            <Link href="/employees">
              <Button variant="outline" size="sm">
                View All
              </Button>
            </Link>
          </div>
        </CardHeader>
        <CardContent>
          {/* Filters */}
          <div className="flex flex-col sm:flex-row gap-4 mb-6">
            <div className="flex-1">
              <label className="text-sm font-medium text-gray-700 mb-2 block">Filter by Date</label>
              <Input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="w-full"
              />
            </div>
            <div className="flex-1">
              <label className="text-sm font-medium text-gray-700 mb-2 block">Search Employee</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  type="text"
                  placeholder="Search by name or email..."
                  value={employeeSearch}
                  onChange={(e) => setEmployeeSearch(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
          </div>
          {loadingAttendance ? (
            <div className="text-center py-4 text-gray-500">Loading...</div>
          ) : recentAttendance.length === 0 ? (
            <div className="text-center py-4 text-gray-500">
              {employeeSearch ? 'No employees found matching your search.' : `No employees found for ${format(new Date(selectedDate), 'MMM dd, yyyy')}.`}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Employee</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Check-In Time</TableHead>
                    <TableHead>Check-Out Time</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {recentAttendance.map((employee) => (
                    <TableRow key={employee.id}>
                      <TableCell className="font-medium">{employee.name}</TableCell>
                      <TableCell>
                        <RoleBadge role={employee.role} />
                      </TableCell>
                      <TableCell>
                        {employee.attendanceStats?.todayStatus?.checkedOut ? (
                          <div className="flex items-center gap-1 text-green-600">
                            <CheckCircle className="h-4 w-4" />
                            <span className="text-xs">Checked Out</span>
                          </div>
                        ) : employee.attendanceStats?.todayStatus?.checkedIn ? (
                          <div className="flex items-center gap-1 text-blue-600">
                            <Clock className="h-4 w-4" />
                            <span className="text-xs">Checked In</span>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1 text-gray-400">
                            <XCircle className="h-4 w-4" />
                            <span className="text-xs">Not Checked In</span>
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        {employee.attendanceStats?.todayStatus?.checkInTime ? (
                          <div className="flex flex-col">
                            <span className="text-sm font-medium">{formatTime(employee.attendanceStats.todayStatus.checkInTime)}</span>
                            <span className="text-xs text-gray-500">
                              {format(new Date(employee.attendanceStats.todayStatus.checkInTime), 'MMM dd')}
                            </span>
                            <span className="text-xs text-green-600 font-medium mt-0.5">
                              Shift: {calculateShiftTime(
                                employee.attendanceStats.todayStatus.checkInTime,
                                employee.attendanceStats.todayStatus.checkOutTime
                              )}
                            </span>
                          </div>
                        ) : (
                          <span className="text-gray-400 text-sm">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {employee.attendanceStats?.todayStatus?.checkOutTime ? (
                          <div className="flex flex-col">
                            <span className="text-sm font-medium">{formatTime(employee.attendanceStats.todayStatus.checkOutTime)}</span>
                            <span className="text-xs text-gray-500">
                              {format(new Date(employee.attendanceStats.todayStatus.checkOutTime), 'MMM dd')}
                            </span>
                          </div>
                        ) : employee.attendanceStats?.todayStatus?.checkedIn && !employee.attendanceStats?.todayStatus?.checkedOut ? (
                          <div className="flex flex-col">
                            <span className="text-xs text-blue-600 font-medium">In Progress</span>
                            <span className="text-xs text-green-600 font-medium mt-0.5">
                              Shift: {calculateShiftTime(
                                employee.attendanceStats.todayStatus.checkInTime,
                                null
                              )}
                            </span>
                          </div>
                        ) : (
                          <span className="text-gray-400 text-sm">-</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <Link href="/employees">
                          <Button variant="ghost" size="sm">
                            <Eye className="h-4 w-4" />
                          </Button>
                        </Link>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Quick Actions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3">
            <Link href="/settings">
              <div className="p-4 border rounded-lg hover:bg-gray-50 cursor-pointer">
                <Building2 className="h-6 w-6 text-purple-600 mb-2" />
                <h3 className="font-semibold">Company Settings</h3>
                <p className="text-sm text-gray-600">Manage company profile and settings</p>
              </div>
            </Link>
            <Link href="/employees">
              <div className="p-4 border rounded-lg hover:bg-gray-50 cursor-pointer">
                <Users className="h-6 w-6 text-purple-600 mb-2" />
                <h3 className="font-semibold">Manage Employees</h3>
                <p className="text-sm text-gray-600">Add or remove employees</p>
              </div>
            </Link>
            <Link href="/timesheets">
              <div className="p-4 border rounded-lg hover:bg-gray-50 cursor-pointer">
                <FileText className="h-6 w-6 text-purple-600 mb-2" />
                <h3 className="font-semibold">Review Timesheets</h3>
                <p className="text-sm text-gray-600">Approve pending timesheets</p>
              </div>
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}











