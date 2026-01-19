'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Clock,
  Users,
  CheckSquare,
  Building2,
  Search,
  RefreshCw,
  CheckCircle,
  XCircle,
} from 'lucide-react';
import { format, differenceInSeconds, parseISO } from 'date-fns';
import { TaskStatus, TaskPriority } from '@prisma/client';
import { RoleBadge } from '@/components/common/RoleBadge';
import { getPSTDateString } from '@/lib/pst-timezone';

interface ClockedInUser {
  id: string;
  name: string;
  email: string;
  role: string;
  designation?: {
    id: string;
    name: string;
  } | null;
  company?: {
    id: string;
    name: string;
  } | null;
  checkInTime: string;
  timeSinceCheckIn: string;
  hoursSinceCheckIn: number;
  minutesSinceCheckIn: number;
}

interface AttendanceRecord {
  id: string;
  name: string;
  email: string;
  role: string;
  company?: {
    id: string;
    name: string;
  } | null;
  attendanceStats?: {
    todayStatus: {
      checkedIn: boolean;
      checkedOut: boolean;
      checkInTime: string | null;
      checkOutTime: string | null;
      status: string | null;
    };
  };
}

interface Task {
  id: string;
  title: string;
  description: string | null;
  dueDate: string;
  priority: TaskPriority;
  status: TaskStatus;
  creator: {
    id: string;
    name: string;
    email: string;
    company?: {
      id: string;
      name: string;
    } | null;
  };
  assignees: {
    id: string;
    userId: string;
    user: {
      id: string;
      name: string;
      email: string;
      company?: {
        id: string;
        name: string;
      } | null;
    };
  }[];
  createdAt: string;
}

interface SystemOverviewProps {
  companyContext: { id: string; name: string } | null;
}

export function SystemOverview({ companyContext }: SystemOverviewProps) {
  const [clockedInUsers, setClockedInUsers] = useState<ClockedInUser[]>([]);
  const [recentAttendance, setRecentAttendance] = useState<AttendanceRecord[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState({
    clockedIn: false,
    attendance: false,
    tasks: false,
  });
  const [selectedDate, setSelectedDate] = useState<string>(getPSTDateString());
  const [searchTerm, setSearchTerm] = useState('');
  const [taskStatusFilter, setTaskStatusFilter] = useState<string>('all');
  const [currentTime, setCurrentTime] = useState<Date>(new Date());

  useEffect(() => {
    fetchClockedInUsers();
    fetchRecentAttendance();
    fetchTasks();
  }, [companyContext]);

  // Refresh clocked-in users every minute
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(new Date());
      fetchClockedInUsers();
    }, 60000); // Every minute

    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    fetchRecentAttendance();
  }, [selectedDate]);

  useEffect(() => {
    fetchTasks();
  }, [taskStatusFilter, companyContext]);

  // Listen for company context changes
  useEffect(() => {
    const handleCompanyContextChange = () => {
      setTimeout(() => {
        fetchClockedInUsers();
        fetchRecentAttendance();
        fetchTasks();
      }, 100);
    };

    window.addEventListener('companyContextChanged', handleCompanyContextChange);

    return () => {
      window.removeEventListener('companyContextChanged', handleCompanyContextChange);
    };
  }, []);

  const fetchClockedInUsers = async () => {
    try {
      setLoading((prev) => ({ ...prev, clockedIn: true }));
      const token = localStorage.getItem('token');
      const response = await fetch('/api/dashboard/clocked-in', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
        credentials: 'include', // Include cookies for company context
      });

      if (response.ok) {
        const data = await response.json();
        setClockedInUsers(data.clockedInUsers || []);
      }
    } catch (error) {
      console.error('Failed to fetch clocked-in users:', error);
    } finally {
      setLoading((prev) => ({ ...prev, clockedIn: false }));
    }
  };

  const fetchRecentAttendance = async () => {
    try {
      setLoading((prev) => ({ ...prev, attendance: true }));
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/super-admin/attendance?date=${selectedDate}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
        credentials: 'include',
      });

      if (response.ok) {
        const data = await response.json();
        setRecentAttendance(data.attendance || []);
      }
    } catch (error) {
      console.error('Failed to fetch attendance:', error);
    } finally {
      setLoading((prev) => ({ ...prev, attendance: false }));
    }
  };

  const fetchTasks = async () => {
    try {
      setLoading((prev) => ({ ...prev, tasks: true }));
      const token = localStorage.getItem('token');
      let url = '/api/super-admin/tasks';
      if (taskStatusFilter !== 'all') {
        url += `?status=${taskStatusFilter}`;
      }

      const response = await fetch(url, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
        credentials: 'include',
      });

      if (response.ok) {
        const data = await response.json();
        setTasks(data.tasks || []);
      }
    } catch (error) {
      console.error('Failed to fetch tasks:', error);
    } finally {
      setLoading((prev) => ({ ...prev, tasks: false }));
    }
  };

  const calculateShiftTime = (checkInTime: string) => {
    const checkIn = parseISO(checkInTime);
    const secondsSinceCheckIn = differenceInSeconds(currentTime, checkIn);
    const hours = Math.floor(secondsSinceCheckIn / 3600);
    const minutes = Math.floor((secondsSinceCheckIn % 3600) / 60);
    return `${hours}h ${minutes}m`;
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const getTaskStatusBadge = (status: TaskStatus) => {
    switch (status) {
      case TaskStatus.PENDING:
        return <Badge variant="outline">Pending</Badge>;
      case TaskStatus.IN_PROGRESS:
        return <Badge className="bg-blue-600">In Progress</Badge>;
      case TaskStatus.COMPLETED:
        return <Badge className="bg-yellow-600">Completed</Badge>;
      case TaskStatus.APPROVED:
        return <Badge className="bg-green-600">Approved</Badge>;
      case TaskStatus.CANCELLED:
        return <Badge variant="destructive">Cancelled</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getTaskPriorityBadge = (priority: TaskPriority) => {
    switch (priority) {
      case TaskPriority.HIGH:
        return <Badge variant="destructive">High</Badge>;
      case TaskPriority.MEDIUM:
        return <Badge className="bg-yellow-600">Medium</Badge>;
      case TaskPriority.LOW:
        return <Badge className="bg-green-600">Low</Badge>;
      default:
        return <Badge variant="outline">{priority}</Badge>;
    }
  };

  // Filter data based on search term
  const filteredClockedIn = clockedInUsers.filter(
    (user) =>
      user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.company?.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredAttendance = recentAttendance.filter(
    (record) =>
      record.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      record.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      record.company?.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredTasks = tasks.filter(
    (task) =>
      task.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      task.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      task.creator.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      task.assignees.some((a) =>
        a.user.name.toLowerCase().includes(searchTerm.toLowerCase())
      )
  );

  return (
    <div className="space-y-6">
      {/* Search and Filters */}
      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <label className="text-sm font-medium">Search</label>
              <div className="relative">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search across all data..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-8"
                />
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Attendance Date</label>
              <Input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Task Status</label>
              <Select value={taskStatusFilter} onValueChange={setTaskStatusFilter}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value={TaskStatus.PENDING}>Pending</SelectItem>
                  <SelectItem value={TaskStatus.IN_PROGRESS}>In Progress</SelectItem>
                  <SelectItem value={TaskStatus.COMPLETED}>Completed</SelectItem>
                  <SelectItem value={TaskStatus.APPROVED}>Approved</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tabs for different views */}
      <Tabs defaultValue="clocked-in" className="space-y-4">
        <TabsList>
          <TabsTrigger value="clocked-in">
            <Clock className="h-4 w-4 mr-2" />
            Clocked In ({filteredClockedIn.length})
          </TabsTrigger>
          <TabsTrigger value="attendance">
            <Users className="h-4 w-4 mr-2" />
            Attendance ({filteredAttendance.length})
          </TabsTrigger>
          <TabsTrigger value="tasks">
            <CheckSquare className="h-4 w-4 mr-2" />
            Tasks ({filteredTasks.length})
          </TabsTrigger>
        </TabsList>

        {/* Clocked In Users Tab */}
        <TabsContent value="clocked-in" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Currently Clocked In Users</CardTitle>
                <Button onClick={fetchClockedInUsers} variant="outline" size="sm">
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Refresh
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {loading.clockedIn ? (
                <div className="text-center py-8">Loading...</div>
              ) : filteredClockedIn.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No users currently clocked in.
                </div>
              ) : (
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>User</TableHead>
                        <TableHead>Company</TableHead>
                        <TableHead>Role</TableHead>
                        <TableHead>Check-In Time</TableHead>
                        <TableHead>Time Since Check-In</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredClockedIn.map((user) => (
                        <TableRow key={user.id}>
                          <TableCell>
                            <div className="flex items-center gap-3">
                              <Avatar>
                                <AvatarFallback className="bg-primary text-primary-foreground">
                                  {getInitials(user.name)}
                                </AvatarFallback>
                              </Avatar>
                              <div>
                                <div className="font-medium">{user.name}</div>
                                <div className="text-sm text-muted-foreground">
                                  {user.email}
                                </div>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            {user.company ? (
                              <div className="flex items-center gap-2">
                                <Building2 className="h-4 w-4 text-muted-foreground" />
                                <span>{user.company.name}</span>
                              </div>
                            ) : (
                              <span className="text-muted-foreground">-</span>
                            )}
                          </TableCell>
                          <TableCell>
                            <RoleBadge role={user.role as any} />
                          </TableCell>
                          <TableCell>
                            {format(parseISO(user.checkInTime), 'MMM d, yyyy h:mm a')}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className="font-mono">
                              {calculateShiftTime(user.checkInTime)}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Attendance Tab */}
        <TabsContent value="attendance" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Attendance Records - {format(new Date(selectedDate), 'MMM d, yyyy')}</CardTitle>
                <Button onClick={fetchRecentAttendance} variant="outline" size="sm">
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Refresh
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {loading.attendance ? (
                <div className="text-center py-8">Loading...</div>
              ) : filteredAttendance.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No attendance records found for this date.
                </div>
              ) : (
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>User</TableHead>
                        <TableHead>Company</TableHead>
                        <TableHead>Role</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Check-In</TableHead>
                        <TableHead>Check-Out</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredAttendance.map((record) => {
                        const status = record.attendanceStats?.todayStatus;
                        return (
                          <TableRow key={record.id}>
                            <TableCell>
                              <div className="flex items-center gap-3">
                                <Avatar>
                                  <AvatarFallback className="bg-primary text-primary-foreground">
                                    {getInitials(record.name)}
                                  </AvatarFallback>
                                </Avatar>
                                <div>
                                  <div className="font-medium">{record.name}</div>
                                  <div className="text-sm text-muted-foreground">
                                    {record.email}
                                  </div>
                                </div>
                              </div>
                            </TableCell>
                            <TableCell>
                              {record.company ? (
                                <div className="flex items-center gap-2">
                                  <Building2 className="h-4 w-4 text-muted-foreground" />
                                  <span>{record.company.name}</span>
                                </div>
                              ) : (
                                <span className="text-muted-foreground">-</span>
                              )}
                            </TableCell>
                            <TableCell>
                              <RoleBadge role={record.role as any} />
                            </TableCell>
                            <TableCell>
                              {status?.checkedIn ? (
                                <Badge className="bg-green-600">
                                  <CheckCircle className="h-3 w-3 mr-1" />
                                  {status.status || 'Present'}
                                </Badge>
                              ) : (
                                <Badge variant="outline">
                                  <XCircle className="h-3 w-3 mr-1" />
                                  Not Checked In
                                </Badge>
                              )}
                            </TableCell>
                            <TableCell>
                              {status?.checkInTime
                                ? format(parseISO(status.checkInTime), 'h:mm a')
                                : '-'}
                            </TableCell>
                            <TableCell>
                              {status?.checkOutTime
                                ? format(parseISO(status.checkOutTime), 'h:mm a')
                                : status?.checkedIn
                                ? 'Still In'
                                : '-'}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tasks Tab */}
        <TabsContent value="tasks" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Tasks</CardTitle>
                <Button onClick={fetchTasks} variant="outline" size="sm">
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Refresh
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {loading.tasks ? (
                <div className="text-center py-8">Loading...</div>
              ) : filteredTasks.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No tasks found.
                </div>
              ) : (
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Task</TableHead>
                        <TableHead>Company</TableHead>
                        <TableHead>Created By</TableHead>
                        <TableHead>Assignees</TableHead>
                        <TableHead>Priority</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Due Date</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredTasks.map((task) => (
                        <TableRow key={task.id}>
                          <TableCell>
                            <div>
                              <div className="font-medium">{task.title}</div>
                              {task.description && (
                                <div className="text-sm text-muted-foreground line-clamp-1">
                                  {task.description}
                                </div>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            {task.creator.company ? (
                              <div className="flex items-center gap-2">
                                <Building2 className="h-4 w-4 text-muted-foreground" />
                                <span>{task.creator.company.name}</span>
                              </div>
                            ) : (
                              <span className="text-muted-foreground">-</span>
                            )}
                          </TableCell>
                          <TableCell>
                            <div className="text-sm">
                              <div className="font-medium">{task.creator.name}</div>
                              <div className="text-muted-foreground">
                                {task.creator.email}
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-wrap gap-1">
                              {task.assignees.slice(0, 2).map((assignee) => (
                                <Badge key={assignee.id} variant="outline" className="text-xs">
                                  {assignee.user.name}
                                </Badge>
                              ))}
                              {task.assignees.length > 2 && (
                                <Badge variant="outline" className="text-xs">
                                  +{task.assignees.length - 2}
                                </Badge>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>{getTaskPriorityBadge(task.priority)}</TableCell>
                          <TableCell>{getTaskStatusBadge(task.status)}</TableCell>
                          <TableCell>
                            <span className="text-sm">
                              {format(parseISO(task.dueDate), 'MMM d, yyyy')}
                            </span>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
