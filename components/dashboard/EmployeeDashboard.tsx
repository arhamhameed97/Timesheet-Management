'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Clock, FileText, DollarSign, CheckCircle, LogIn, LogOut, Calendar, CalendarDays } from 'lucide-react';
import { DesignationBadge } from '@/components/common/DesignationBadge';
import { RoleBadge } from '@/components/common/RoleBadge';
import { UserRole, AttendanceStatus, LeaveStatus } from '@prisma/client';
import { format, differenceInSeconds, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, isWeekend, isWithinInterval, parseISO, getDay } from 'date-fns';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from '@/hooks/use-toast';

interface EmployeeDashboardProps {
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

interface Attendance {
  id: string;
  date: string;
  checkInTime: string | null;
  checkOutTime: string | null;
  status: AttendanceStatus;
  notes: string | null;
}

interface Leave {
  id: string;
  startDate: string;
  endDate: string;
  type: string;
  reason: string | null;
  status: LeaveStatus;
}

export function EmployeeDashboard({ stats, user }: EmployeeDashboardProps) {
  const router = useRouter();
  const [attendance, setAttendance] = useState<Attendance[]>([]);
  const [leaves, setLeaves] = useState<Leave[]>([]);
  const [todayAttendance, setTodayAttendance] = useState<Attendance | null>(null);
  const [loading, setLoading] = useState(true);
  const [checkingIn, setCheckingIn] = useState(false);
  const [checkingOut, setCheckingOut] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [leaveDialogOpen, setLeaveDialogOpen] = useState(false);
  const [submittingLeave, setSubmittingLeave] = useState(false);

  // Leave form state
  const [leaveForm, setLeaveForm] = useState({
    startDate: '',
    endDate: '',
    type: '',
    reason: '',
  });

  // Update current time every second for live shift duration
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // Fetch attendance and leave data
  useEffect(() => {
    fetchAttendanceData();
    fetchLeaveData();
  }, []);

  const fetchAttendanceData = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      
      // Get current month date range
      const now = new Date();
      const startOfCurrentMonth = startOfMonth(now);
      const endOfCurrentMonth = endOfMonth(now);
      
      const startDateStr = format(startOfCurrentMonth, 'yyyy-MM-dd');
      const endDateStr = format(endOfCurrentMonth, 'yyyy-MM-dd');

      const [attendanceResponse, todayResponse] = await Promise.all([
        fetch(`/api/attendance?startDate=${startDateStr}&endDate=${endDateStr}`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }),
        fetch(`/api/attendance?startDate=${format(now, 'yyyy-MM-dd')}&endDate=${format(now, 'yyyy-MM-dd')}`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }),
      ]);

      if (attendanceResponse.ok) {
        const data = await attendanceResponse.json();
        setAttendance(data.attendance || []);
      }

      if (todayResponse.ok) {
        const data = await todayResponse.json();
        const todayAtt = (data.attendance || []).find((a: Attendance) => 
          isSameDay(parseISO(a.date), now)
        );
        setTodayAttendance(todayAtt || null);
      }
    } catch (error) {
      console.error('Failed to fetch attendance:', error);
      toast({
        title: 'Error',
        description: 'Failed to load attendance data',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchLeaveData = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/leaves', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setLeaves(data.leaves || []);
      }
    } catch (error) {
      console.error('Failed to fetch leaves:', error);
    }
  };

  const handleCheckIn = async () => {
    setCheckingIn(true);
    try {
      const token = localStorage.getItem('token');
      const now = new Date();
      const year = now.getUTCFullYear();
      const month = String(now.getUTCMonth() + 1).padStart(2, '0');
      const day = String(now.getUTCDate()).padStart(2, '0');
      const todayISO = `${year}-${month}-${day}`;

      const response = await fetch('/api/attendance/checkin', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ date: todayISO }),
      });

      if (response.ok) {
        toast({
          title: 'Success',
          description: 'Checked in successfully',
        });
        await fetchAttendanceData();
      } else {
        const data = await response.json();
        toast({
          title: 'Error',
          description: data.error || 'Failed to check in',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Failed to check in:', error);
      toast({
        title: 'Error',
        description: 'Failed to check in',
        variant: 'destructive',
      });
    } finally {
      setCheckingIn(false);
    }
  };

  const handleCheckOut = async () => {
    setCheckingOut(true);
    try {
      const token = localStorage.getItem('token');
      const now = new Date();
      const year = now.getUTCFullYear();
      const month = String(now.getUTCMonth() + 1).padStart(2, '0');
      const day = String(now.getUTCDate()).padStart(2, '0');
      const todayISO = `${year}-${month}-${day}`;

      const response = await fetch('/api/attendance/checkout', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ date: todayISO }),
      });

      if (response.ok) {
        toast({
          title: 'Success',
          description: 'Checked out successfully',
        });
        await fetchAttendanceData();
      } else {
        const data = await response.json();
        toast({
          title: 'Error',
          description: data.error || 'Failed to check out',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Failed to check out:', error);
      toast({
        title: 'Error',
        description: 'Failed to check out',
        variant: 'destructive',
      });
    } finally {
      setCheckingOut(false);
    }
  };

  const handleSubmitLeave = async () => {
    if (!leaveForm.startDate || !leaveForm.endDate || !leaveForm.type) {
      toast({
        title: 'Validation Error',
        description: 'Please fill in all required fields',
        variant: 'destructive',
      });
      return;
    }

    setSubmittingLeave(true);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/leaves', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(leaveForm),
      });

      if (response.ok) {
        toast({
          title: 'Success',
          description: 'Leave request submitted successfully',
        });
        setLeaveDialogOpen(false);
        setLeaveForm({
          startDate: '',
          endDate: '',
          type: '',
          reason: '',
        });
        await fetchLeaveData();
        await fetchAttendanceData();
      } else {
        const data = await response.json();
        toast({
          title: 'Error',
          description: data.error || 'Failed to submit leave request',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Failed to submit leave:', error);
      toast({
        title: 'Error',
        description: 'Failed to submit leave request',
        variant: 'destructive',
      });
    } finally {
      setSubmittingLeave(false);
    }
  };

  // Calculate current shift duration
  const getCurrentShiftDuration = () => {
    if (!todayAttendance?.checkInTime) return null;
    
    const checkIn = parseISO(todayAttendance.checkInTime);
    const checkOut = todayAttendance.checkOutTime ? parseISO(todayAttendance.checkOutTime) : currentTime;
    
    const totalSeconds = Math.abs(differenceInSeconds(checkOut, checkIn));
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    
    return { hours, minutes, seconds, isActive: !todayAttendance.checkOutTime };
  };

  const shiftDuration = getCurrentShiftDuration();

  // Format time helper
  const formatTime = (dateString: string | null) => {
    if (!dateString) return '-';
    return format(parseISO(dateString), 'HH:mm');
  };

  // Get attendance status for a date
  const getAttendanceForDate = (date: Date) => {
    return attendance.find(a => isSameDay(parseISO(a.date), date));
  };

  // Check if date is on leave
  const isOnLeave = (date: Date) => {
    return leaves.some(leave => {
      if (leave.status !== LeaveStatus.APPROVED) return false;
      const startDate = parseISO(leave.startDate);
      const endDate = parseISO(leave.endDate);
      return isWithinInterval(date, { start: startDate, end: endDate });
    });
  };

  // Generate calendar days for current month
  const calendarDays = useMemo(() => {
    const now = new Date();
    const start = startOfMonth(now);
    const end = endOfMonth(now);
    return eachDayOfInterval({ start, end });
  }, []);

  // Get status badge color
  const getStatusColor = (status: AttendanceStatus | null, isLeave: boolean, isWeekendDay: boolean) => {
    if (isWeekendDay) return 'bg-gray-100 text-gray-500';
    if (isLeave) return 'bg-blue-100 text-blue-800';
    if (!status) return 'bg-gray-50 text-gray-400';
    
    switch (status) {
      case AttendanceStatus.PRESENT:
        return 'bg-green-100 text-green-800';
      case AttendanceStatus.ABSENT:
        return 'bg-red-100 text-red-800';
      case AttendanceStatus.LATE:
        return 'bg-yellow-100 text-yellow-800';
      case AttendanceStatus.HALF_DAY:
        return 'bg-orange-100 text-orange-800';
      default:
        return 'bg-gray-100 text-gray-600';
    }
  };

  const getStatusLabel = (status: AttendanceStatus | null, isLeave: boolean, isWeekendDay: boolean) => {
    if (isWeekendDay) return 'Weekend';
    if (isLeave) return 'On Leave';
    if (!status) return 'No Record';
    
    switch (status) {
      case AttendanceStatus.PRESENT:
        return 'Present';
      case AttendanceStatus.ABSENT:
        return 'Absent';
      case AttendanceStatus.LATE:
        return 'Late';
      case AttendanceStatus.HALF_DAY:
        return 'Half Day';
      default:
        return 'Unknown';
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center gap-3 mb-2">
          <h1 className="text-3xl font-bold text-gray-900">My Dashboard</h1>
          <RoleBadge role={user.role} />
          {user.designation && <DesignationBadge designation={user.designation} />}
        </div>
        <p className="text-gray-600 mt-1">Welcome back, {user.name}! Here&apos;s your personal overview.</p>
      </div>

      {/* Check In/Out Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Attendance Control
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <div className="text-sm font-medium text-gray-700">Today&apos;s Status</div>
              <div className="text-2xl font-bold">
                {todayAttendance?.checkInTime ? (
                  <span className="text-green-600">Checked In</span>
                ) : (
                  <span className="text-gray-400">Not Checked In</span>
                )}
              </div>
              {todayAttendance?.checkInTime && (
                <div className="text-sm text-gray-600">
                  Check-in: {formatTime(todayAttendance.checkInTime)}
                </div>
              )}
              {todayAttendance?.checkOutTime && (
                <div className="text-sm text-gray-600">
                  Check-out: {formatTime(todayAttendance.checkOutTime)}
                </div>
              )}
            </div>
            
            <div className="space-y-2">
              <div className="text-sm font-medium text-gray-700">Current Shift Duration</div>
              {shiftDuration ? (
                <div className="text-2xl font-bold text-purple-600">
                  {shiftDuration.hours.toString().padStart(2, '0')}:
                  {shiftDuration.minutes.toString().padStart(2, '0')}:
                  {shiftDuration.seconds.toString().padStart(2, '0')}
                </div>
              ) : (
                <div className="text-lg text-gray-400">Not started</div>
              )}
              {shiftDuration?.isActive && (
                <div className="text-xs text-green-600 animate-pulse">● Active</div>
              )}
            </div>

            <div className="flex gap-2 items-end">
              {!todayAttendance?.checkInTime ? (
                <Button
                  onClick={handleCheckIn}
                  disabled={checkingIn}
                  className="flex-1"
                  size="lg"
                >
                  <LogIn className="h-4 w-4 mr-2" />
                  {checkingIn ? 'Checking In...' : 'Check In'}
                </Button>
              ) : !todayAttendance?.checkOutTime ? (
                <Button
                  onClick={handleCheckOut}
                  disabled={checkingOut}
                  variant="destructive"
                  className="flex-1"
                  size="lg"
                >
                  <LogOut className="h-4 w-4 mr-2" />
                  {checkingOut ? 'Checking Out...' : 'Check Out'}
                </Button>
              ) : (
                <div className="text-sm text-gray-600">Shift completed for today</div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">My Attendance</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.todayAttendance > 0 ? 'Present' : 'Not Checked In'}</div>
            <p className="text-xs text-muted-foreground">Today&apos;s status</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">My Timesheets</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.pendingTimesheets}</div>
            <p className="text-xs text-muted-foreground">Pending approval</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">My Payroll</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${stats.monthlyPayroll.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">This month</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Status</CardTitle>
            <CheckCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">Active</div>
            <p className="text-xs text-muted-foreground">Account status</p>
          </CardContent>
        </Card>
      </div>

      {/* Attendance History Calendar */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CalendarDays className="h-5 w-5" />
            Attendance History - {format(new Date(), 'MMMM yyyy')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Calendar Grid */}
              <div className="grid grid-cols-7 gap-2">
                {/* Day headers */}
                {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
                  <div key={day} className="text-center text-sm font-semibold text-gray-600 py-2">
                    {day}
                  </div>
                ))}
                
                {/* Calendar days */}
                {calendarDays.map((date) => {
                  const attendanceRecord = getAttendanceForDate(date);
                  const isWeekendDay = isWeekend(date);
                  const onLeave = isOnLeave(date);
                  const isToday = isSameDay(date, new Date());
                  
                  return (
                    <div
                      key={date.toISOString()}
                      className={`
                        p-2 rounded-lg border-2 min-h-[80px] flex flex-col
                        ${isToday ? 'border-purple-500 bg-purple-50' : 'border-gray-200'}
                        ${getStatusColor(attendanceRecord?.status || null, onLeave, isWeekendDay)}
                      `}
                    >
                      <div className="text-xs font-medium mb-1">
                        {format(date, 'd')}
                      </div>
                      <div className="text-xs mb-1">
                        {getStatusLabel(attendanceRecord?.status || null, onLeave, isWeekendDay)}
                      </div>
                      {attendanceRecord?.checkInTime && (
                        <div className="text-xs text-gray-600">
                          In: {formatTime(attendanceRecord.checkInTime)}
                        </div>
                      )}
                      {attendanceRecord?.checkOutTime && (
                        <div className="text-xs text-gray-600">
                          Out: {formatTime(attendanceRecord.checkOutTime)}
                        </div>
                      )}
                      {attendanceRecord?.checkInTime && attendanceRecord?.checkOutTime && (
                        <div className="text-xs font-semibold mt-1">
                          {(() => {
                            const checkIn = parseISO(attendanceRecord.checkInTime);
                            const checkOut = parseISO(attendanceRecord.checkOutTime);
                            const hours = Math.floor(differenceInSeconds(checkOut, checkIn) / 3600);
                            const minutes = Math.floor((differenceInSeconds(checkOut, checkIn) % 3600) / 60);
                            return `${hours}h ${minutes}m`;
                          })()}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Legend */}
              <div className="flex flex-wrap gap-4 pt-4 border-t">
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded bg-green-100 border border-green-300"></div>
                  <span className="text-sm">Present</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded bg-blue-100 border border-blue-300"></div>
                  <span className="text-sm">On Leave</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded bg-gray-100 border border-gray-300"></div>
                  <span className="text-sm">Weekend</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded bg-red-100 border border-red-300"></div>
                  <span className="text-sm">Absent</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded bg-yellow-100 border border-yellow-300"></div>
                  <span className="text-sm">Late</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded bg-orange-100 border border-orange-300"></div>
                  <span className="text-sm">Half Day</span>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Quick Actions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-4">
            <div 
              className="p-4 border rounded-lg hover:bg-gray-50 cursor-pointer"
              onClick={() => router.push('/attendance')}
            >
              <Clock className="h-6 w-6 text-purple-600 mb-2" />
              <h3 className="font-semibold">View Attendance</h3>
              <p className="text-sm text-gray-600">View detailed attendance</p>
            </div>
            <div 
              className="p-4 border rounded-lg hover:bg-gray-50 cursor-pointer"
              onClick={() => router.push('/timesheets')}
            >
              <FileText className="h-6 w-6 text-purple-600 mb-2" />
              <h3 className="font-semibold">Submit Timesheet</h3>
              <p className="text-sm text-gray-600">Log your work hours</p>
            </div>
            <Dialog open={leaveDialogOpen} onOpenChange={setLeaveDialogOpen}>
              <DialogTrigger asChild>
                <div className="p-4 border rounded-lg hover:bg-gray-50 cursor-pointer">
                  <Calendar className="h-6 w-6 text-purple-600 mb-2" />
                  <h3 className="font-semibold">Apply for Leave</h3>
                  <p className="text-sm text-gray-600">Request time off</p>
                </div>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Apply for Leave</DialogTitle>
                  <DialogDescription>
                    Submit a leave request. It will be reviewed by your manager.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="startDate">Start Date *</Label>
                    <Input
                      id="startDate"
                      type="date"
                      value={leaveForm.startDate}
                      onChange={(e) => setLeaveForm({ ...leaveForm, startDate: e.target.value })}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="endDate">End Date *</Label>
                    <Input
                      id="endDate"
                      type="date"
                      value={leaveForm.endDate}
                      onChange={(e) => setLeaveForm({ ...leaveForm, endDate: e.target.value })}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="type">Leave Type *</Label>
                    <Select
                      value={leaveForm.type}
                      onValueChange={(value) => setLeaveForm({ ...leaveForm, type: value })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select leave type" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Sick Leave">Sick Leave</SelectItem>
                        <SelectItem value="Vacation">Vacation</SelectItem>
                        <SelectItem value="Personal">Personal</SelectItem>
                        <SelectItem value="Emergency">Emergency</SelectItem>
                        <SelectItem value="Other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="reason">Reason (Optional)</Label>
                    <Textarea
                      id="reason"
                      value={leaveForm.reason}
                      onChange={(e) => setLeaveForm({ ...leaveForm, reason: e.target.value })}
                      placeholder="Provide a reason for your leave request..."
                      rows={3}
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button
                    variant="outline"
                    onClick={() => setLeaveDialogOpen(false)}
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={handleSubmitLeave}
                    disabled={submittingLeave}
                  >
                    {submittingLeave ? 'Submitting...' : 'Submit Request'}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
            <div 
              className="p-4 border rounded-lg hover:bg-gray-50 cursor-pointer transition-colors"
              onClick={() => router.push('/payroll')}
            >
              <DollarSign className="h-6 w-6 text-purple-600 mb-2" />
              <h3 className="font-semibold">View Payroll</h3>
              <p className="text-sm text-gray-600">Check your salary details</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

