'use client';

import { useState, useEffect, useMemo } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { 
  LogIn, 
  LogOut, 
  Calendar, 
  Clock, 
  TrendingUp, 
  CalendarDays,
  Download,
  Filter,
  Search,
  Award,
  Activity,
  ChevronLeft,
  ChevronRight,
  Users
} from 'lucide-react';
import { format, differenceInSeconds, startOfWeek, endOfWeek, eachDayOfInterval, isSameDay, startOfMonth, endOfMonth, subDays, addDays, getDaysInMonth, getDay, subMonths, addMonths } from 'date-fns';

interface Attendance {
  id: string;
  date: string;
  checkInTime: string | null;
  checkOutTime: string | null;
  status: string;
  notes: string | null;
  user: {
    name: string;
  };
}

interface CheckInOutEvent {
  type: 'in' | 'out';
  time: string;
}

interface AttendanceDetails {
  firstCheckIn: Date | null;
  checkInOutHistory: CheckInOutEvent[];
  totalShiftTime: number; // in seconds
  totalBreakTime: number; // in seconds
  currentStatus: 'checked-in' | 'checked-out' | 'not-started';
}

interface AttendanceStats {
  totalHoursThisMonth: number;
  daysWorkedThisMonth: number;
  currentStreak: number;
  averageHoursPerDay: number;
}

interface Employee {
  id: string;
  name: string;
  email: string;
  role: string;
}

interface UserInfo {
  id: string;
  name: string;
  email: string;
  role: string;
  companyId: string | null;
}

export default function AttendancePage() {
  const [attendance, setAttendance] = useState<Attendance[]>([]);
  const [loading, setLoading] = useState(true);
  const [todayAttendance, setTodayAttendance] = useState<Attendance | null>(null);
  const [checkingIn, setCheckingIn] = useState(false);
  const [checkingOut, setCheckingOut] = useState(false);
  const [elapsedTime, setElapsedTime] = useState<string>('00:00:00');
  const [breakTime, setBreakTime] = useState<string>('00:00:00');
  const [totalShiftTime, setTotalShiftTime] = useState<string>('00:00:00');
  const [justCheckedIn, setJustCheckedIn] = useState(false);
  const [stats, setStats] = useState<AttendanceStats>({
    totalHoursThisMonth: 0,
    daysWorkedThisMonth: 0,
    currentStreak: 0,
    averageHoursPerDay: 0,
  });
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string | null>(null);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [userInfo, setUserInfo] = useState<UserInfo | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [showDateDetails, setShowDateDetails] = useState(false);
  const [calendarView, setCalendarView] = useState<'week' | 'month' | 'year'>('month');

  useEffect(() => {
    let mounted = true;
    
    const loadData = async () => {
      try {
        await Promise.all([
          fetchUserInfo(),
          fetchTodayAttendance(),
          fetchAttendance()
        ]);
      } catch (error) {
        console.error('Error loading attendance data:', error);
        if (mounted) {
          setLoading(false);
        }
      }
    };
    
    loadData();
    
    return () => {
      mounted = false;
    };
  }, []);

  // Fetch employees when user info is loaded (for managers/admins)
  useEffect(() => {
    if (userInfo && (userInfo.role === 'MANAGER' || userInfo.role === 'COMPANY_ADMIN' || userInfo.role === 'SUPER_ADMIN' || userInfo.role === 'TEAM_LEAD')) {
      fetchEmployees();
    }
  }, [userInfo]);

  // Fetch attendance when selected employee, month, or view changes
  useEffect(() => {
    if (userInfo) {
      fetchAttendance();
      fetchTodayAttendance();
    }
  }, [selectedEmployeeId, currentMonth, calendarView]);

  // Calculate stats when attendance changes
  useEffect(() => {
    calculateStats();
  }, [attendance]);

  // Parse attendance details from notes
  const parseAttendanceDetails = (attendance: Attendance | null): AttendanceDetails | null => {
    if (!attendance) return null;

    let firstCheckIn: Date | null = attendance.checkInTime ? new Date(attendance.checkInTime) : null;
    let checkInOutHistory: CheckInOutEvent[] = [];
    let totalShiftTime = 0;
    let totalBreakTime = 0;

    // Try to parse notes as JSON
    try {
      if (attendance.notes) {
        const notesData = JSON.parse(attendance.notes);
        if (notesData.firstCheckIn) {
          firstCheckIn = new Date(notesData.firstCheckIn);
        }
        if (notesData.checkInOutHistory && Array.isArray(notesData.checkInOutHistory)) {
          checkInOutHistory = notesData.checkInOutHistory;
        }
      }
    } catch (e) {
      // If notes is not JSON, create history from checkInTime and checkOutTime
      if (attendance.checkInTime) {
        checkInOutHistory.push({ type: 'in', time: attendance.checkInTime });
      }
      if (attendance.checkOutTime) {
        checkInOutHistory.push({ type: 'out', time: attendance.checkOutTime });
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
          totalShiftTime += differenceInSeconds(eventTime, lastCheckIn);
          lastCheckIn = null;
        }
      }
      
      // Note: We don't add current time here to avoid recalculating on every render
      // The timer effect will add the current time dynamically

      // Calculate break time (sum of all gaps between checkout and next check-in)
      for (let i = 0; i < sortedHistory.length - 1; i++) {
        const current = sortedHistory[i];
        const next = sortedHistory[i + 1];
        
        if (current.type === 'out' && next.type === 'in') {
          const checkoutTime = new Date(current.time);
          const checkinTime = new Date(next.time);
          totalBreakTime += differenceInSeconds(checkinTime, checkoutTime);
        }
      }
    } else if (attendance.checkInTime && attendance.checkOutTime) {
      // Fallback: calculate from single check-in/check-out
      totalShiftTime = differenceInSeconds(
        new Date(attendance.checkOutTime),
        new Date(attendance.checkInTime)
      );
    }

    return {
      firstCheckIn,
      checkInOutHistory,
      totalShiftTime,
      totalBreakTime,
      currentStatus: attendance.checkInTime && !attendance.checkOutTime 
        ? 'checked-in' 
        : attendance.checkOutTime 
        ? 'checked-out' 
        : 'not-started',
    };
  };

  // Memoize attendance details to prevent unnecessary recalculations
  const attendanceDetails = useMemo(() => {
    return parseAttendanceDetails(todayAttendance);
  }, [todayAttendance?.id, todayAttendance?.checkInTime, todayAttendance?.checkOutTime, todayAttendance?.notes]);

  // Timer effect - updates every second when checked in
  useEffect(() => {
    // If not checked in or already checked out, set static values
    if (!todayAttendance?.checkInTime || todayAttendance?.checkOutTime) {
      if (attendanceDetails && todayAttendance?.checkOutTime) {
        // Calculate total shift time and break time if checked out
        const formatSeconds = (seconds: number) => {
          const hours = Math.floor(seconds / 3600);
          const minutes = Math.floor((seconds % 3600) / 60);
          const secs = seconds % 60;
          return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
        };
        
        setTotalShiftTime(formatSeconds(attendanceDetails.totalShiftTime));
        setBreakTime(formatSeconds(attendanceDetails.totalBreakTime));
        setElapsedTime('00:00:00');
      } else {
        setElapsedTime('00:00:00');
        setBreakTime('00:00:00');
        setTotalShiftTime('00:00:00');
      }
      return;
    }

    // Only run timer if checked in and we have attendance details
    if (!attendanceDetails) return;

    const updateTimer = () => {
      const now = new Date();
      let currentShiftTime = attendanceDetails.totalShiftTime;
      
      // Find the last check-in time
      const lastCheckIn = attendanceDetails.checkInOutHistory
        .filter(e => e.type === 'in')
        .map(e => new Date(e.time))
        .sort((a, b) => b.getTime() - a.getTime())[0];

      if (lastCheckIn) {
        // Add time from last check-in to now
        currentShiftTime += differenceInSeconds(now, lastCheckIn);
      }

      const hours = Math.floor(currentShiftTime / 3600);
      const minutes = Math.floor((currentShiftTime % 3600) / 60);
      const seconds = currentShiftTime % 60;
      
      setElapsedTime(
        `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
      );
      setTotalShiftTime(
        `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
      );
      
      // Update break time (static, doesn't change while checked in)
      const breakHours = Math.floor(attendanceDetails.totalBreakTime / 3600);
      const breakMinutes = Math.floor((attendanceDetails.totalBreakTime % 3600) / 60);
      const breakSeconds = attendanceDetails.totalBreakTime % 60;
      setBreakTime(
        `${String(breakHours).padStart(2, '0')}:${String(breakMinutes).padStart(2, '0')}:${String(breakSeconds).padStart(2, '0')}`
      );
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);

    return () => clearInterval(interval);
  }, [todayAttendance?.checkInTime, todayAttendance?.checkOutTime, attendanceDetails]);

  const calculateStats = () => {
    const now = new Date();
    const startOfCurrentMonth = startOfMonth(now);
    const endOfCurrentMonth = endOfMonth(now);

    // Filter attendance for current month
    // If an employee is selected, the attendance array already contains only that employee's data
    const thisMonthAttendance = attendance.filter((record) => {
      const recordDate = new Date(record.date);
      return recordDate >= startOfCurrentMonth && recordDate <= endOfCurrentMonth && record.checkOutTime;
    });

    // Calculate total hours
    let totalSeconds = 0;
    thisMonthAttendance.forEach((record) => {
      if (record.checkInTime && record.checkOutTime) {
        const checkIn = new Date(record.checkInTime);
        const checkOut = new Date(record.checkOutTime);
        totalSeconds += differenceInSeconds(checkOut, checkIn);
      }
    });

    const totalHours = totalSeconds / 3600;
    const daysWorked = thisMonthAttendance.length;
    const averageHours = daysWorked > 0 ? totalHours / daysWorked : 0;

    // Calculate current streak
    let streak = 0;
    const sortedAttendance = [...attendance]
      .filter((r) => r.checkInTime)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    let checkDate = new Date();
    checkDate.setHours(0, 0, 0, 0);

    for (const record of sortedAttendance) {
      const recordDate = new Date(record.date);
      recordDate.setHours(0, 0, 0, 0);
      
      if (isSameDay(recordDate, checkDate) || isSameDay(recordDate, subDays(checkDate, streak))) {
        if (isSameDay(recordDate, checkDate)) {
          streak = 1;
        } else {
          streak++;
        }
        checkDate = subDays(recordDate, 1);
      } else {
        break;
      }
    }

    setStats({
      totalHoursThisMonth: Math.round(totalHours * 100) / 100,
      daysWorkedThisMonth: daysWorked,
      currentStreak: streak,
      averageHoursPerDay: Math.round(averageHours * 100) / 100,
    });
  };

  const fetchTodayAttendance = async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        return;
      }
      
      // Get today's date in UTC to match server timezone
      const now = new Date();
      const year = now.getUTCFullYear();
      const month = String(now.getUTCMonth() + 1).padStart(2, '0');
      const day = String(now.getUTCDate()).padStart(2, '0');
      const today = `${year}-${month}-${day}`;
      
      let url = `/api/attendance?startDate=${today}&endDate=${today}`;
      
      // Add userId parameter if an employee is selected
      if (selectedEmployeeId) {
        url += `&userId=${selectedEmployeeId}`;
      }
      
      const response = await fetch(url, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        const attendance = data.attendance?.[0] || null;
        
        if (attendance) {
          setTodayAttendance(attendance);
        } else {
          if (!justCheckedIn) {
            setTodayAttendance(null);
          }
        }
      }
    } catch (error) {
      console.error('Failed to fetch today attendance:', error);
    }
  };

  const fetchUserInfo = async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) return;
      
      const response = await fetch('/api/auth/me', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setUserInfo(data.user);
      }
    } catch (error) {
      console.error('Failed to fetch user info:', error);
    }
  };

  const fetchEmployees = async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) return;
      
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

  const fetchAttendance = async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        setLoading(false);
        return;
      }
      
      // Calculate date range based on calendar view
      let start: Date;
      let end: Date;
      
      if (calendarView === 'week') {
        start = startOfWeek(currentMonth, { weekStartsOn: 1 });
        end = endOfWeek(currentMonth, { weekStartsOn: 1 });
      } else if (calendarView === 'year') {
        start = new Date(currentMonth.getFullYear(), 0, 1);
        end = new Date(currentMonth.getFullYear(), 11, 31);
      } else {
        // month view
        start = startOfMonth(currentMonth);
        end = endOfMonth(currentMonth);
      }
      
      const startDate = format(start, 'yyyy-MM-dd');
      const endDate = format(end, 'yyyy-MM-dd');
      
      // Build URL with optional userId parameter
      let url = `/api/attendance?startDate=${startDate}&endDate=${endDate}`;
      if (selectedEmployeeId) {
        url += `&userId=${selectedEmployeeId}`;
      }
      
      const response = await fetch(url, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setAttendance(data.attendance || []);
      }
    } catch (error) {
      console.error('Failed to fetch attendance:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCheckIn = async () => {
    // Only allow check-in for own attendance, not when viewing others
    if (selectedEmployeeId) {
      alert('You can only check in for your own attendance. Please select "My Attendance" first.');
      return;
    }
    
    setCheckingIn(true);
    try {
      const token = localStorage.getItem('token');
      // Get today's date in UTC to match server timezone
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
        const data = await response.json();
        
        if (data.attendance) {
          const attendanceData = {
            ...data.attendance,
            user: data.attendance.user || { name: 'Current User' }
          };
          setJustCheckedIn(true);
          setTodayAttendance(attendanceData);
          
          // Refresh attendance details
          await fetchTodayAttendance();
          await fetchAttendance();
          
          setTimeout(() => {
            setJustCheckedIn(false);
          }, 2000);
        } else {
          await fetchTodayAttendance();
          await fetchAttendance();
        }
      } else {
        const data = await response.json();
        alert(data.error || 'Failed to check in');
      }
    } catch (error) {
      console.error('Failed to check in:', error);
      alert('Failed to check in');
    } finally {
      setCheckingIn(false);
    }
  };

  const handleCheckOut = async () => {
    // Only allow check-out for own attendance, not when viewing others
    if (selectedEmployeeId) {
      alert('You can only check out for your own attendance. Please select "My Attendance" first.');
      return;
    }
    
    setCheckingOut(true);
    try {
      const token = localStorage.getItem('token');
      // Get today's date in UTC to match server timezone
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
        await fetchTodayAttendance();
        await fetchAttendance();
      } else {
        const data = await response.json();
        alert(data.error || 'Failed to check out');
      }
    } catch (error) {
      console.error('Failed to check out:', error);
      alert('Failed to check out');
    } finally {
      setCheckingOut(false);
    }
  };

  const formatTime = (dateString: string | Date | null) => {
    if (!dateString) return '-';
    const date = dateString instanceof Date ? dateString : new Date(dateString);
    return format(date, 'HH:mm');
  };

  const formatDate = (dateString: string) => {
    return format(new Date(dateString), 'MMM dd, yyyy');
  };

  const formatDateShort = (dateString: string) => {
    return format(new Date(dateString), 'MMM dd');
  };

  const formatNotes = (notes: string | null) => {
    if (!notes) return '-';
    
    try {
      const notesData = JSON.parse(notes);
      
      // If it's not the expected structure, return as-is
      if (!notesData.checkInOutHistory && !notesData.userNotes && !notesData.firstCheckIn) {
        return <span className="text-gray-600">{notes}</span>;
      }

      const parts: JSX.Element[] = [];
      
      // Format check-in/out history
      if (notesData.checkInOutHistory && Array.isArray(notesData.checkInOutHistory) && notesData.checkInOutHistory.length > 0) {
        parts.push(
          <div key="history" className="space-y-1">
            {notesData.checkInOutHistory.map((event: CheckInOutEvent, index: number) => (
              <div key={index} className="flex items-center gap-2 text-xs">
                <span className={`inline-flex items-center justify-center w-5 h-5 rounded-full text-[10px] font-medium ${
                  event.type === 'in' 
                    ? 'bg-green-100 text-green-700' 
                    : 'bg-red-100 text-red-700'
                }`}>
                  {event.type === 'in' ? 'IN' : 'OUT'}
                </span>
                <span className="text-gray-600">
                  {format(new Date(event.time), 'HH:mm:ss')}
                </span>
              </div>
            ))}
          </div>
        );
      }
      
      // Add user notes if available
      if (notesData.userNotes) {
        parts.push(
          <div key="userNotes" className="mt-2 pt-2 border-t border-gray-200">
            <div className="text-xs font-medium text-gray-700 mb-1">User Notes:</div>
            <div className="text-xs text-gray-600">{notesData.userNotes}</div>
          </div>
        );
      }
      
      return <div className="max-w-md">{parts}</div>;
    } catch {
      // If parsing fails, treat as plain text
      return <span className="text-gray-600">{notes}</span>;
    }
  };

  const getWeekDays = () => {
    const start = startOfWeek(new Date(), { weekStartsOn: 1 });
    const end = endOfWeek(new Date(), { weekStartsOn: 1 });
    return eachDayOfInterval({ start, end });
  };

  const getAttendanceForDate = (date: Date) => {
    return attendance.find((record) => {
      const recordDate = new Date(record.date);
      return isSameDay(recordDate, date);
    });
  };

  const getHoursWorked = (attendanceRecord: Attendance | undefined): string => {
    if (!attendanceRecord || !attendanceRecord.checkInTime || !attendanceRecord.checkOutTime) {
      return '-';
    }
    
    const checkIn = new Date(attendanceRecord.checkInTime);
    const checkOut = new Date(attendanceRecord.checkOutTime);
    const totalSeconds = differenceInSeconds(checkOut, checkIn);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    
    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    return `${minutes}m`;
  };

  const getMonthlyCalendarDays = () => {
    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(currentMonth);
    const daysInMonth = getDaysInMonth(currentMonth);
    const startDay = getDay(monthStart); // 0 = Sunday, 1 = Monday, etc.
    
    // Adjust for Monday as first day (0 = Monday)
    const adjustedStartDay = startDay === 0 ? 6 : startDay - 1;
    
    const days: (Date | null)[] = [];
    
    // Add empty cells for days before month starts
    for (let i = 0; i < adjustedStartDay; i++) {
      days.push(null);
    }
    
    // Add all days of the month
    for (let i = 1; i <= daysInMonth; i++) {
      days.push(new Date(currentMonth.getFullYear(), currentMonth.getMonth(), i));
    }
    
    return days;
  };

  const getWeeklyCalendarDays = () => {
    const weekStart = startOfWeek(currentMonth, { weekStartsOn: 1 });
    return eachDayOfInterval({ start: weekStart, end: endOfWeek(weekStart, { weekStartsOn: 1 }) });
  };

  const getYearCalendarMonths = () => {
    const months: Date[] = [];
    for (let i = 0; i < 12; i++) {
      months.push(new Date(currentMonth.getFullYear(), i, 1));
    }
    return months;
  };

  const handleDateClick = (date: Date) => {
    setSelectedDate(date);
    setShowDateDetails(true);
  };

  const handlePrevMonth = () => {
    setCurrentMonth(subMonths(currentMonth, 1));
  };

  const handleNextMonth = () => {
    setCurrentMonth(addMonths(currentMonth, 1));
  };

  const handleEmployeeChange = (employeeId: string) => {
    setSelectedEmployeeId(employeeId || null);
  };

  const getSelectedDateAttendance = () => {
    if (!selectedDate) return null;
    return getAttendanceForDate(selectedDate);
  };

  const filteredAttendance = attendance.filter((record) => {
    const matchesSearch = searchTerm === '' || 
      formatDate(record.date).toLowerCase().includes(searchTerm.toLowerCase()) ||
      formatTime(record.checkInTime).toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = filterStatus === 'all' || record.status === filterStatus;
    
    return matchesSearch && matchesStatus;
  });

  const exportAttendance = () => {
    const csv = [
      ['Date', 'Check-in', 'Check-out', 'Status', 'Hours', 'Notes'].join(','),
      ...filteredAttendance.map((record) => {
        let hours = '-';
        if (record.checkInTime && record.checkOutTime) {
          const checkIn = new Date(record.checkInTime);
          const checkOut = new Date(record.checkOutTime);
          const totalSeconds = differenceInSeconds(checkOut, checkIn);
          const h = Math.floor(totalSeconds / 3600);
          const m = Math.floor((totalSeconds % 3600) / 60);
          hours = `${h}:${String(m).padStart(2, '0')}`;
        }
        return [
          formatDate(record.date),
          formatTime(record.checkInTime),
          formatTime(record.checkOutTime),
          record.status,
          hours,
          record.notes || ''
        ].join(',');
      })
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `attendance-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  return (
    <MainLayout>
      <div className="h-[calc(100vh-120px)] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between mb-2 flex-shrink-0">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Attendance</h1>
            <p className="text-gray-600 text-xs">
              {selectedEmployeeId && employees.find(e => e.id === selectedEmployeeId)
                ? `Viewing: ${employees.find(e => e.id === selectedEmployeeId)?.name}`
                : 'Track your daily attendance and work hours'}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {/* Employee Selector for Managers/Admins */}
            {userInfo && (userInfo.role === 'MANAGER' || userInfo.role === 'COMPANY_ADMIN' || userInfo.role === 'SUPER_ADMIN' || userInfo.role === 'TEAM_LEAD') && employees.length > 0 && (
              <div className="flex items-center gap-2">
                <Users className="h-3 w-3 text-gray-500" />
                <select
                  value={selectedEmployeeId || ''}
                  onChange={(e) => handleEmployeeChange(e.target.value)}
                  className="px-2 py-1 border rounded text-xs min-w-[150px]"
                >
                  <option value="">My Attendance</option>
                  {employees.map((employee) => (
                    <option key={employee.id} value={employee.id}>
                      {employee.name}
                    </option>
                  ))}
                </select>
              </div>
            )}
            {filteredAttendance.length > 0 && (
              <Button onClick={exportAttendance} variant="outline" size="sm" className="gap-1 text-xs h-7">
                <Download className="h-3 w-3" />
                Export
              </Button>
            )}
          </div>
        </div>

        {/* Statistics Cards */}
        <div className="grid grid-cols-4 gap-2 mb-2 flex-shrink-0">
          <Card className="bg-gradient-to-br from-purple-50 to-purple-100 border-purple-200 p-2">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 p-0 pb-1">
              <CardTitle className="text-[10px] font-medium text-purple-900">Total Hours</CardTitle>
              <Clock className="h-3 w-3 text-purple-600" />
            </CardHeader>
            <CardContent className="p-0 pt-1">
              <div className="text-lg font-bold text-purple-900">{stats.totalHoursThisMonth.toFixed(1)}</div>
              <p className="text-[10px] text-purple-700">This month</p>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200 p-2">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 p-0 pb-1">
              <CardTitle className="text-[10px] font-medium text-blue-900">Days Worked</CardTitle>
              <CalendarDays className="h-3 w-3 text-blue-600" />
            </CardHeader>
            <CardContent className="p-0 pt-1">
              <div className="text-lg font-bold text-blue-900">{stats.daysWorkedThisMonth}</div>
              <p className="text-[10px] text-blue-700">This month</p>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-green-50 to-green-100 border-green-200 p-2">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 p-0 pb-1">
              <CardTitle className="text-[10px] font-medium text-green-900">Streak</CardTitle>
              <Award className="h-3 w-3 text-green-600" />
            </CardHeader>
            <CardContent className="p-0 pt-1">
              <div className="text-lg font-bold text-green-900">{stats.currentStreak}</div>
              <p className="text-[10px] text-green-700">Days in a row</p>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-orange-50 to-orange-100 border-orange-200 p-2">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 p-0 pb-1">
              <CardTitle className="text-[10px] font-medium text-orange-900">Avg Hours/Day</CardTitle>
              <TrendingUp className="h-3 w-3 text-orange-600" />
            </CardHeader>
            <CardContent className="p-0 pt-1">
              <div className="text-lg font-bold text-orange-900">{stats.averageHoursPerDay.toFixed(1)}</div>
              <p className="text-[10px] text-orange-700">Per day</p>
            </CardContent>
          </Card>
        </div>

        {/* Today's Attendance Card - Full Width */}
        <Card className="border-2 shadow-lg flex-shrink min-h-0 flex flex-col">
          <CardHeader className="bg-gradient-to-r from-primary/10 to-purple-100/50 rounded-t-lg p-3 flex-shrink-0">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base font-bold">
                {selectedEmployeeId && employees.find(e => e.id === selectedEmployeeId)
                  ? `${employees.find(e => e.id === selectedEmployeeId)?.name}'s Attendance`
                  : 'Today\'s Attendance'}
              </CardTitle>
              <div className="text-xs text-gray-600 font-medium">
                {format(new Date(), 'EEEE, MMMM dd, yyyy')}
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-3 p-3 flex-1 flex flex-col min-h-0">
            {selectedEmployeeId && !todayAttendance?.checkInTime ? (
              <div className="text-center py-4">
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gray-100 mb-3">
                  <Clock className="h-8 w-8 text-gray-400" />
                </div>
                <h3 className="text-base font-semibold text-gray-900 mb-2">Not Checked In</h3>
                <p className="text-sm text-gray-500">No attendance record for today</p>
              </div>
            ) : !todayAttendance?.checkInTime ? (
              <div className="text-center py-4">
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gray-100 mb-3">
                  <Clock className="h-8 w-8 text-gray-400" />
                </div>
                <h3 className="text-base font-semibold text-gray-900 mb-2">Not Checked In</h3>
                <p className="text-sm text-gray-500 mb-4">Start your work day by checking in</p>
                {!selectedEmployeeId && (
                  <Button
                    onClick={handleCheckIn}
                    disabled={checkingIn}
                    className="bg-gradient-to-r from-primary to-purple-600 hover:from-primary/90 hover:to-purple-700 text-white shadow-lg px-6 py-3"
                    size="sm"
                  >
                    <LogIn className="mr-2 h-4 w-4" />
                    {checkingIn ? 'Checking in...' : 'Check In'}
                  </Button>
                )}
              </div>
            ) : !todayAttendance?.checkOutTime ? (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full bg-green-500 animate-pulse"></div>
                      <span className="text-sm font-medium text-green-700">Active Shift</span>
                    </div>
                    <div className="text-sm text-gray-600">
                      <span className="font-medium">Checked in at:</span>{' '}
                      <span className="text-gray-900">{formatTime(todayAttendance.checkInTime)}</span>
                    </div>
                  </div>
                  {!selectedEmployeeId && (
                    <Button
                      onClick={handleCheckOut}
                      disabled={checkingOut}
                      className="bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 text-white shadow-lg"
                      size="sm"
                    >
                      <LogOut className="mr-2 h-4 w-4" />
                      {checkingOut ? 'Checking out...' : 'Check Out'}
                    </Button>
                  )}
                </div>

                {/* Timer Display */}
                <div className="bg-gradient-to-br from-primary/10 via-purple-50 to-blue-50 rounded-lg p-4 border border-primary/20">
                  <div className="text-center">
                    <div className="text-xs uppercase tracking-wider text-gray-500 mb-2">Current Shift Time</div>
                    <div className="flex items-center justify-center gap-2 mb-1">
                      <Clock className="h-6 w-6 text-primary" />
                      <div className="text-4xl font-mono font-bold bg-gradient-to-r from-primary to-purple-600 bg-clip-text text-transparent">
                        {elapsedTime}
                      </div>
                    </div>
                    <div className="text-xs text-gray-600">
                      Started at {attendanceDetails?.firstCheckIn ? formatTime(attendanceDetails.firstCheckIn.toISOString()) : formatTime(todayAttendance.checkInTime)}
                    </div>
                  </div>
                </div>

                {/* Break Time and Total Shift Time Display */}
                {attendanceDetails && attendanceDetails.totalBreakTime > 0 && (
                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-lg p-3 border border-purple-200">
                      <div className="text-xs uppercase tracking-wider text-purple-700 mb-1">Total Shift Time</div>
                      <div className="text-lg font-bold text-purple-900">{totalShiftTime || '00:00:00'}</div>
                    </div>
                    <div className="bg-gradient-to-br from-orange-50 to-orange-100 rounded-lg p-3 border border-orange-200">
                      <div className="text-xs uppercase tracking-wider text-orange-700 mb-1">Break Time</div>
                      <div className="text-lg font-bold text-orange-900">{breakTime || '00:00:00'}</div>
                    </div>
                  </div>
                )}

                {/* Check-in/Check-out History */}
                {attendanceDetails && attendanceDetails.checkInOutHistory.length > 2 && (
                  <div className="space-y-1 pt-2 border-t">
                    <h4 className="text-xs font-semibold text-gray-700">Today&apos;s Timeline</h4>
                    <div className="space-y-1 max-h-24 overflow-y-auto">
                      {attendanceDetails.checkInOutHistory.map((event, index) => (
                        <div key={index} className="flex items-center gap-2 text-xs">
                          <div className={`w-2 h-2 rounded-full ${event.type === 'in' ? 'bg-green-500' : 'bg-red-500'}`}></div>
                          <span className="text-gray-600">{event.type === 'in' ? 'Checked In' : 'Checked Out'}</span>
                          <span className="text-gray-900 font-medium">{formatTime(event.time)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-2 flex-1 flex flex-col min-h-0">
                {/* Shift Summary */}
                <div className="grid grid-cols-2 gap-2 flex-shrink-0">
                  <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-lg p-2 border border-purple-200">
                    <div className="text-[10px] uppercase tracking-wider text-purple-700 mb-0.5">Total Shift Time</div>
                    <div className="text-sm font-bold text-purple-900">{totalShiftTime || '00:00:00'}</div>
                  </div>
                  <div className="bg-gradient-to-br from-orange-50 to-orange-100 rounded-lg p-2 border border-orange-200">
                    <div className="text-[10px] uppercase tracking-wider text-orange-700 mb-0.5">Break Time</div>
                    <div className="text-sm font-bold text-orange-900">{breakTime || '00:00:00'}</div>
                  </div>
                </div>

                {/* Check-in/Check-out History */}
                {attendanceDetails && attendanceDetails.checkInOutHistory.length > 0 && (
                  <div className="space-y-1 pt-1.5 border-t flex-shrink-0">
                    <h4 className="text-[10px] font-semibold text-gray-700 mb-1">Today&apos;s Timeline</h4>
                    <div className="space-y-0.5">
                      {attendanceDetails.checkInOutHistory.map((event, index) => (
                        <div key={index} className="flex items-center gap-1.5 text-[10px]">
                          <div className={`w-1.5 h-1.5 rounded-full ${event.type === 'in' ? 'bg-green-500' : 'bg-red-500'}`}></div>
                          <span className="text-gray-600">{event.type === 'in' ? 'Checked In' : 'Checked Out'}</span>
                          <span className="text-gray-900 font-medium">{formatTime(event.time)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Re-check In Button - Always visible at bottom */}
                {!selectedEmployeeId && (
                  <div className="pt-2 border-t mt-auto flex-shrink-0">
                    <Button
                      onClick={handleCheckIn}
                      disabled={checkingIn}
                      className="w-full bg-gradient-to-r from-primary to-purple-600 hover:from-primary/90 hover:to-purple-700 text-white shadow-lg h-8 text-xs"
                      size="sm"
                    >
                      <LogIn className="mr-1.5 h-3 w-3" />
                      {checkingIn ? 'Checking in...' : 'Check Back In'}
                    </Button>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Bottom Section: Calendar and History Side by Side */}
        <div className="flex-1 grid grid-cols-2 gap-2 min-h-0 overflow-hidden">
          {/* Left: Attendance Calendar */}
          <Card className="flex flex-col overflow-hidden">
            <CardHeader className="flex-shrink-0 p-2">
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-1 text-sm">
                  <Calendar className="h-4 w-4" />
                  Calendar
                </CardTitle>
                <div className="flex items-center gap-1">
                  <select
                    value={calendarView}
                    onChange={(e) => setCalendarView(e.target.value as 'week' | 'month' | 'year')}
                    className="px-2 py-1 text-xs border rounded h-7"
                  >
                    <option value="week">Week</option>
                    <option value="month">Month</option>
                    <option value="year">Year</option>
                  </select>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handlePrevMonth}
                    className="h-7 w-7 p-0"
                  >
                    <ChevronLeft className="h-3 w-3" />
                  </Button>
                  <span className="text-xs font-medium min-w-[90px] text-center">
                    {calendarView === 'week' 
                      ? format(startOfWeek(currentMonth, { weekStartsOn: 1 }), 'MMM dd') + ' - ' + format(endOfWeek(currentMonth, { weekStartsOn: 1 }), 'MMM dd')
                      : calendarView === 'month'
                      ? format(currentMonth, 'MMM yyyy')
                      : format(currentMonth, 'yyyy')}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleNextMonth}
                    className="h-7 w-7 p-0"
                  >
                    <ChevronRight className="h-3 w-3" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentMonth(new Date())}
                    className="text-xs px-2 h-7"
                  >
                    Today
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="flex-1 overflow-y-auto p-3">

                {/* Calendar Grid */}
                {calendarView === 'month' && (
                  <div className="space-y-0">
                    {/* Day Headers */}
                    <div className="grid grid-cols-7 gap-0 mb-0.5">
                      {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day) => (
                        <div key={day} className="text-center text-[10px] font-semibold text-gray-600 py-0.5">
                          {day}
                        </div>
                      ))}
                    </div>
                    
                    {/* Calendar Days */}
                    <div className="grid grid-cols-7 gap-0.5 flex-1" style={{ gridTemplateRows: 'repeat(6, minmax(0, 1fr))' }}>
                      {getMonthlyCalendarDays().map((day, index) => {
                        if (!day) {
                          return <div key={`empty-${index}`} className="p-0" />;
                        }
                        
                        const dayAttendance = getAttendanceForDate(day);
                        const isToday = isSameDay(day, new Date());
                        const isPast = day < new Date() && !isToday;
                        const isFuture = day > new Date() && !isToday;
                        const hoursWorked = getHoursWorked(dayAttendance);
                        
                        return (
                          <div
                            key={day.toISOString()}
                            onClick={() => handleDateClick(day)}
                            className={`p-1 rounded border cursor-pointer transition-all hover:shadow-sm flex flex-col min-h-0 ${
                              isToday
                                ? 'border-primary bg-primary/10'
                                : dayAttendance
                                ? 'border-green-200 bg-green-50 hover:bg-green-100'
                                : isPast
                                ? 'border-gray-200 bg-gray-50 hover:bg-gray-100'
                                : isFuture
                                ? 'border-gray-100 bg-white opacity-50'
                                : 'border-gray-100 bg-white'
                            }`}
                          >
                            <div className={`text-[11px] font-bold mb-0.5 ${isToday ? 'text-primary' : 'text-gray-900'}`}>
                              {format(day, 'd')}
                            </div>
                            {dayAttendance?.checkInTime && (
                              <div className="flex-1 flex flex-col justify-center space-y-0.5 min-h-0">
                                <div className="text-[9px] text-gray-700 font-medium leading-tight">
                                  <span className="font-semibold">In:</span> {formatTime(dayAttendance.checkInTime)}
                                </div>
                                {dayAttendance.checkOutTime && (
                                  <div className="text-[9px] text-gray-700 font-medium leading-tight">
                                    <span className="font-semibold">Out:</span> {formatTime(dayAttendance.checkOutTime)}
                                  </div>
                                )}
                                {hoursWorked !== '-' && (
                                  <div className="text-[9px] font-bold text-green-700 mt-0.5 leading-tight">
                                    {hoursWorked}
                                  </div>
                                )}
                                {!dayAttendance.checkOutTime && (
                                  <div className="text-[9px] text-green-600 font-semibold mt-0.5 leading-tight">Active</div>
                                )}
                              </div>
                            )}
                            {!dayAttendance && isPast && (
                              <div className="flex-1 flex items-center justify-center min-h-0">
                                <div className="text-[10px] text-gray-400">-</div>
                              </div>
                            )}
                            {!dayAttendance && !isPast && (
                              <div className="flex-1 min-h-0"></div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {calendarView === 'week' && (
                  <div className="space-y-1">
                    {/* Day Headers */}
                    <div className="grid grid-cols-7 gap-1 mb-1">
                      {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day) => (
                        <div key={day} className="text-center text-sm font-semibold text-gray-600 py-1">
                          {day}
                        </div>
                      ))}
                    </div>
                    
                    {/* Week Days */}
                    <div className="grid grid-cols-7 gap-1">
                      {getWeeklyCalendarDays().map((day, index) => {
                        const dayAttendance = getAttendanceForDate(day);
                        const isToday = isSameDay(day, new Date());
                        const hoursWorked = getHoursWorked(dayAttendance);
                        
                        return (
                          <div
                            key={index}
                            onClick={() => handleDateClick(day)}
                            className={`p-3 rounded-lg border-2 cursor-pointer transition-all hover:shadow-md flex flex-col min-h-[120px] ${
                              isToday
                                ? 'border-primary bg-primary/10'
                                : dayAttendance
                                ? 'border-green-200 bg-green-50 hover:bg-green-100'
                                : 'border-gray-200 bg-gray-50 hover:bg-gray-100'
                            }`}
                          >
                            <div className={`text-lg font-bold mb-2 ${isToday ? 'text-primary' : 'text-gray-900'}`}>
                              {format(day, 'd')}
                            </div>
                            {dayAttendance?.checkInTime && (
                              <div className="flex-1 flex flex-col justify-center space-y-1">
                                <div className="text-sm text-gray-700 font-medium">
                                  <span className="font-semibold">In:</span> {formatTime(dayAttendance.checkInTime)}
                                </div>
                                {dayAttendance.checkOutTime && (
                                  <div className="text-sm text-gray-700 font-medium">
                                    <span className="font-semibold">Out:</span> {formatTime(dayAttendance.checkOutTime)}
                                  </div>
                                )}
                                {hoursWorked !== '-' && (
                                  <div className="text-sm font-bold text-green-700 mt-1">
                                    {hoursWorked}
                                  </div>
                                )}
                                {!dayAttendance.checkOutTime && (
                                  <div className="text-sm text-green-600 font-semibold mt-1">Active</div>
                                )}
                              </div>
                            )}
                            {!dayAttendance && (
                              <div className="flex-1 flex items-center justify-center">
                                <div className="text-base text-gray-400">-</div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {calendarView === 'year' && (
                  <div className="grid grid-cols-3 gap-2">
                    {getYearCalendarMonths().map((month, index) => {
                      const monthStart = startOfMonth(month);
                      const monthEnd = endOfMonth(month);
                      const monthAttendance = attendance.filter((record) => {
                        const recordDate = new Date(record.date);
                        return recordDate >= monthStart && recordDate <= monthEnd;
                      });
                      const daysWithAttendance = monthAttendance.filter(a => a.checkInTime).length;
                      const isCurrentMonth = isSameDay(month, new Date());
                      
                      return (
                        <div
                          key={index}
                          onClick={() => {
                            setCurrentMonth(month);
                            setCalendarView('month');
                          }}
                          className={`p-3 rounded border cursor-pointer transition-all hover:shadow-sm ${
                            isCurrentMonth
                              ? 'border-primary bg-primary/10'
                              : monthAttendance.length > 0
                              ? 'border-green-200 bg-green-50'
                              : 'border-gray-200 bg-gray-50'
                          }`}
                        >
                          <div className={`text-sm font-bold mb-1 ${isCurrentMonth ? 'text-primary' : 'text-gray-900'}`}>
                            {format(month, 'MMM')}
                          </div>
                          <div className="text-xs text-gray-600">
                            {daysWithAttendance} days
                          </div>
                          {monthAttendance.length > 0 && (
                            <div className="text-xs font-semibold text-green-700 mt-1">
                              {(() => {
                                let totalSeconds = 0;
                                monthAttendance.forEach((record) => {
                                  if (record.checkInTime && record.checkOutTime) {
                                    totalSeconds += differenceInSeconds(
                                      new Date(record.checkOutTime),
                                      new Date(record.checkInTime)
                                    );
                                  }
                                });
                                const hours = Math.floor(totalSeconds / 3600);
                                return `${hours}h`;
                              })()}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>

          {/* Right: Attendance History */}
          <Card className="flex flex-col overflow-hidden">
            <CardHeader className="flex-shrink-0 p-2">
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-1 text-sm">
                  <Activity className="h-3 w-3" />
                  History
                </CardTitle>
                <div className="flex gap-1">
                  <div className="relative">
                    <Search className="absolute left-1.5 top-1.5 h-3 w-3 text-gray-400" />
                    <input
                      type="text"
                      placeholder="Search..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-6 pr-2 py-1 border rounded text-xs w-24 h-6"
                    />
                  </div>
                  <select
                    value={filterStatus}
                    onChange={(e) => setFilterStatus(e.target.value)}
                    className="px-1.5 py-1 border rounded text-xs h-6"
                  >
                    <option value="all">All</option>
                    <option value="PRESENT">Present</option>
                    <option value="ABSENT">Absent</option>
                    <option value="LATE">Late</option>
                    <option value="HALF_DAY">Half Day</option>
                  </select>
                </div>
              </div>
            </CardHeader>
            <CardContent className="flex-1 overflow-y-auto p-2">

              {loading ? (
                <div className="text-center py-4">
                  <div className="inline-block animate-spin rounded-full h-4 w-4 border-b-2 border-primary"></div>
                  <p className="mt-1 text-xs text-gray-500">Loading...</p>
                </div>
              ) : filteredAttendance.length === 0 ? (
                <div className="text-center py-6">
                  <Calendar className="h-6 w-6 text-gray-300 mx-auto mb-2" />
                  <p className="text-xs text-gray-500">No records found</p>
                </div>
              ) : (
                <div className="space-y-1.5">
                  {filteredAttendance.slice(0, 15).map((record) => {
                    let hours = '-';
                    if (record.checkInTime && record.checkOutTime) {
                      const checkIn = new Date(record.checkInTime);
                      const checkOut = new Date(record.checkOutTime);
                      const totalSeconds = differenceInSeconds(checkOut, checkIn);
                      const h = Math.floor(totalSeconds / 3600);
                      const m = Math.floor((totalSeconds % 3600) / 60);
                      hours = `${h}h ${m}m`;
                    }
                    
                    const statusColors: Record<string, string> = {
                      PRESENT: 'bg-green-100 text-green-800',
                      ABSENT: 'bg-red-100 text-red-800',
                      LATE: 'bg-yellow-100 text-yellow-800',
                      HALF_DAY: 'bg-orange-100 text-orange-800',
                    };

                    return (
                      <div
                        key={record.id}
                        className="p-2 border rounded hover:bg-gray-50 hover:shadow-sm cursor-pointer transition-all"
                        onClick={() => {
                          setSelectedDate(new Date(record.date));
                          setShowDateDetails(true);
                        }}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs font-bold text-gray-900">{formatDate(record.date)}</span>
                          <span className={`px-1.5 py-0.5 text-[9px] rounded-full font-semibold ${statusColors[record.status] || 'bg-gray-100 text-gray-800'}`}>
                            {record.status}
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5 text-[9px] text-gray-700">
                          <span className="font-medium">In: <span className="font-semibold">{formatTime(record.checkInTime)}</span></span>
                          {record.checkOutTime && (
                            <>
                              <span className="text-gray-400">•</span>
                              <span className="font-medium">Out: <span className="font-semibold">{formatTime(record.checkOutTime)}</span></span>
                              <span className="text-gray-400">•</span>
                              <span className="font-bold text-green-700 text-[10px]">{hours}</span>
                            </>
                          )}
                        </div>
                      </div>
                    );
                  })}
                  {filteredAttendance.length > 15 && (
                    <div className="text-center text-[9px] text-gray-500 pt-1">
                      Showing 15 of {filteredAttendance.length}
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Date Details Dialog */}
        <Dialog open={showDateDetails} onOpenChange={setShowDateDetails}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>
                {selectedDate ? format(selectedDate, 'EEEE, MMMM dd, yyyy') : 'Attendance Details'}
              </DialogTitle>
              <DialogDescription>
                Detailed attendance information for this date
              </DialogDescription>
            </DialogHeader>
            {(() => {
              const dateAttendance = getSelectedDateAttendance();
              const dateDetails = dateAttendance ? parseAttendanceDetails(dateAttendance) : null;
              
              if (!dateAttendance) {
                return (
                  <div className="py-8 text-center">
                    <Calendar className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                    <p className="text-gray-500">No attendance record for this date</p>
                  </div>
                );
              }

              return (
                <div className="space-y-4">
                  {/* Basic Info */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-sm font-medium text-gray-500">Check-in Time</label>
                      <p className="text-base font-semibold">
                        {formatTime(dateAttendance.checkInTime) || 'Not checked in'}
                      </p>
                    </div>
                    <div className="space-y-1">
                      <label className="text-sm font-medium text-gray-500">Check-out Time</label>
                      <p className="text-base font-semibold">
                        {formatTime(dateAttendance.checkOutTime) || 'Not checked out'}
                      </p>
                    </div>
                    <div className="space-y-1">
                      <label className="text-sm font-medium text-gray-500">Total Hours</label>
                      <p className="text-base font-semibold text-green-700">
                        {getHoursWorked(dateAttendance)}
                      </p>
                    </div>
                    <div className="space-y-1">
                      <label className="text-sm font-medium text-gray-500">Status</label>
                      <p className="text-base font-semibold">
                        <span className={`px-2 py-1 text-xs rounded-full font-medium ${
                          dateAttendance.status === 'PRESENT' ? 'bg-green-100 text-green-800' :
                          dateAttendance.status === 'ABSENT' ? 'bg-red-100 text-red-800' :
                          dateAttendance.status === 'LATE' ? 'bg-yellow-100 text-yellow-800' :
                          dateAttendance.status === 'HALF_DAY' ? 'bg-orange-100 text-orange-800' :
                          'bg-gray-100 text-gray-800'
                        }`}>
                          {dateAttendance.status}
                        </span>
                      </p>
                    </div>
                  </div>

                  {/* Check-in/Check-out History */}
                  {dateDetails && dateDetails.checkInOutHistory.length > 0 && (
                    <div className="space-y-2 pt-4 border-t">
                      <h4 className="text-sm font-semibold text-gray-700">Check-in/Check-out Timeline</h4>
                      <div className="space-y-2 max-h-64 overflow-y-auto">
                        {dateDetails.checkInOutHistory.map((event, index) => (
                          <div key={index} className="flex items-center gap-3 text-sm p-2 rounded bg-gray-50">
                            <div className={`w-3 h-3 rounded-full ${event.type === 'in' ? 'bg-green-500' : 'bg-red-500'}`}></div>
                            <span className="text-gray-600 font-medium">
                              {event.type === 'in' ? 'Checked In' : 'Checked Out'}
                            </span>
                            <span className="text-gray-900 font-semibold">
                              {format(new Date(event.time), 'HH:mm:ss')}
                            </span>
                            <span className="text-gray-500 text-xs ml-auto">
                              {format(new Date(event.time), 'MMM dd, yyyy')}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Break Time and Total Shift Time */}
                  {dateDetails && (dateDetails.totalBreakTime > 0 || dateDetails.totalShiftTime > 0) && (
                    <div className="grid grid-cols-2 gap-4 pt-4 border-t">
                      <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-lg p-4 border border-purple-200">
                        <div className="text-xs uppercase tracking-wider text-purple-700 mb-1">Total Shift Time</div>
                        <div className="text-xl font-bold text-purple-900">
                          {(() => {
                            const seconds = dateDetails.totalShiftTime;
                            const hours = Math.floor(seconds / 3600);
                            const minutes = Math.floor((seconds % 3600) / 60);
                            return `${hours}h ${minutes}m`;
                          })()}
                        </div>
                      </div>
                      <div className="bg-gradient-to-br from-orange-50 to-orange-100 rounded-lg p-4 border border-orange-200">
                        <div className="text-xs uppercase tracking-wider text-orange-700 mb-1">Break Time</div>
                        <div className="text-xl font-bold text-orange-900">
                          {(() => {
                            const seconds = dateDetails.totalBreakTime;
                            const hours = Math.floor(seconds / 3600);
                            const minutes = Math.floor((seconds % 3600) / 60);
                            return `${hours}h ${minutes}m`;
                          })()}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Notes */}
                  {dateAttendance.notes && (
                    <div className="pt-4 border-t">
                      <h4 className="text-sm font-semibold text-gray-700 mb-2">Notes</h4>
                      <div className="text-sm text-gray-600">
                        {formatNotes(dateAttendance.notes)}
                      </div>
                    </div>
                  )}
                </div>
              );
            })()}
          </DialogContent>
        </Dialog>
      </div>
    </MainLayout>
  );
}
