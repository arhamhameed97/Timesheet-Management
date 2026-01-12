'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Clock, FileText, DollarSign, LogIn, LogOut, Calendar, CalendarDays, ChevronLeft, ChevronRight, Coffee, Search, User } from 'lucide-react';
import { UserRole, AttendanceStatus, LeaveStatus, TimesheetStatus } from '@prisma/client';
import { format, differenceInSeconds, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, isWeekend, isWithinInterval, parseISO, subDays, addDays, differenceInDays, startOfWeek, endOfWeek, getDay } from 'date-fns';
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
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
  leaveDuration?: string;
}

interface Timesheet {
  id: string;
  date: string;
  status: TimesheetStatus;
}

interface EmployeeOnLeave {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  type: string;
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
  const [pendingTimesheets, setPendingTimesheets] = useState<Timesheet[]>([]);
  const [employeesOnLeave, setEmployeesOnLeave] = useState<EmployeeOnLeave[]>([]);
  const [attendanceViewDate, setAttendanceViewDate] = useState(new Date());
  const [companyName, setCompanyName] = useState<string>('Your Company');
  const [tasks, setTasks] = useState<any[]>([]);
  const [loadingTasks, setLoadingTasks] = useState(false);
  const [breakTime, setBreakTime] = useState<{ hours: number; minutes: number; seconds: number } | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  // Leave form state
  const [leaveForm, setLeaveForm] = useState({
    startDate: '',
    endDate: '',
    type: '',
    reason: '',
    leaveDuration: 'FULL_DAY' as 'FULL_DAY' | 'HALF_DAY_MORNING' | 'HALF_DAY_AFTERNOON',
  });

  // Update current time every second for live shift duration
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // Fetch all data
  useEffect(() => {
    fetchCompanyName();
    fetchAttendanceData();
    fetchLeaveData();
    fetchPendingTimesheets();
    fetchEmployeesOnLeave();
    fetchTasks();
  }, []);

  const fetchTasks = async () => {
    try {
      setLoadingTasks(true);
      const token = localStorage.getItem('token');
      const response = await fetch('/api/tasks/assignments', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setTasks(data.tasks || []);
      }
    } catch (error) {
      console.error('Failed to fetch tasks:', error);
    } finally {
      setLoadingTasks(false);
    }
  };

  const handleTaskStatusUpdate = async (taskId: string, newStatus: string) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/tasks/assignments/${taskId}`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ status: newStatus }),
      });

      if (response.ok) {
        await fetchTasks();
        toast({
          title: 'Success',
          description: 'Task status updated successfully',
        });
      } else {
        const data = await response.json();
        toast({
          title: 'Error',
          description: data.error || 'Failed to update task status',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Failed to update task status:', error);
      toast({
        title: 'Error',
        description: 'Failed to update task status',
        variant: 'destructive',
      });
    }
  };

  const fetchCompanyName = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/auth/me', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        if (data.user?.company?.name) {
          setCompanyName(data.user.company.name);
        }
        if (data.user?.id) {
          setCurrentUserId(data.user.id);
        }
      }
    } catch (error) {
      console.error('Failed to fetch company name:', error);
    }
  };

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

      // Use UTC dates consistently to match API
      const nowUTC = new Date();
      const todayUTC = `${nowUTC.getUTCFullYear()}-${String(nowUTC.getUTCMonth() + 1).padStart(2, '0')}-${String(nowUTC.getUTCDate()).padStart(2, '0')}`;
      
      const [attendanceResponse, todayResponse] = await Promise.all([
        fetch(`/api/attendance?startDate=${startDateStr}&endDate=${endDateStr}`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }),
        fetch(`/api/attendance?startDate=${todayUTC}&endDate=${todayUTC}`, {
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
        // Find today's attendance - the API returns only today's records when using today's date range
        const todayAtt = data.attendance?.[0] || null;
        setTodayAttendance(todayAtt);
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
      const response = await fetch('/api/leaves?status=APPROVED', {
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

  const fetchPendingTimesheets = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/timesheets?status=SUBMITTED', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setPendingTimesheets(data.timesheets || []);
      }
    } catch (error) {
      console.error('Failed to fetch pending timesheets:', error);
    }
  };

  const fetchEmployeesOnLeave = async () => {
    try {
      const token = localStorage.getItem('token');
      const today = new Date();
      
      // Try to fetch all employees first, then get their leaves
      // For now, we'll show the user's own approved leaves that are active
      const response = await fetch('/api/leaves?status=APPROVED', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        // Filter leaves that include today
        const todayLeaves = (data.leaves || []).filter((leave: Leave & { user?: { id: string; name: string } }) => {
          const startDate = parseISO(leave.startDate);
          const endDate = parseISO(leave.endDate);
          return isWithinInterval(today, { start: startDate, end: endDate });
        });
        
        // Get unique employees on leave
        const employeesMap = new Map<string, EmployeeOnLeave>();
        todayLeaves.forEach((leave: Leave & { user?: { id: string; name: string } }) => {
          const userId = (leave as any).user?.id || 'unknown';
          const userName = (leave as any).user?.name || 'Unknown';
          if (!employeesMap.has(userId)) {
            employeesMap.set(userId, {
              id: userId,
              name: userName,
              startDate: leave.startDate,
              endDate: leave.endDate,
              type: leave.type,
            });
          }
        });
        setEmployeesOnLeave(Array.from(employeesMap.values()));
      }
    } catch (error) {
      console.error('Failed to fetch employees on leave:', error);
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
    if (!leaveForm.startDate || !leaveForm.type) {
      toast({
        title: 'Validation Error',
        description: 'Please fill in all required fields',
        variant: 'destructive',
      });
      return;
    }

    // For half-day, ensure endDate equals startDate
    const endDate = leaveForm.leaveDuration !== 'FULL_DAY' ? leaveForm.startDate : leaveForm.endDate;
    
    if (!endDate) {
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
        body: JSON.stringify({
          ...leaveForm,
          endDate,
        }),
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
          leaveDuration: 'FULL_DAY',
        });
        await fetchLeaveData();
        await fetchAttendanceData();
        await fetchEmployeesOnLeave();
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

  // Parse attendance details to calculate total shift time and break time from history
  const parseAttendanceDetails = useMemo(() => {
    if (!todayAttendance) return null;

    let firstCheckIn: Date | null = todayAttendance.checkInTime ? new Date(todayAttendance.checkInTime) : null;
    let checkInOutHistory: Array<{ type: 'in' | 'out'; time: string }> = [];
    let totalShiftTime = 0;
    let totalBreakTime = 0;

    // Try to parse notes as JSON
    try {
      if (todayAttendance.notes) {
        const notesData = JSON.parse(todayAttendance.notes);
        if (notesData.firstCheckIn) {
          firstCheckIn = new Date(notesData.firstCheckIn);
        }
        if (notesData.checkInOutHistory && Array.isArray(notesData.checkInOutHistory)) {
          checkInOutHistory = notesData.checkInOutHistory;
        }
      }
    } catch (e) {
      // If notes is not JSON, create history from checkInTime and checkOutTime
      if (todayAttendance.checkInTime) {
        checkInOutHistory.push({ type: 'in', time: todayAttendance.checkInTime });
      }
      if (todayAttendance.checkOutTime) {
        checkInOutHistory.push({ type: 'out', time: todayAttendance.checkOutTime });
      }
    }

    // Calculate total shift time and break time from history
    if (checkInOutHistory.length > 0) {
      // Sort history by time to ensure correct order
      const sortedHistory = [...checkInOutHistory].sort((a, b) => 
        new Date(a.time).getTime() - new Date(b.time).getTime()
      );
      
      let lastCheckIn: Date | null = null;
      
      // Calculate shift time (sum of all check-in to check-out periods)
      for (const event of sortedHistory) {
        const eventTime = new Date(event.time);
        
        if (event.type === 'in') {
          lastCheckIn = eventTime;
        } else if (event.type === 'out' && lastCheckIn) {
          // Add shift time from last check-in to this check-out
          const seconds = differenceInSeconds(eventTime, lastCheckIn);
          totalShiftTime += Math.abs(seconds);
          lastCheckIn = null;
        }
      }
      
      // If currently checked in (no checkout), add time from last check-in to now
      if (lastCheckIn && !todayAttendance.checkOutTime) {
        const seconds = differenceInSeconds(currentTime, lastCheckIn);
        totalShiftTime += Math.abs(seconds);
      }

      // Calculate break time (sum of all gaps between checkout and next check-in)
      for (let i = 0; i < sortedHistory.length - 1; i++) {
        const current = sortedHistory[i];
        const next = sortedHistory[i + 1];
        
        if (current.type === 'out' && next.type === 'in') {
          const checkoutTime = new Date(current.time);
          const checkinTime = new Date(next.time);
          const seconds = differenceInSeconds(checkinTime, checkoutTime);
          totalBreakTime += Math.abs(seconds);
        }
      }
    } else if (todayAttendance.checkInTime && todayAttendance.checkOutTime) {
      // Fallback: calculate from single check-in/check-out
      const seconds = differenceInSeconds(
        new Date(todayAttendance.checkOutTime),
        new Date(todayAttendance.checkInTime)
      );
      totalShiftTime = Math.abs(seconds);
    } else if (todayAttendance.checkInTime && !todayAttendance.checkOutTime) {
      // Currently checked in, calculate from check-in to now
      const seconds = differenceInSeconds(
        currentTime,
        new Date(todayAttendance.checkInTime)
      );
      totalShiftTime = Math.abs(seconds);
    }

    return {
      firstCheckIn,
      checkInOutHistory,
      totalShiftTime,
      totalBreakTime,
    };
  }, [todayAttendance, currentTime]);

  // Calculate current shift duration from parsed details
  const getCurrentShiftDuration = () => {
    if (!parseAttendanceDetails) return null;
    
    // Show duration if there's any shift time or if currently checked in
    if (parseAttendanceDetails.totalShiftTime === 0 && !todayAttendance?.checkInTime) {
      return null;
    }
    
    const totalSeconds = parseAttendanceDetails.totalShiftTime;
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    
    return { hours, minutes, seconds, isActive: !todayAttendance?.checkOutTime };
  };

  // Calculate break time from parsed details
  useEffect(() => {
    if (parseAttendanceDetails && parseAttendanceDetails.totalBreakTime > 0) {
      const totalSeconds = parseAttendanceDetails.totalBreakTime;
      const hours = Math.floor(totalSeconds / 3600);
      const minutes = Math.floor((totalSeconds % 3600) / 60);
      const secs = totalSeconds % 60;
      setBreakTime({ hours, minutes, seconds: secs });
    } else {
      setBreakTime(null);
    }
  }, [parseAttendanceDetails]);

  const shiftDuration = getCurrentShiftDuration();

  // Calculate weekly work time stats
  const weeklyStats = useMemo(() => {
    const now = new Date();
    const weekStart = startOfWeek(now, { weekStartsOn: 0 }); // Sunday
    const weekEnd = endOfWeek(now, { weekStartsOn: 0 }); // Saturday
    
    const weekDays = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
    const dailyHours: { day: string; hours: number; minutes: number; date: Date }[] = [];
    
    // Initialize all days with 0 hours
    for (let i = 0; i < 7; i++) {
      const dayDate = new Date(weekStart);
      dayDate.setDate(weekStart.getDate() + i);
      dailyHours.push({
        day: weekDays[i],
        hours: 0,
        minutes: 0,
        date: dayDate,
      });
    }
    
    // Calculate hours for each day from attendance records
    attendance.forEach((record) => {
      const recordDate = parseISO(record.date);
      const dayIndex = getDay(recordDate); // 0 = Sunday, 6 = Saturday
      
      if (isWithinInterval(recordDate, { start: weekStart, end: weekEnd })) {
        let dayTotalSeconds = 0;
        
        // Parse notes for check-in/out history
        try {
          if (record.notes) {
            const notesData = JSON.parse(record.notes);
            if (notesData.checkInOutHistory && Array.isArray(notesData.checkInOutHistory)) {
              const sortedHistory = [...notesData.checkInOutHistory].sort((a: any, b: any) => 
                new Date(a.time).getTime() - new Date(b.time).getTime()
              );
              
              let lastCheckIn: Date | null = null;
              for (const event of sortedHistory) {
                if (event.type === 'in') {
                  lastCheckIn = new Date(event.time);
                } else if (event.type === 'out' && lastCheckIn) {
                  const seconds = differenceInSeconds(new Date(event.time), lastCheckIn);
                  dayTotalSeconds += Math.abs(seconds);
                  lastCheckIn = null;
                }
              }
              
              // If still checked in, add time to now
              if (lastCheckIn && !record.checkOutTime) {
                const seconds = differenceInSeconds(now, lastCheckIn);
                dayTotalSeconds += Math.abs(seconds);
              }
            }
          }
        } catch (e) {
          // Fallback to simple check-in/out calculation
          if (record.checkInTime && record.checkOutTime) {
            dayTotalSeconds = differenceInSeconds(
              new Date(record.checkOutTime),
              new Date(record.checkInTime)
            );
          } else if (record.checkInTime) {
            dayTotalSeconds = differenceInSeconds(now, new Date(record.checkInTime));
          }
        }
        
        if (dayTotalSeconds > 0) {
          dailyHours[dayIndex].hours = Math.floor(dayTotalSeconds / 3600);
          dailyHours[dayIndex].minutes = Math.floor((dayTotalSeconds % 3600) / 60);
        }
      }
    });
    
    // Calculate total weekly hours
    const totalSeconds = dailyHours.reduce((sum, day) => {
      return sum + (day.hours * 3600) + (day.minutes * 60);
    }, 0);
    
    const totalHours = Math.floor(totalSeconds / 3600);
    const totalMinutes = Math.floor((totalSeconds % 3600) / 60);
    const totalHoursDecimal = totalHours + (totalMinutes / 60);
    
    // Find max hours for bar chart scaling
    const maxHours = Math.max(...dailyHours.map(d => d.hours + d.minutes / 60), 1);
    
    return {
      dailyHours,
      totalHours,
      totalMinutes,
      totalHoursDecimal: totalHoursDecimal.toFixed(1),
      maxHours,
    };
  }, [attendance, currentTime]);

  // Calculate annual leave days
  const calculateAnnualLeave = () => {
    const currentYear = new Date().getFullYear();
    const yearStart = new Date(currentYear, 0, 1);
    const yearEnd = new Date(currentYear, 11, 31);
    
    const approvedLeaves = leaves.filter(leave => {
      if (leave.status !== LeaveStatus.APPROVED) return false;
      const startDate = parseISO(leave.startDate);
      return startDate >= yearStart && startDate <= yearEnd;
    });

    let totalDays = 0;
    approvedLeaves.forEach(leave => {
      const startDate = parseISO(leave.startDate);
      const endDate = parseISO(leave.endDate);
      const days = differenceInDays(endDate, startDate) + 1;
      totalDays += days;
    });

    // Default annual leave: 20.5 days (can be made configurable)
    const totalAnnualLeave = 20.5;
    return {
      taken: totalDays,
      total: totalAnnualLeave,
      remaining: totalAnnualLeave - totalDays,
    };
  };

  const annualLeave = calculateAnnualLeave();

  // Format time helper
  const formatTime = (dateString: string | null) => {
    if (!dateString) return '--';
    return format(parseISO(dateString), 'HH:mm');
  };

  const formatDate = (dateString: string) => {
    return format(parseISO(dateString), 'MMM dd, yyyy');
  };

  // Get attendance records for the view date range (last 7 days)
  const getAttendanceHistory = () => {
    const endDate = attendanceViewDate;
    const startDate = subDays(endDate, 6);
    const days = eachDayOfInterval({ start: startDate, end: endDate });

    return days.map(date => {
      const attendanceRecord = attendance.find(a => isSameDay(parseISO(a.date), date));
      const isWeekendDay = isWeekend(date);
      const dayLeave = leaves.find(leave => {
        if (leave.status !== LeaveStatus.APPROVED) return false;
        const leaveStartDate = parseISO(leave.startDate);
        const leaveEndDate = parseISO(leave.endDate);
        return isWithinInterval(date, { start: leaveStartDate, end: leaveEndDate });
      });

      let status = '--';
      let leaveDuration = null;
      if (isWeekendDay) {
        status = 'Weekend';
      } else if (dayLeave) {
        status = 'Leave';
        leaveDuration = dayLeave.leaveDuration === 'HALF_DAY_MORNING' ? 'Half Day (Morning)' :
                       dayLeave.leaveDuration === 'HALF_DAY_AFTERNOON' ? 'Half Day (Afternoon)' :
                       'Full Day';
      } else if (attendanceRecord) {
        if (attendanceRecord.status === AttendanceStatus.PRESENT) {
          status = 'On Time';
        } else if (attendanceRecord.status === AttendanceStatus.LATE) {
          status = 'Late';
        } else if (attendanceRecord.status === AttendanceStatus.ABSENT) {
          status = 'Absent';
        } else if (attendanceRecord.status === AttendanceStatus.HALF_DAY) {
          status = 'Half Day';
        }
      }

      return {
        date,
        checkInTime: attendanceRecord?.checkInTime || null,
        checkOutTime: attendanceRecord?.checkOutTime || null,
        status,
        isWeekend: isWeekendDay,
        isLeave: !!dayLeave,
        leaveDuration,
        leaveType: dayLeave?.type || null,
      };
    }).reverse();
  };

  const attendanceHistory = getAttendanceHistory();

  const getStatusBadgeClass = (status: string) => {
    if (status === 'On Time') return 'bg-green-500/20 text-green-700 dark:bg-green-500/30 dark:text-green-400';
    if (status === 'Leave') return 'bg-red-500/20 text-red-700 dark:bg-red-500/30 dark:text-red-400';
    if (status === 'Weekend') return 'bg-muted text-muted-foreground';
    if (status === 'Late') return 'bg-yellow-500/20 text-yellow-700 dark:bg-yellow-500/30 dark:text-yellow-400';
    if (status === 'Absent') return 'bg-red-500/20 text-red-700 dark:bg-red-500/30 dark:text-red-400';
    return 'bg-muted text-muted-foreground';
  };

  return (
    <div className="space-y-6">
      {/* Welcome Header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground">Welcome To {companyName}</h1>
        <p className="text-muted-foreground mt-1">Welcome back, {user.name}!</p>
      </div>

      {/* Two Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column - 2/3 width */}
        <div className="lg:col-span-2 space-y-6">
          {/* Clock In/Out Card */}
          <Card>
            <CardContent className="p-6">
              <div className="flex items-stretch gap-6">
                {/* Left Section - Clock In/Out Controls */}
                <div className="flex-1 flex flex-col justify-between">
                  <div>
                    <h2 className="text-xl font-bold text-foreground mb-8">CLOCK IN / Clock Out</h2>
                    
                    {/* Status Indicators */}
                    <div className="space-y-5 mb-8">
                      {/* Clock In Status */}
                      <div className="flex items-center gap-3">
                        <div className={`w-3 h-3 rounded-full ${todayAttendance?.checkInTime ? 'bg-green-500 shadow-lg shadow-green-500/50' : 'bg-muted'}`}></div>
                        <div>
                          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">CLOCK IN</span>
                          {todayAttendance?.checkInTime ? (
                            <div className="text-green-600 dark:text-green-400 font-semibold text-base mt-0.5">
                              {format(parseISO(todayAttendance.checkInTime), 'dd-MMM h:mm a')}
                            </div>
                          ) : (
                            <div className="text-muted-foreground text-base mt-0.5">-- --</div>
                          )}
                        </div>
                      </div>

                      {/* Clock Out Status */}
                      <div className="flex items-center gap-3">
                        <div className={`w-3 h-3 rounded-full ${(todayAttendance?.checkOutTime || (parseAttendanceDetails?.checkInOutHistory && parseAttendanceDetails.checkInOutHistory.some(e => e.type === 'out'))) ? 'bg-red-500 shadow-lg shadow-red-500/50' : 'bg-muted'}`}></div>
                        <div>
                          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Clock Out</span>
                          {(() => {
                            // Show current checkout time if available
                            if (todayAttendance?.checkOutTime) {
                              return (
                                <div className="text-red-600 dark:text-red-400 font-semibold text-base mt-0.5">
                                  {format(parseISO(todayAttendance.checkOutTime), 'HH:mm')}
                                </div>
                              );
                            }
                            // Otherwise, show last checkout from history if user has checked back in
                            if (parseAttendanceDetails?.checkInOutHistory) {
                              const lastCheckout = parseAttendanceDetails.checkInOutHistory
                                .filter(e => e.type === 'out')
                                .sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime())[0];
                              if (lastCheckout) {
                                return (
                                  <div className="text-red-600 dark:text-red-400 font-semibold text-base mt-0.5">
                                    {format(parseISO(lastCheckout.time), 'HH:mm')}
                                  </div>
                                );
                              }
                            }
                            return <div className="text-muted-foreground text-base mt-0.5">00:00:00</div>;
                          })()}
                        </div>
                      </div>
                    </div>

                    {/* Shift Duration */}
                    {shiftDuration && (
                      <div className="mb-6">
                        <div className="text-5xl font-bold text-foreground mb-1">
                          {shiftDuration.hours.toString().padStart(2, '0')}:
                          {shiftDuration.minutes.toString().padStart(2, '0')} hrs
                        </div>
                        <div className="text-sm font-medium text-muted-foreground">Today&apos;s Hours</div>
                      </div>
                    )}

                    {/* Break Time Display */}
                    {breakTime && breakTime.hours + breakTime.minutes + breakTime.seconds > 0 && (
                      <div className="mb-6">
                        <div className="text-2xl font-bold text-orange-600 dark:text-orange-400 mb-1">
                          {breakTime.hours.toString().padStart(2, '0')}:
                          {breakTime.minutes.toString().padStart(2, '0')}:
                          {breakTime.seconds.toString().padStart(2, '0')}
                        </div>
                        <div className="text-sm font-medium text-muted-foreground">Break Time</div>
                      </div>
                    )}
                  </div>

                  {/* Action Buttons */}
                  <div className="flex gap-3 mt-auto">
                    {!todayAttendance?.checkInTime ? (
                      <Button
                        onClick={handleCheckIn}
                        disabled={checkingIn}
                        className="bg-green-600 hover:bg-green-700 text-white shadow-lg hover:shadow-xl transition-all"
                        size="lg"
                      >
                        <LogIn className="h-4 w-4 mr-2" />
                        {checkingIn ? 'Checking In...' : 'Clock In'}
                      </Button>
                    ) : todayAttendance?.checkInTime && !todayAttendance?.checkOutTime ? (
                      <>
                        <Button
                          onClick={handleCheckOut}
                          disabled={checkingOut}
                          className="bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 text-white shadow-lg hover:shadow-xl transition-all"
                          size="lg"
                        >
                          <LogOut className="h-4 w-4 mr-2" />
                          {checkingOut ? 'Checking Out...' : 'Clock Out'}
                        </Button>
                        <Button
                          variant="outline"
                          size="lg"
                          className="border-border hover:bg-muted/50 shadow-sm hover:shadow-md transition-all"
                        >
                          <Coffee className="h-4 w-4 mr-2" />
                          Break In
                        </Button>
                      </>
                    ) : (
                      <Button
                        onClick={handleCheckIn}
                        disabled={checkingIn}
                        className="bg-green-600 hover:bg-green-700 text-white shadow-lg hover:shadow-xl transition-all"
                        size="lg"
                      >
                        <LogIn className="h-4 w-4 mr-2" />
                        {checkingIn ? 'Checking In...' : 'Clock In Again'}
                      </Button>
                    )}
                  </div>
                </div>
                
                {/* Right Section - Stats Visuals */}
                <div className="hidden md:flex flex-row gap-3 w-96 self-stretch">
                  {/* Progress Card */}
                  <div className="bg-card rounded-xl border border-border p-5 shadow-md transition-shadow duration-200 hover:shadow-lg flex-1 flex flex-col h-full">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-sm font-bold text-foreground">Progress</h3>
                    </div>
                    <div className="mb-4">
                      <div className="text-3xl font-bold text-foreground mb-1">{weeklyStats.totalHoursDecimal} h</div>
                      <div className="text-xs font-medium text-muted-foreground">Work Time this week</div>
                    </div>
                    {/* Weekly Bar Chart */}
                    <div className="flex items-end justify-between gap-1 flex-1 min-h-[120px]">
                      {weeklyStats.dailyHours.map((day, index) => {
                        const dayHours = day.hours + day.minutes / 60;
                        const heightPercent = weeklyStats.maxHours > 0 
                          ? (dayHours / weeklyStats.maxHours) * 100 
                          : 0;
                        const isToday = isSameDay(day.date, new Date());
                        const hasData = day.hours > 0 || day.minutes > 0;
                        // Calculate actual height in pixels based on work time (min 15px for visibility, max 100% of available space)
                        const maxBarHeight = 120; // Maximum height in pixels
                        const barHeight = hasData 
                          ? Math.max((heightPercent / 100) * maxBarHeight, 15) 
                          : 15;
                        
                        return (
                          <div key={index} className="flex flex-col items-center flex-1 h-full justify-end">
                            {hasData && (
                              <div className="text-xs font-semibold text-foreground mb-1.5">
                                {day.hours > 0 ? `${day.hours}h` : day.minutes > 0 ? `${day.minutes}m` : ''}
                              </div>
                            )}
                            <div
                              className={`w-full rounded-t transition-all duration-300 ${
                                isToday && hasData
                                  ? 'bg-yellow-500 shadow-md'
                                  : hasData
                                  ? 'bg-foreground'
                                  : 'bg-muted border-2 border-dashed border-border'
                              }`}
                              style={{ height: `${barHeight}px` }}
                            />
                            <div className={`mt-2 w-1.5 h-1.5 rounded-full ${
                              hasData ? 'bg-foreground' : 'bg-muted'
                            }`} />
                            <div className="text-[10px] font-medium text-muted-foreground mt-1.5">{day.day}</div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                  
                  {/* Time Tracker Card */}
                  <div className="bg-card rounded-xl border border-border p-5 shadow-md transition-shadow duration-200 hover:shadow-lg flex-1 flex flex-col h-full items-center justify-center">
                    <div className="flex items-center justify-between mb-4 w-full">
                      <h3 className="text-sm font-bold text-foreground">Time tracker</h3>
                    </div>
                    {/* Circular Timer */}
                    <div className="relative w-32 h-32 mx-auto flex-shrink-0">
                      {/* Outer ring */}
                      <svg className="w-32 h-32 transform -rotate-90" viewBox="0 0 100 100">
                        {/* Background circle */}
                        <circle
                          cx="50"
                          cy="50"
                          r="45"
                          fill="none"
                          stroke="#e5e7eb"
                          strokeWidth="2"
                          strokeDasharray="2 2"
                        />
                        {/* Progress circle */}
                        {shiftDuration && (
                          <circle
                            cx="50"
                            cy="50"
                            r="45"
                            fill="none"
                            stroke="#fbbf24"
                            strokeWidth="3"
                            strokeDasharray={`${(shiftDuration.hours * 60 + shiftDuration.minutes) / 480 * 283} 283`}
                            strokeLinecap="round"
                            className="transition-all duration-1000"
                          />
                        )}
                      </svg>
                      {/* Center time display */}
                      <div className="absolute inset-0 flex flex-col items-center justify-center">
                        {shiftDuration ? (
                          <>
                            <div className="text-2xl font-bold text-foreground">
                              {shiftDuration.hours.toString().padStart(2, '0')}:
                              {shiftDuration.minutes.toString().padStart(2, '0')}
                            </div>
                            <div className="text-xs font-medium text-muted-foreground mt-1">Work Time</div>
                          </>
                        ) : (
                          <>
                            <div className="text-2xl font-bold text-muted-foreground">00:00</div>
                            <div className="text-xs font-medium text-muted-foreground mt-1">Work Time</div>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Time Off Card */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5 text-primary" />
                Time Off
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm text-muted-foreground mb-1">Annual Leave</div>
                  <div className="text-2xl font-bold text-foreground">
                    {annualLeave.taken} / {annualLeave.total} Days
                  </div>
                </div>
                <Dialog open={leaveDialogOpen} onOpenChange={setLeaveDialogOpen}>
                  <DialogTrigger asChild>
                    <Button variant="outline" size="sm">
                      Apply
                    </Button>
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
                        <Label htmlFor="leaveDuration">Leave Duration *</Label>
                        <Select
                          value={leaveForm.leaveDuration}
                          onValueChange={(value) => {
                            const duration = value as 'FULL_DAY' | 'HALF_DAY_MORNING' | 'HALF_DAY_AFTERNOON';
                            setLeaveForm({ 
                              ...leaveForm, 
                              leaveDuration: duration,
                              endDate: duration !== 'FULL_DAY' ? leaveForm.startDate : leaveForm.endDate,
                            });
                          }}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="FULL_DAY">Full Day</SelectItem>
                            <SelectItem value="HALF_DAY_MORNING">Half Day (Morning)</SelectItem>
                            <SelectItem value="HALF_DAY_AFTERNOON">Half Day (Afternoon)</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="endDate">End Date *</Label>
                        <Input
                          id="endDate"
                          type="date"
                          value={leaveForm.endDate}
                          onChange={(e) => setLeaveForm({ ...leaveForm, endDate: e.target.value })}
                          required
                          disabled={leaveForm.leaveDuration !== 'FULL_DAY'}
                        />
                        {leaveForm.leaveDuration !== 'FULL_DAY' && (
                          <p className="text-xs text-muted-foreground">End date is automatically set to start date for half-day leaves</p>
                        )}
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
              </div>
            </CardContent>
          </Card>

          {/* My Attendance Card */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <CalendarDays className="h-5 w-5 text-primary" />
                  My Attendance
                </CardTitle>
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setAttendanceViewDate(subDays(attendanceViewDate, 7))}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setAttendanceViewDate(addDays(attendanceViewDate, 7))}
                    disabled={isSameDay(attendanceViewDate, new Date())}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Time In</TableHead>
                    <TableHead>Time Out</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {attendanceHistory.map((record, index) => (
                    <TableRow key={index}>
                      <TableCell className="font-medium">
                        {format(record.date, 'MMM dd, yyyy')}
                      </TableCell>
                      <TableCell>
                        {record.checkInTime ? (
                          <span className="text-green-600 dark:text-green-400">→ {formatTime(record.checkInTime)}</span>
                        ) : (
                          '--'
                        )}
                      </TableCell>
                      <TableCell>
                        {record.checkOutTime ? (
                          <span className="text-red-600 dark:text-red-400">← {formatTime(record.checkOutTime)}</span>
                        ) : (
                          '--'
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-1">
                          <span className={`px-2 py-1 rounded text-xs font-medium ${getStatusBadgeClass(record.status)}`}>
                            {record.status}
                          </span>
                          {record.isLeave && record.leaveDuration && (
                            <span className="text-xs text-blue-600 dark:text-blue-400">
                              {record.leaveDuration}
                            </span>
                          )}
                          {record.isLeave && record.leaveType && (
                            <span className="text-xs text-muted-foreground">
                              {record.leaveType}
                            </span>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>

        {/* Right Column - 1/3 width */}
        <div className="space-y-6">
          {/* My Tasks Card */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5 text-primary" />
                  My Tasks
                </CardTitle>
                <Select defaultValue="all" onValueChange={(value) => {
                  // Filter tasks by status if needed
                  // For now, show all tasks
                }}>
                  <SelectTrigger className="w-32 h-8">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Tasks</SelectItem>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="in_progress">In Progress</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                    <SelectItem value="approved">Approved</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardHeader>
            <CardContent>
              {loadingTasks ? (
                <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                  <Search className="h-12 w-12 mb-4 opacity-50" />
                  <p className="text-sm">Loading tasks...</p>
                </div>
              ) : tasks.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                  <Search className="h-12 w-12 mb-4 opacity-50" />
                  <p className="text-sm">No Tasks Available</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {tasks.map((task) => {
                    const getStatusColor = (status: string) => {
                      switch (status) {
                        case 'PENDING': return 'bg-muted text-foreground';
                        case 'IN_PROGRESS': return 'bg-blue-500/20 text-blue-700 dark:bg-blue-500/30 dark:text-blue-400';
                        case 'COMPLETED': return 'bg-yellow-500/20 text-yellow-700 dark:bg-yellow-500/30 dark:text-yellow-400';
                        case 'APPROVED': return 'bg-green-500/20 text-green-700 dark:bg-green-500/30 dark:text-green-400';
                        case 'CANCELLED': return 'bg-red-500/20 text-red-700 dark:bg-red-500/30 dark:text-red-400';
                        default: return 'bg-muted text-foreground';
                      }
                    };

                    const getPriorityColor = (priority: string) => {
                      switch (priority) {
                        case 'HIGH': return 'bg-red-500/20 text-red-700 dark:bg-red-500/30 dark:text-red-400';
                        case 'MEDIUM': return 'bg-yellow-500/20 text-yellow-700 dark:bg-yellow-500/30 dark:text-yellow-400';
                        case 'LOW': return 'bg-green-500/20 text-green-700 dark:bg-green-500/30 dark:text-green-400';
                        default: return 'bg-muted text-foreground';
                      }
                    };

                    return (
                      <div key={task.id} className="p-4 border rounded-lg hover:bg-muted/50">
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex-1">
                            <h4 className="font-semibold text-foreground">{task.title}</h4>
                            {task.description && (
                              <p className="text-sm text-muted-foreground mt-1">{task.description}</p>
                            )}
                          </div>
                          <div className="flex gap-2 ml-4">
                            <span className={`px-2 py-1 text-xs rounded-full ${getPriorityColor(task.priority)}`}>
                              {task.priority}
                            </span>
                            <span className={`px-2 py-1 text-xs rounded-full ${getStatusColor(task.status)}`}>
                              {task.status.replace('_', ' ')}
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center justify-between mt-3">
                          <div className="text-xs text-muted-foreground">
                            Due: {format(new Date(task.dueDate), 'MMM dd, yyyy')}
                            {task.approvedBy && (
                              <span className="ml-2 text-green-600 dark:text-green-400">
                                Approved by {task.approver?.name}
                              </span>
                            )}
                          </div>
                          <div className="flex gap-2">
                            {task.status === 'PENDING' && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleTaskStatusUpdate(task.id, 'IN_PROGRESS')}
                              >
                                Start Task
                              </Button>
                            )}
                            {task.status !== 'PENDING' && task.status !== 'APPROVED' && (() => {
                              // Find current employee's assignee record
                              const currentUserAssignee = task.assignees?.find((a: any) => 
                                a.userId === currentUserId || a.user?.id === currentUserId
                              );
                              const hasCompleted = currentUserAssignee?.completedAt !== null && currentUserAssignee?.completedAt !== undefined;
                              
                              if (!hasCompleted) {
                                // Employee hasn't completed yet - show Mark Complete button
                                return (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => handleTaskStatusUpdate(task.id, 'COMPLETED')}
                                  >
                                    Mark Complete
                                  </Button>
                                );
                              } else {
                                // Employee has completed - show Mark Incomplete button
                                return (
                                  <>
                                    {task.status === 'COMPLETED' && (
                                      <span className="text-xs text-yellow-600 self-center">Awaiting Approval</span>
                                    )}
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={() => handleTaskStatusUpdate(task.id, 'IN_PROGRESS')}
                                    >
                                      Mark Incomplete
                                    </Button>
                                  </>
                                );
                              }
                            })()}
                            {task.status === 'APPROVED' && (
                              <span className="text-xs text-green-600 dark:text-green-400 self-center">
                                Approved {task.approvedAt && format(new Date(task.approvedAt), 'MMM dd')}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                  {tasks.length > 5 && (
                    <Button
                      variant="outline"
                      className="w-full"
                      onClick={() => router.push('/tasks')}
                    >
                      View All Tasks ({tasks.length})
                    </Button>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Who is OFF Card */}
          <Card>
            <CardHeader>
              <CardTitle>Who is OFF</CardTitle>
              <p className="text-sm text-muted-foreground mt-1">Employee ({employeesOnLeave.length})</p>
            </CardHeader>
            <CardContent>
              {employeesOnLeave.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                  <User className="h-12 w-12 mb-4 opacity-50" />
                  <p className="text-sm">No Employee Leave Data</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {employeesOnLeave.map((employee) => (
                    <div key={employee.id} className="flex items-center justify-between p-3 border rounded-lg">
                      <div>
                        <div className="font-medium text-sm">{employee.name}</div>
                        <div className="text-xs text-muted-foreground">
                          {format(parseISO(employee.startDate), 'MMM dd')} - {format(parseISO(employee.endDate), 'MMM dd')}
                        </div>
                      </div>
                      <span className="text-xs px-2 py-1 bg-blue-500/20 text-blue-700 dark:bg-blue-500/30 dark:text-blue-400 rounded">
                        {employee.type}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
