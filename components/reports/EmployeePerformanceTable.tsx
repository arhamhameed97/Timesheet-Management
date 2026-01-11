'use client';

import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Search, ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface EmployeePerformanceTableProps {
  employeeBreakdown: Array<{
    employeeId: string;
    name: string;
    daysPresent: number;
    daysAbsent: number;
    attendanceRate: number;
    totalHours: number;
  }>;
  type: 'attendance' | 'timesheet';
  timesheetData?: Array<{
    employeeId: string;
    name: string;
    totalHours: number;
    regularHours: number;
    overtimeHours: number;
    totalEarnings: number;
    statusCounts: Record<string, number>;
  }>;
}

type SortField = 'name' | 'daysPresent' | 'daysAbsent' | 'attendanceRate' | 'totalHours' | 'totalEarnings' | 'regularHours' | 'overtimeHours';
type SortDirection = 'asc' | 'desc';

export function EmployeePerformanceTable({ 
  employeeBreakdown, 
  type,
  timesheetData = []
}: EmployeePerformanceTableProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [sortField, setSortField] = useState<SortField>('name');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const filteredAndSortedData = useMemo(() => {
    let data: Array<any> = type === 'attendance' 
      ? employeeBreakdown 
      : timesheetData.map(ts => ({
          employeeId: ts.employeeId,
          name: ts.name,
          totalHours: ts.totalHours,
          regularHours: ts.regularHours,
          overtimeHours: ts.overtimeHours,
          totalEarnings: ts.totalEarnings,
          statusCounts: ts.statusCounts,
        }));

    // Filter by search query
    if (searchQuery) {
      data = data.filter((emp: any) => 
        emp.name.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    // Sort data
    data.sort((a: any, b: any) => {
      let aValue: number | string = a[sortField as keyof typeof a] as number | string;
      let bValue: number | string = b[sortField as keyof typeof b] as number | string;

      if (typeof aValue === 'string' && typeof bValue === 'string') {
        return sortDirection === 'asc' 
          ? aValue.localeCompare(bValue)
          : bValue.localeCompare(aValue);
      }

      if (typeof aValue === 'number' && typeof bValue === 'number') {
        return sortDirection === 'asc' ? aValue - bValue : bValue - aValue;
      }

      return 0;
    });

    return data;
  }, [employeeBreakdown, timesheetData, type, searchQuery, sortField, sortDirection]);

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) {
      return <ArrowUpDown className="h-4 w-4 ml-1 opacity-50" />;
    }
    return sortDirection === 'asc' 
      ? <ArrowUp className="h-4 w-4 ml-1" />
      : <ArrowDown className="h-4 w-4 ml-1" />;
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>
            {type === 'attendance' ? 'Employee Attendance Breakdown' : 'Employee Timesheet Breakdown'}
          </CardTitle>
          <div className="relative w-64">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search employees..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8"
            />
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {filteredAndSortedData.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            {searchQuery ? 'No employees found matching your search.' : 'No data available.'}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleSort('name')}
                      className="h-8 px-2"
                    >
                      Employee Name
                      <SortIcon field="name" />
                    </Button>
                  </TableHead>
                  {type === 'attendance' ? (
                    <>
                      <TableHead>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleSort('daysPresent')}
                          className="h-8 px-2"
                        >
                          Days Present
                          <SortIcon field="daysPresent" />
                        </Button>
                      </TableHead>
                      <TableHead>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleSort('daysAbsent')}
                          className="h-8 px-2"
                        >
                          Days Absent
                          <SortIcon field="daysAbsent" />
                        </Button>
                      </TableHead>
                      <TableHead>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleSort('attendanceRate')}
                          className="h-8 px-2"
                        >
                          Attendance Rate
                          <SortIcon field="attendanceRate" />
                        </Button>
                      </TableHead>
                      <TableHead>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleSort('totalHours')}
                          className="h-8 px-2"
                        >
                          Total Hours
                          <SortIcon field="totalHours" />
                        </Button>
                      </TableHead>
                    </>
                  ) : (
                    <>
                      <TableHead>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleSort('totalHours')}
                          className="h-8 px-2"
                        >
                          Total Hours
                          <SortIcon field="totalHours" />
                        </Button>
                      </TableHead>
                      <TableHead>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleSort('regularHours')}
                          className="h-8 px-2"
                        >
                          Regular Hours
                          <SortIcon field="regularHours" />
                        </Button>
                      </TableHead>
                      <TableHead>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleSort('overtimeHours')}
                          className="h-8 px-2"
                        >
                          Overtime Hours
                          <SortIcon field="overtimeHours" />
                        </Button>
                      </TableHead>
                      <TableHead>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleSort('totalEarnings')}
                          className="h-8 px-2"
                        >
                          Total Earnings
                          <SortIcon field="totalEarnings" />
                        </Button>
                      </TableHead>
                      <TableHead>Status Breakdown</TableHead>
                    </>
                  )}
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredAndSortedData.map((employee) => (
                  <TableRow key={employee.employeeId}>
                    <TableCell className="font-medium">{employee.name}</TableCell>
                    {type === 'attendance' ? (
                      <>
                        <TableCell>{employee.daysPresent}</TableCell>
                        <TableCell>{employee.daysAbsent}</TableCell>
                        <TableCell>
                          <span className={`font-semibold ${
                            employee.attendanceRate >= 90 ? 'text-green-600' :
                            employee.attendanceRate >= 70 ? 'text-yellow-600' :
                            'text-red-600'
                          }`}>
                            {employee.attendanceRate.toFixed(1)}%
                          </span>
                        </TableCell>
                        <TableCell>{employee.totalHours.toFixed(2)}h</TableCell>
                      </>
                    ) : (
                      <>
                        <TableCell>{employee.totalHours.toFixed(2)}h</TableCell>
                        <TableCell>{employee.regularHours.toFixed(2)}h</TableCell>
                        <TableCell>{employee.overtimeHours.toFixed(2)}h</TableCell>
                        <TableCell className="font-semibold">
                          {formatCurrency(employee.totalEarnings)}
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-2 flex-wrap">
                            {Object.entries(employee.statusCounts).map(([status, count]) => {
                              const countValue = count as number;
                              return countValue > 0 && (
                                <span
                                  key={status}
                                  className={`px-2 py-1 text-xs rounded-full ${
                                    status === 'approved' ? 'bg-green-100 text-green-800' :
                                    status === 'submitted' ? 'bg-yellow-100 text-yellow-800' :
                                    status === 'draft' ? 'bg-gray-100 text-gray-800' :
                                    'bg-red-100 text-red-800'
                                  }`}
                                >
                                  {status}: {countValue}
                                </span>
                              );
                            })}
                          </div>
                        </TableCell>
                      </>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
