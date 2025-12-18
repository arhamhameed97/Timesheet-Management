'use client';

import { useState, useEffect, useMemo } from 'react';
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
  Activity
} from 'lucide-react';
import { format, differenceInSeconds, startOfWeek, endOfWeek, eachDayOfInterval, isSameDay, startOfMonth, endOfMonth, subDays, addDays } from 'date-fns';

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

  useEffect(() => {
    let mounted = true;
    
    const loadData = async () => {
      try {
        await Promise.all([
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
      
      const today = format(new Date(), 'yyyy-MM-dd');
      const response = await fetch(`/api/attendance?startDate=${today}&endDate=${today}`, {
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

  const fetchAttendance = async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        setLoading(false);
        return;
      }
      
      const response = await fetch('/api/attendance', {
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
    setCheckingIn(true);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/attendance/checkin', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({}),
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
    setCheckingOut(true);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/attendance/checkout', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({}),
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
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Attendance</h1>
            <p className="text-gray-600 mt-1">Track your daily attendance and work hours</p>
          </div>
          {filteredAttendance.length > 0 && (
            <Button onClick={exportAttendance} variant="outline" className="gap-2">
              <Download className="h-4 w-4" />
              Export CSV
            </Button>
          )}
        </div>

        {/* Statistics Cards */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card className="bg-gradient-to-br from-purple-50 to-purple-100 border-purple-200">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-purple-900">Total Hours This Month</CardTitle>
              <Clock className="h-4 w-4 text-purple-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-purple-900">{stats.totalHoursThisMonth.toFixed(1)}</div>
              <p className="text-xs text-purple-700 mt-1">Hours worked</p>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-blue-900">Days Worked</CardTitle>
              <CalendarDays className="h-4 w-4 text-blue-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-900">{stats.daysWorkedThisMonth}</div>
              <p className="text-xs text-blue-700 mt-1">This month</p>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-green-50 to-green-100 border-green-200">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-green-900">Current Streak</CardTitle>
              <Award className="h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-900">{stats.currentStreak}</div>
              <p className="text-xs text-green-700 mt-1">Days in a row</p>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-orange-50 to-orange-100 border-orange-200">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-orange-900">Average Hours/Day</CardTitle>
              <TrendingUp className="h-4 w-4 text-orange-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-orange-900">{stats.averageHoursPerDay.toFixed(1)}</div>
              <p className="text-xs text-orange-700 mt-1">Per day average</p>
            </CardContent>
          </Card>
        </div>

        {/* Today's Attendance Card - Enhanced */}
        <Card className="border-2 shadow-lg">
          <CardHeader className="bg-gradient-to-r from-primary/10 to-purple-100/50 rounded-t-lg">
            <div className="flex items-center justify-between">
              <CardTitle className="text-xl font-bold">Today&apos;s Attendance</CardTitle>
              <div className="text-sm text-gray-600 font-medium">
                {format(new Date(), 'EEEE, MMMM dd, yyyy')}
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-6">
            {!todayAttendance?.checkInTime ? (
              <div className="text-center py-8">
                <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-gray-100 mb-4">
                  <Clock className="h-10 w-10 text-gray-400" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Not Checked In</h3>
                <p className="text-sm text-gray-500 mb-6">Start your work day by checking in</p>
                <Button
                  onClick={handleCheckIn}
                  disabled={checkingIn}
                  className="bg-gradient-to-r from-primary to-purple-600 hover:from-primary/90 hover:to-purple-700 text-white shadow-lg px-8 py-6 text-lg"
                  size="lg"
                >
                  <LogIn className="mr-2 h-5 w-5" />
                  {checkingIn ? 'Checking in...' : 'Check In'}
                </Button>
              </div>
            ) : !todayAttendance?.checkOutTime ? (
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full bg-green-500 animate-pulse"></div>
                      <span className="text-sm font-medium text-green-700">Active Shift</span>
                    </div>
                    <div className="text-sm text-gray-600">
                      <span className="font-medium">Checked in at:</span>{' '}
                      <span className="text-gray-900">{formatTime(todayAttendance.checkInTime)}</span>
                    </div>
                  </div>
                  <Button
                    onClick={handleCheckOut}
                    disabled={checkingOut}
                    className="bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 text-white shadow-lg"
                    size="lg"
                  >
                    <LogOut className="mr-2 h-4 w-4" />
                    {checkingOut ? 'Checking out...' : 'Check Out'}
                  </Button>
                </div>

                {/* Large Timer Display */}
                <div className="bg-gradient-to-br from-primary/10 via-purple-50 to-blue-50 rounded-xl p-8 border-2 border-primary/20">
                  <div className="text-center">
                    <div className="text-xs uppercase tracking-wider text-gray-500 mb-3">Current Shift Time</div>
                    <div className="flex items-center justify-center gap-3 mb-2">
                      <Clock className="h-8 w-8 text-primary" />
                      <div className="text-6xl font-mono font-bold bg-gradient-to-r from-primary to-purple-600 bg-clip-text text-transparent">
                        {elapsedTime}
                      </div>
                    </div>
                    <div className="text-sm text-gray-600 mt-4">
                      {attendanceDetails?.firstCheckIn ? (
                        <>
                          Started at <span className="font-semibold">{formatTime(attendanceDetails.firstCheckIn.toISOString())}</span>
                        </>
                      ) : (
                        <>
                          Started at <span className="font-semibold">{formatTime(todayAttendance.checkInTime)}</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                {/* Break Time and Total Shift Time Display */}
                {attendanceDetails && attendanceDetails.totalBreakTime > 0 && (
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-lg p-4 border border-purple-200">
                      <div className="text-xs uppercase tracking-wider text-purple-700 mb-1">Total Shift Time</div>
                      <div className="text-xl font-bold text-purple-900">{totalShiftTime || '00:00:00'}</div>
                    </div>
                    <div className="bg-gradient-to-br from-orange-50 to-orange-100 rounded-lg p-4 border border-orange-200">
                      <div className="text-xs uppercase tracking-wider text-orange-700 mb-1">Break Time</div>
                      <div className="text-xl font-bold text-orange-900">{breakTime || '00:00:00'}</div>
                    </div>
                  </div>
                )}

                {/* Check-in/Check-out History */}
                {attendanceDetails && attendanceDetails.checkInOutHistory.length > 2 && (
                  <div className="space-y-2 pt-4 border-t">
                    <h4 className="text-sm font-semibold text-gray-700">Today&apos;s Timeline</h4>
                    <div className="space-y-2 max-h-32 overflow-y-auto">
                      {attendanceDetails.checkInOutHistory.map((event, index) => (
                        <div key={index} className="flex items-center gap-3 text-sm">
                          <div className={`w-2 h-2 rounded-full ${event.type === 'in' ? 'bg-green-500' : 'bg-red-500'}`}></div>
                          <span className="text-gray-600">
                            {event.type === 'in' ? 'Checked In' : 'Checked Out'}
                          </span>
                          <span className="text-gray-900 font-medium">
                            {formatTime(event.time)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-6">
                <div className="text-center">
                  <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-blue-100 mb-4">
                    <Calendar className="h-10 w-10 text-blue-600" />
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">Checked Out</h3>
                  <p className="text-sm text-gray-500 mb-6">You can check back in to continue your shift</p>
                </div>

                {/* Shift Summary */}
                <div className="grid grid-cols-2 gap-4 mb-6">
                  <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-lg p-4 border border-purple-200">
                    <div className="text-xs uppercase tracking-wider text-purple-700 mb-1">Total Shift Time</div>
                    <div className="text-2xl font-bold text-purple-900">{totalShiftTime || '00:00:00'}</div>
                  </div>
                  <div className="bg-gradient-to-br from-orange-50 to-orange-100 rounded-lg p-4 border border-orange-200">
                    <div className="text-xs uppercase tracking-wider text-orange-700 mb-1">Break Time</div>
                    <div className="text-2xl font-bold text-orange-900">{breakTime || '00:00:00'}</div>
                  </div>
                </div>

                {/* Check-in/Check-out History */}
                {attendanceDetails && attendanceDetails.checkInOutHistory.length > 0 && (
                  <div className="space-y-2">
                    <h4 className="text-sm font-semibold text-gray-700">Today&apos;s Timeline</h4>
                    <div className="space-y-2">
                      {attendanceDetails.checkInOutHistory.map((event, index) => (
                        <div key={index} className="flex items-center gap-3 text-sm">
                          <div className={`w-2 h-2 rounded-full ${event.type === 'in' ? 'bg-green-500' : 'bg-red-500'}`}></div>
                          <span className="text-gray-600">
                            {event.type === 'in' ? 'Checked In' : 'Checked Out'}
                          </span>
                          <span className="text-gray-900 font-medium">
                            {formatTime(event.time)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Re-check In Button */}
                <div className="pt-4 border-t">
                  <Button
                    onClick={handleCheckIn}
                    disabled={checkingIn}
                    className="w-full bg-gradient-to-r from-primary to-purple-600 hover:from-primary/90 hover:to-purple-700 text-white shadow-lg"
                    size="lg"
                  >
                    <LogIn className="mr-2 h-5 w-5" />
                    {checkingIn ? 'Checking in...' : 'Check Back In'}
                  </Button>
                  <p className="text-xs text-gray-500 text-center mt-2">
                    Continue your shift by checking back in
                  </p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Weekly Calendar View */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              This Week
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-7 gap-2">
              {getWeekDays().map((day, index) => {
                const dayAttendance = getAttendanceForDate(day);
                const isToday = isSameDay(day, new Date());
                const isPast = day < new Date() && !isToday;
                
                return (
                  <div
                    key={index}
                    className={`p-3 rounded-lg border-2 text-center ${
                      isToday
                        ? 'border-primary bg-primary/10'
                        : dayAttendance
                        ? 'border-green-200 bg-green-50'
                        : isPast
                        ? 'border-gray-200 bg-gray-50'
                        : 'border-gray-100 bg-white'
                    }`}
                  >
                    <div className={`text-xs font-medium mb-1 ${isToday ? 'text-primary' : 'text-gray-600'}`}>
                      {format(day, 'EEE')}
                    </div>
                    <div className={`text-lg font-bold mb-1 ${isToday ? 'text-primary' : 'text-gray-900'}`}>
                      {format(day, 'd')}
                    </div>
                    {dayAttendance?.checkInTime && (
                      <div className="text-xs text-gray-600">
                        {formatTime(dayAttendance.checkInTime)}
                      </div>
                    )}
                    {dayAttendance?.checkOutTime && (
                      <div className="text-xs text-green-600 font-medium">✓</div>
                    )}
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Attendance History with Filters */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Activity className="h-5 w-5" />
                Attendance History
              </CardTitle>
              <div className="flex gap-2">
                <div className="relative">
                  <Search className="absolute left-2 top-2.5 h-4 w-4 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Search..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-8 pr-4 py-2 border rounded-md text-sm w-48"
                  />
                </div>
                <select
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value)}
                  className="px-3 py-2 border rounded-md text-sm"
                >
                  <option value="all">All Status</option>
                  <option value="PRESENT">Present</option>
                  <option value="ABSENT">Absent</option>
                  <option value="LATE">Late</option>
                  <option value="HALF_DAY">Half Day</option>
                </select>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-center py-8">
                <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                <p className="mt-2 text-gray-500">Loading attendance...</p>
              </div>
            ) : filteredAttendance.length === 0 ? (
              <div className="text-center py-12">
                <Calendar className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                <p className="text-gray-500">No attendance records found.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Check-in</TableHead>
                      <TableHead>Check-out</TableHead>
                      <TableHead>Hours</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Notes</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredAttendance.map((record) => {
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
                        <TableRow key={record.id} className="hover:bg-gray-50">
                          <TableCell className="font-medium">{formatDate(record.date)}</TableCell>
                          <TableCell>{formatTime(record.checkInTime)}</TableCell>
                          <TableCell>{formatTime(record.checkOutTime)}</TableCell>
                          <TableCell className="font-medium">{hours}</TableCell>
                          <TableCell>
                            <span className={`px-2 py-1 text-xs rounded-full font-medium ${statusColors[record.status] || 'bg-gray-100 text-gray-800'}`}>
                              {record.status}
                            </span>
                          </TableCell>
                          <TableCell className="text-gray-600">{record.notes || '-'}</TableCell>
                        </TableRow>
                      );
                    })}
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
