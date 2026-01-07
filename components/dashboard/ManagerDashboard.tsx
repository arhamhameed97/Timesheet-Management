'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Users, Clock, FileText, TrendingUp, CheckCircle, XCircle, Eye } from 'lucide-react';
import { DesignationBadge } from '@/components/common/DesignationBadge';
import { RoleBadge } from '@/components/common/RoleBadge';
import { UserRole } from '@prisma/client';
import { format, differenceInSeconds } from 'date-fns';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

interface ManagerDashboardProps {
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
  attendanceStats?: {
    todayStatus: {
      checkedIn: boolean;
      checkedOut: boolean;
      checkInTime: string | null;
      checkOutTime: string | null;
    };
  };
}

export function ManagerDashboard({ stats, user }: ManagerDashboardProps) {
  const [recentAttendance, setRecentAttendance] = useState<EmployeeAttendance[]>([]);
  const [loadingAttendance, setLoadingAttendance] = useState(true);
  const [currentTime, setCurrentTime] = useState<Date>(new Date());
  const [pendingTasks, setPendingTasks] = useState<any[]>([]);
  const [loadingTasks, setLoadingTasks] = useState(false);

  useEffect(() => {
    fetchRecentAttendance();
    fetchPendingTasks();
  }, []);

  const fetchPendingTasks = async () => {
    try {
      setLoadingTasks(true);
      const token = localStorage.getItem('token');
      const response = await fetch('/api/tasks/assignments?status=COMPLETED', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setPendingTasks(data.tasks || []);
      }
    } catch (error) {
      console.error('Failed to fetch pending tasks:', error);
    } finally {
      setLoadingTasks(false);
    }
  };

  const handleApproveTask = async (taskId: string) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/tasks/assignments/${taskId}`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ approve: true }),
      });

      if (response.ok) {
        await fetchPendingTasks();
        alert('Task approved successfully');
      } else {
        const data = await response.json();
        alert(data.error || 'Failed to approve task');
      }
    } catch (error) {
      console.error('Failed to approve task:', error);
      alert('Failed to approve task');
    }
  };

  const handleRejectTask = async (taskId: string) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/tasks/assignments/${taskId}`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ status: 'IN_PROGRESS' }),
      });

      if (response.ok) {
        await fetchPendingTasks();
        alert('Task rejected and set back to In Progress');
      } else {
        const data = await response.json();
        alert(data.error || 'Failed to reject task');
      }
    } catch (error) {
      console.error('Failed to reject task:', error);
      alert('Failed to reject task');
    }
  };

  // Update current time every minute for real-time shift time calculation
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(new Date());
    }, 60000); // Update every minute

    return () => clearInterval(interval);
  }, []);

  const fetchRecentAttendance = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/employees', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        // Get employees who checked in today
        const checkedInToday = (data.employees || [])
          .filter((emp: EmployeeAttendance) => emp.attendanceStats?.todayStatus?.checkedIn)
          .slice(0, 5); // Show top 5
        setRecentAttendance(checkedInToday);
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
          <h1 className="text-3xl font-bold text-gray-900">Manager Dashboard</h1>
          <RoleBadge role={user.role} />
          {user.designation && <DesignationBadge designation={user.designation} />}
        </div>
        <p className="text-gray-600 mt-1">Welcome back, {user.name}! Manage your team effectively.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Team Members</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalEmployees}</div>
            <p className="text-xs text-muted-foreground">Subordinate employees</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Team Attendance</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.todayAttendance}</div>
            <p className="text-xs text-muted-foreground">Checked in today</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending Approvals</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.pendingTimesheets}</div>
            <p className="text-xs text-muted-foreground">Awaiting your review</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Team Payroll</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${stats.monthlyPayroll.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">This month</p>
          </CardContent>
        </Card>
      </div>

      {/* Today's Team Attendance */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Today&apos;s Team Attendance</CardTitle>
            <Link href="/employees">
              <Button variant="outline" size="sm">
                View All
              </Button>
            </Link>
          </div>
        </CardHeader>
        <CardContent>
          {loadingAttendance ? (
            <div className="text-center py-4 text-gray-500">Loading...</div>
          ) : recentAttendance.length === 0 ? (
            <div className="text-center py-4 text-gray-500">
              No employees have checked in today yet.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Employee</TableHead>
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

      {/* Tasks Pending Approval */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-purple-600" />
            Tasks Pending Approval ({pendingTasks.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loadingTasks ? (
            <div className="text-center py-8 text-gray-500">Loading tasks...</div>
          ) : pendingTasks.length === 0 ? (
            <div className="text-center py-8 text-gray-500">No tasks pending approval</div>
          ) : (
            <div className="space-y-3">
              {pendingTasks.slice(0, 5).map((task) => (
                <div key={task.id} className="p-4 border rounded-lg">
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex-1">
                      <h4 className="font-semibold text-gray-900">{task.title}</h4>
                      {task.description && (
                        <p className="text-sm text-gray-600 mt-1">{task.description}</p>
                      )}
                    </div>
                    <span className={`px-2 py-1 text-xs rounded-full ${
                      task.priority === 'HIGH' ? 'bg-red-100 text-red-800' :
                      task.priority === 'MEDIUM' ? 'bg-yellow-100 text-yellow-800' :
                      'bg-green-100 text-green-800'
                    }`}>
                      {task.priority}
                    </span>
                  </div>
                  <div className="flex items-center justify-between mt-3">
                    <div className="text-xs text-gray-500">
                      <div>Assignees: {task.assignees.map((a: any) => a.user.name).join(', ')}</div>
                      <div>Due: {format(new Date(task.dueDate), 'MMM dd, yyyy')}</div>
                      {task.assignees.some((a: any) => a.completedAt) && (
                        <div className="text-yellow-600 mt-1">
                          Completed: {format(new Date(task.assignees.find((a: any) => a.completedAt)?.completedAt), 'MMM dd, yyyy HH:mm')}
                        </div>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleRejectTask(task.id)}
                      >
                        Reject
                      </Button>
                      <Button
                        size="sm"
                        className="bg-green-600 hover:bg-green-700"
                        onClick={() => handleApproveTask(task.id)}
                      >
                        Approve
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
              {pendingTasks.length > 5 && (
                <Link href="/tasks">
                  <Button variant="outline" className="w-full">
                    View All Pending Tasks ({pendingTasks.length})
                  </Button>
                </Link>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Team Management</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3">
            <Link href="/employees">
              <div className="p-4 border rounded-lg hover:bg-gray-50 cursor-pointer">
                <Users className="h-6 w-6 text-purple-600 mb-2" />
                <h3 className="font-semibold">View Team</h3>
                <p className="text-sm text-gray-600">See all subordinate employees</p>
              </div>
            </Link>
            <Link href="/timesheets">
              <div className="p-4 border rounded-lg hover:bg-gray-50 cursor-pointer">
                <FileText className="h-6 w-6 text-purple-600 mb-2" />
                <h3 className="font-semibold">Approve Timesheets</h3>
                <p className="text-sm text-gray-600">Review and approve submissions</p>
              </div>
            </Link>
            <Link href="/reports">
              <div className="p-4 border rounded-lg hover:bg-gray-50 cursor-pointer">
                <TrendingUp className="h-6 w-6 text-purple-600 mb-2" />
                <h3 className="font-semibold">Team Reports</h3>
                <p className="text-sm text-gray-600">View team performance reports</p>
              </div>
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}











