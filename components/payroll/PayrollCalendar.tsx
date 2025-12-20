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
}

interface PayrollCalendarProps {
  payrollRecords: PayrollRecord[];
  dailyEarnings?: Record<string, DailyEarnings>; // day -> { hours, earnings }
  onDateClick?: (payroll: PayrollRecord | null, date: Date) => void;
  onMonthChange?: (month: number, year: number) => void;
}

export function PayrollCalendar({ payrollRecords, dailyEarnings, onDateClick, onMonthChange }: PayrollCalendarProps) {
  const [currentDate, setCurrentDate] = useState(new Date());

  // Debug: Log daily earnings when they change
  React.useEffect(() => {
    console.log('PayrollCalendar dailyEarnings prop:', dailyEarnings);
    if (dailyEarnings && Object.keys(dailyEarnings).length > 0) {
      const sampleDays = Object.entries(dailyEarnings).slice(0, 5);
      console.log('Sample daily earnings (first 5 days):', sampleDays);
      // Log actual values
      sampleDays.forEach(([day, data]: [string, any]) => {
        console.log(`Day ${day}: hours=${data.hours}, earnings=${data.earnings}`);
      });
      // Check for any days with earnings > 0
      const daysWithEarnings = Object.entries(dailyEarnings).filter(([_, data]: [string, any]) => data.earnings > 0 || data.hours > 0);
      console.log(`Days with earnings/hours > 0: ${daysWithEarnings.length} out of ${Object.keys(dailyEarnings).length}`);
    } else {
      console.log('No daily earnings data received');
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
        return 'bg-green-100 text-green-800 border-green-300';
      case PayrollStatus.PAID:
        return 'bg-blue-100 text-blue-800 border-blue-300';
      case PayrollStatus.REJECTED:
        return 'bg-red-100 text-red-800 border-red-300';
      case PayrollStatus.PENDING:
      default:
        return 'bg-yellow-100 text-yellow-800 border-yellow-300';
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

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Payroll Calendar</CardTitle>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={handlePreviousMonth}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-sm font-medium min-w-[120px] text-center">
              {format(currentDate, 'MMMM yyyy')}
            </span>
            <Button variant="outline" size="sm" onClick={handleNextMonth}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-7 gap-1 mb-2">
          {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day) => (
            <div key={day} className="text-center text-sm font-medium text-gray-600 p-2">
              {day}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-1">
          {calendarDays.map((date, index) => {
            if (!date) {
              return <div key={`empty-${index}`} className="aspect-square" />;
            }

            const payroll = getPayrollForDate(date);
            const isCurrentMonth = isSameMonth(date, currentDate);
            const isToday = isSameDay(date, new Date());
            const dayNumber = date.getDate();
            const dayEarnings = dailyEarnings?.[dayNumber.toString()];

            // Check if we have daily earnings data from the API
            const hasDailyData = dayEarnings !== undefined;
            const dailyEarningsValue = hasDailyData ? (dayEarnings?.earnings || 0) : 0;
            const dailyHoursValue = hasDailyData ? (dayEarnings?.hours || 0) : 0;
            
            // ONLY show actual daily earnings from hours worked - NEVER show monthly average
            // The calendar should only display earnings for days when employee actually worked
            const displayEarnings = dailyEarningsValue; // Will be 0 if no attendance
            const displayHours = dailyHoursValue;
            
            // Show earnings if there are any earnings for that day (even if hours is 0, which shouldn't happen)
            // This ensures earnings are displayed whenever available
            const hasWorked = displayHours > 0 && displayEarnings > 0;
            const shouldShowEarnings = displayEarnings > 0; // Show earnings whenever they exist

            return (
              <button
                key={date.toISOString()}
                onClick={() => handleDateClick(date)}
                className={`
                  aspect-square p-1 text-sm rounded-md border transition-colors
                  ${!isCurrentMonth ? 'text-gray-300' : 'text-gray-700'}
                  ${isToday ? 'ring-2 ring-primary' : ''}
                  ${payroll ? getStatusColor(payroll.status) + ' cursor-pointer hover:opacity-80' : 'hover:bg-gray-100'}
                  ${!payroll && isCurrentMonth ? 'border-gray-200' : ''}
                `}
                title={
                  displayEarnings > 0
                    ? `${format(date, 'MMM d, yyyy')}: ${displayHours > 0 ? `${displayHours.toFixed(2)}h - ` : ''}$${displayEarnings.toFixed(2)}${payroll ? ` (${payroll.status})` : ''}`
                    : hasDailyData && displayHours === 0
                    ? `${format(date, 'MMM d, yyyy')}: No attendance${payroll ? ` - Monthly payroll: $${Math.abs(payroll.netSalary).toFixed(2)} (${payroll.status})` : ''}`
                    : payroll
                    ? `${format(date, 'MMM d, yyyy')}: ${payroll.status} - Monthly: $${Math.abs(payroll.netSalary).toFixed(2)}`
                    : format(date, 'MMM d, yyyy')
                }
              >
                <div className="font-medium">{format(date, 'd')}</div>
                {shouldShowEarnings && (
                  <div className="text-xs mt-0.5 truncate font-semibold text-green-700">
                    {(() => {
                      // Show earnings amount with appropriate formatting
                      if (displayEarnings >= 1000) {
                        return `$${(displayEarnings / 1000).toFixed(1)}k`;
                      } else if (displayEarnings >= 100) {
                        return `$${displayEarnings.toFixed(0)}`;
                      } else if (displayEarnings > 0) {
                        // Show 1 decimal place for amounts less than $100
                        return `$${displayEarnings.toFixed(1)}`;
                      }
                      return null;
                    })()}
                  </div>
                )}
              </button>
            );
          })}
        </div>
        <div className="mt-4 flex flex-wrap gap-4 text-xs">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded border bg-yellow-100 border-yellow-300" />
            <span>Pending</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded border bg-green-100 border-green-300" />
            <span>Approved</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded border bg-blue-100 border-blue-300" />
            <span>Paid</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded border bg-red-100 border-red-300" />
            <span>Rejected</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

