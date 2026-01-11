'use client';

import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay, getDaysInMonth, getDay } from 'date-fns';
import { PayrollStatus } from '@prisma/client';

interface PayrollRecord {
  id: string;
  month: number;
  year: number;
  netSalary: number;
  status: PayrollStatus;
}

interface DailyEarnings {
  hours: number;
  earnings: number;
  hourlyRate?: number | null;
  overtimeHours?: number;
  regularHours?: number;
}

interface PayrollCalendarProps {
  payrollRecords: PayrollRecord[];
  dailyEarnings?: Record<string, DailyEarnings>; // day -> { hours, earnings }
  onDateClick?: (payroll: PayrollRecord | null, date: Date) => void;
  onMonthChange?: (month: number, year: number) => void;
}

export function PayrollCalendar({ payrollRecords, dailyEarnings, onDateClick, onMonthChange }: PayrollCalendarProps) {
  const [currentDate, setCurrentDate] = useState(new Date());

  // Notify parent of initial month on mount
  React.useEffect(() => {
    if (onMonthChange) {
      const month = currentDate.getMonth() + 1;
      const year = currentDate.getFullYear();
      onMonthChange(month, year);
    }
  }, []); // Only run on mount

  // Debug: Log daily earnings when they change
  React.useEffect(() => {
    console.log('PayrollCalendar dailyEarnings prop:', dailyEarnings);
    if (dailyEarnings && Object.keys(dailyEarnings).length > 0) {
      const sampleDays = Object.entries(dailyEarnings).slice(0, 10);
      console.log('Sample daily earnings (first 10 days):', sampleDays);
      // Log actual values
      sampleDays.forEach(([day, data]: [string, any]) => {
        console.log(`Day ${day}: hours=${data?.hours}, earnings=${data?.earnings}`);
      });
      // Check for any days with earnings > 0 or hours > 0
      const daysWithHours = Object.entries(dailyEarnings).filter(([_, data]: [string, any]) => (data?.hours ?? 0) > 0);
      const daysWithEarnings = Object.entries(dailyEarnings).filter(([_, data]: [string, any]) => (data?.earnings ?? 0) > 0);
      console.log(`Days with hours > 0: ${daysWithHours.length} out of ${Object.keys(dailyEarnings).length}`);
      console.log(`Days with earnings > 0: ${daysWithEarnings.length} out of ${Object.keys(dailyEarnings).length}`);
      
      // Log all days with hours or earnings
      if (daysWithHours.length > 0) {
        console.log('Days with hours:', daysWithHours.map(([day, data]: [string, any]) => `Day ${day}: ${data?.hours}h`));
      }
      if (daysWithEarnings.length > 0) {
        console.log('Days with earnings:', daysWithEarnings.map(([day, data]: [string, any]) => `Day ${day}: $${data?.earnings}`));
      }
      
      // Warning if hours exist but no earnings
      if (daysWithHours.length > 0 && daysWithEarnings.length === 0) {
        console.warn('⚠️ WARNING: Hours are being tracked but no earnings are calculated. This usually means the hourly rate is not set in your employee profile. Please contact your administrator to set your hourly rate.');
      }
    } else {
      console.log('No daily earnings data received or empty object');
    }
  }, [dailyEarnings]);

  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);
  const daysInMonth = getDaysInMonth(currentDate);
  const startDay = getDay(monthStart); // 0 = Sunday, 1 = Monday, etc.
  
  // Adjust for Monday as first day (0 = Monday)
  const adjustedStartDay = startDay === 0 ? 6 : startDay - 1;

  // Get payroll for a specific date (using month/year)
  const getPayrollForDate = (date: Date): PayrollRecord | null => {
    const month = date.getMonth() + 1;
    const year = date.getFullYear();
    return payrollRecords.find((p) => p.month === month && p.year === year) || null;
  };

  // Get status color
  const getStatusColor = (status: PayrollStatus): string => {
    switch (status) {
      case PayrollStatus.APPROVED:
        return 'bg-green-500/20 dark:bg-green-500/30 text-green-700 dark:text-green-400 border-2 border-green-300/50 dark:border-green-500/30';
      case PayrollStatus.PAID:
        return 'bg-blue-500/20 dark:bg-blue-500/30 text-blue-700 dark:text-blue-400 border-2 border-blue-300/50 dark:border-blue-500/30';
      case PayrollStatus.REJECTED:
        return 'bg-red-500/20 dark:bg-red-500/30 text-red-700 dark:text-red-400 border-2 border-red-300/50 dark:border-red-500/30';
      case PayrollStatus.PENDING:
      default:
        return 'bg-yellow-500/20 dark:bg-yellow-500/30 text-yellow-700 dark:text-yellow-400 border-2 border-yellow-300/50 dark:border-yellow-500/30';
    }
  };

  const handlePreviousMonth = () => {
    const newDate = new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1);
    setCurrentDate(newDate);
    if (onMonthChange) {
      onMonthChange(newDate.getMonth() + 1, newDate.getFullYear());
    }
  };

  const handleNextMonth = () => {
    const newDate = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1);
    setCurrentDate(newDate);
    if (onMonthChange) {
      onMonthChange(newDate.getMonth() + 1, newDate.getFullYear());
    }
  };

  const handleDateClick = (date: Date) => {
    const payroll = getPayrollForDate(date);
    if (onDateClick) {
      onDateClick(payroll, date);
    }
  };

  // Generate calendar days
  const calendarDays: (Date | null)[] = [];
  
  // Add empty cells for days before month starts
  for (let i = 0; i < adjustedStartDay; i++) {
    calendarDays.push(null);
  }
  
  // Add all days of the month
  for (let i = 1; i <= daysInMonth; i++) {
    calendarDays.push(new Date(currentDate.getFullYear(), currentDate.getMonth(), i));
  }

  // Check if there are hours but no earnings (indicates missing hourly rate)
  const hasHoursButNoEarnings = React.useMemo(() => {
    if (!dailyEarnings || Object.keys(dailyEarnings).length === 0) return false;
    const daysWithHours = Object.entries(dailyEarnings).filter(([_, data]: [string, any]) => (data?.hours ?? 0) > 0);
    const daysWithEarnings = Object.entries(dailyEarnings).filter(([_, data]: [string, any]) => (data?.earnings ?? 0) > 0);
    return daysWithHours.length > 0 && daysWithEarnings.length === 0;
  }, [dailyEarnings]);

  return (
    <Card className="shadow-sm">
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-xl font-bold">Payroll Calendar</CardTitle>
            <p className="text-xs text-muted-foreground mt-1">View your daily earnings and hours</p>
          </div>
          <div className="flex items-center gap-2">
            <Button 
              variant="outline" 
              size="sm" 
              onClick={handlePreviousMonth}
              className="hover:bg-muted/50 dark:hover:bg-muted transition-colors"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-sm font-semibold min-w-[140px] text-center text-foreground">
              {format(currentDate, 'MMMM yyyy')}
            </span>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={handleNextMonth}
              className="hover:bg-muted/50 dark:hover:bg-muted transition-colors"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {hasHoursButNoEarnings && (
          <div className="mb-4 p-3 bg-yellow-500/20 dark:bg-yellow-500/30 border-2 border-yellow-300/50 dark:border-yellow-500/30 rounded-md">
            <div className="flex items-start gap-2">
              <div className="text-yellow-600 dark:text-yellow-400 font-semibold text-sm">⚠️ Notice:</div>
              <div className="text-yellow-700 dark:text-yellow-300 text-sm flex-1">
                Hours are being tracked, but pay amounts are not calculated. This usually means your hourly rate is not set in your employee profile. Please contact your administrator to set your hourly rate so earnings can be calculated.
              </div>
            </div>
          </div>
        )}
        <div className="grid grid-cols-7 gap-2 mb-3">
          {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day) => (
            <div key={day} className="text-center text-xs font-semibold text-muted-foreground uppercase tracking-wider py-2">
              {day}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-2">
          {calendarDays.map((date, index) => {
            if (!date) {
              return <div key={`empty-${index}`} className="aspect-square" aria-hidden="true" />;
            }

            const payroll = getPayrollForDate(date);
            const isCurrentMonth = isSameMonth(date, currentDate);
            const isToday = isSameDay(date, new Date());
            const dayNumber = date.getDate();
            
            // Get daily earnings for this day - check both string and number keys
            const dayEarnings = dailyEarnings?.[dayNumber.toString()] || dailyEarnings?.[dayNumber];

            // Check if we have daily earnings data from the API
            const hasDailyData = dayEarnings !== undefined && dayEarnings !== null;
            const dailyEarningsValue = hasDailyData ? (dayEarnings?.earnings ?? 0) : 0;
            const dailyHoursValue = hasDailyData ? (dayEarnings?.hours ?? 0) : 0;
            const hourlyRate = hasDailyData ? (dayEarnings?.hourlyRate ?? null) : null;
            const overtimeHours = hasDailyData ? (dayEarnings?.overtimeHours ?? 0) : 0;
            const regularHours = hasDailyData ? (dayEarnings?.regularHours ?? dailyHoursValue) : 0;
            
            // Show hours and earnings if they exist (even if earnings is 0, show hours)
            const displayEarnings = dailyEarningsValue;
            const displayHours = dailyHoursValue;
            
            // Show hours if there are any hours worked
            const shouldShowHours = displayHours > 0;
            // Show earnings if there are any earnings (should be calculated for hourly employees)
            const shouldShowEarnings = displayEarnings > 0;
            const hasOvertime = overtimeHours > 0;
            
            // Debug: Log when hours exist but earnings don't (might indicate missing hourly rate)
            if (shouldShowHours && !shouldShowEarnings && hasDailyData) {
              console.log(`Day ${dayNumber}: Has ${displayHours}h but no earnings. Check if user has hourlyRate set.`);
            }

            const hasData = shouldShowHours || shouldShowEarnings;
            
            return (
              <button
                key={date.toISOString()}
                onClick={() => handleDateClick(date)}
                className={`
                  group relative aspect-square p-1.5 text-sm rounded-lg border-2 transition-all duration-300 ease-in-out
                  flex flex-col items-center justify-center min-h-0 overflow-hidden
                  focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2
                  ${!isCurrentMonth ? 'text-muted-foreground border-border bg-muted/30 cursor-not-allowed' : 'text-foreground'}
                  ${isToday ? 'ring-2 ring-primary ring-offset-1 shadow-md' : ''}
                  ${payroll 
                    ? getStatusColor(payroll.status) + ' cursor-pointer hover:shadow-xl hover:z-20 active:scale-100' 
                    : 'border-2 border-border bg-card hover:bg-muted/50 dark:hover:bg-muted hover:shadow-xl hover:z-20 active:scale-100'
                  }
                  ${hasData ? 'hover:bg-gradient-to-br hover:from-blue-500/10 hover:to-green-500/10 dark:hover:from-blue-500/20 dark:hover:to-green-500/20' : ''}
                `}
                title={
                  displayEarnings > 0
                    ? `${format(date, 'MMM d, yyyy')}: ${displayHours > 0 ? `${displayHours.toFixed(2)}h` : ''}${hasOvertime ? ` (${regularHours.toFixed(2)}h reg + ${overtimeHours.toFixed(2)}h OT)` : ''}${hourlyRate ? ` @ $${hourlyRate.toFixed(2)}/hr` : ''} - $${displayEarnings.toFixed(2)}${payroll ? ` (${payroll.status})` : ''}`
                    : hasDailyData && displayHours === 0
                    ? `${format(date, 'MMM d, yyyy')}: No attendance${payroll ? ` - Monthly payroll: $${Math.abs(payroll.netSalary).toFixed(2)} (${payroll.status})` : ''}`
                    : payroll
                    ? `${format(date, 'MMM d, yyyy')}: ${payroll.status} - Monthly: $${Math.abs(payroll.netSalary).toFixed(2)}`
                    : format(date, 'MMM d, yyyy')
                }
              >
                {/* Date Number - Always Visible */}
                <div className={`
                  font-bold text-sm transition-all duration-300
                  ${isToday ? 'text-primary' : ''}
                  ${hasData ? 'group-hover:opacity-0 group-hover:scale-0' : ''}
                `}>
                  {format(date, 'd')}
                </div>
                
                {/* Hours and Earnings - Revealed on Hover */}
                {(shouldShowHours || shouldShowEarnings) && (
                  <div className={`
                    absolute inset-0 flex flex-col items-center justify-between px-1.5 py-1.5
                    opacity-0 group-hover:opacity-100
                    transition-all duration-300 ease-in-out
                    overflow-hidden
                    bg-gradient-to-br from-blue-500/10 via-purple-500/10 to-green-500/10 
                    dark:from-blue-500/20 dark:via-purple-500/20 dark:to-green-500/20
                    backdrop-blur-sm rounded-lg border-2 border-primary/30 dark:border-primary/50
                    shadow-lg
                  `}>
                    {/* Top Section - Hours */}
                    {shouldShowHours && (
                      <div className="flex flex-col items-center w-full min-w-0 flex-shrink-0">
                        <div className="text-xs font-bold text-blue-500 dark:text-blue-400 leading-none">
                          {displayHours % 1 === 0 
                            ? `${displayHours.toFixed(0)}h` 
                            : `${displayHours.toFixed(1)}h`}
                        </div>
                        {hasOvertime && (
                          <div className="text-[9px] text-orange-500 dark:text-orange-400 font-semibold leading-tight mt-0.5">
                            {overtimeHours.toFixed(1)}h OT
                          </div>
                        )}
                      </div>
                    )}
                    
                    {/* Middle Section - Hourly Rate */}
                    {hourlyRate && (
                      <div className="text-[9px] text-muted-foreground leading-tight flex-shrink-0 my-0.5 px-1">
                        ${hourlyRate.toFixed(2)}/hr
                      </div>
                    )}
                    
                    {/* Bottom Section - Total Pay */}
                    {shouldShowEarnings && (
                      <div className="flex flex-col items-center w-full min-w-0 flex-shrink-0 mt-auto">
                        <div className="text-[8px] text-muted-foreground font-medium uppercase tracking-wide mb-0.5 leading-tight">
                          PAY
                        </div>
                        <div className="text-xs font-bold text-green-500 dark:text-green-400 leading-none">
                          {displayEarnings % 1 === 0 
                            ? `$${displayEarnings.toFixed(0)}` 
                            : `$${displayEarnings.toFixed(2)}`}
                        </div>
                      </div>
                    )}
                  </div>
                )}
                
                {/* Subtle indicator for days with data */}
                {hasData && (
                  <div className="absolute top-1.5 right-1.5 flex gap-0.5">
                    <div className="w-1.5 h-1.5 rounded-full bg-blue-500 opacity-70 group-hover:opacity-0 transition-opacity duration-300 shadow-sm" />
                    {hasOvertime && (
                      <div className="w-1.5 h-1.5 rounded-full bg-orange-500 opacity-70 group-hover:opacity-0 transition-opacity duration-300 shadow-sm" />
                    )}
                  </div>
                )}
              </button>
            );
          })}
        </div>
        <div className="mt-6 pt-4 border-t-2 border-border">
          <div className="flex flex-wrap items-center justify-between gap-4 text-xs">
            <div className="flex flex-wrap gap-4">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded border-2 bg-yellow-500/20 dark:bg-yellow-500/30 border-yellow-300/50 dark:border-yellow-500/30 shadow-sm" />
                <span className="text-muted-foreground font-medium">Pending</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded border-2 bg-green-500/20 dark:bg-green-500/30 border-green-300/50 dark:border-green-500/30 shadow-sm" />
                <span className="text-muted-foreground font-medium">Approved</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded border-2 bg-blue-500/20 dark:bg-blue-500/30 border-blue-300/50 dark:border-blue-500/30 shadow-sm" />
                <span className="text-muted-foreground font-medium">Paid</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded border-2 bg-red-500/20 dark:bg-red-500/30 border-red-300/50 dark:border-red-500/30 shadow-sm" />
                <span className="text-muted-foreground font-medium">Rejected</span>
              </div>
            </div>
            {dailyEarnings && Object.keys(dailyEarnings).length > 0 && (
              <div className="flex items-center gap-2 text-muted-foreground">
                <div className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
                <span className="italic text-xs">Hover over dates to view hours & pay</span>
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}









