'use client';

import { useState, useEffect } from 'react';
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
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Plus, Edit, Trash2, Clock, FileText, CheckCircle, XCircle, Filter, Search, Calendar, Eye, CheckSquare } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
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
import { CompanyBadge } from '@/components/common/CompanyBadge';
import { UserRole } from '@prisma/client';
import { format, differenceInSeconds } from 'date-fns';

interface Employee {
  id: string;
  name: string;
  email: string;
  role: string;
  designation?: {
    name: string;
  };
  manager?: {
    name: string;
  };
  company?: {
    id: string;
    name: string;
  };
  isActive: boolean;
  attendanceStats?: {
    daysWorkedThisMonth: number;
    todayStatus: {
      checkedIn: boolean;
      checkedOut: boolean;
      status: string | null;
      checkInTime: string | null;
      checkOutTime: string | null;
      notes: string | null;
    };
    pendingTimesheets: number;
  };
}

interface Company {
  id: string;
  name: string;
  email: string;
  isActive: boolean;
}

interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  companyId?: string | null;
  company?: {
    id: string;
    name: string;
  } | null;
}

export default function EmployeesPage() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [filteredEmployees, setFilteredEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [viewAttendanceOpen, setViewAttendanceOpen] = useState(false);
  const [profileModalOpen, setProfileModalOpen] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [profileFormData, setProfileFormData] = useState({
    paymentType: '' as 'HOURLY' | 'SALARY' | '',
    hourlyRate: '',
    monthlySalary: '',
  });
  const [updatingProfile, setUpdatingProfile] = useState(false);
  const [taskDialogOpen, setTaskDialogOpen] = useState(false);
  const [taskFormData, setTaskFormData] = useState({
    title: '',
    description: '',
    dueDate: '',
    priority: 'MEDIUM' as 'LOW' | 'MEDIUM' | 'HIGH',
    assigneeIds: [] as string[],
  });
  const [creatingTask, setCreatingTask] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all'); // all, checked-in, checked-out, not-checked-in
  const [filterRole, setFilterRole] = useState<string>('all');
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    designationId: '',
    role: 'EMPLOYEE',
    managerId: '',
    companyId: '',
    paymentType: '' as 'HOURLY' | 'SALARY' | '',
    hourlyRate: '',
    monthlySalary: '',
  });

  useEffect(() => {
    fetchUser();
    fetchEmployees();
  }, []);

  useEffect(() => {
    if (user?.role === UserRole.SUPER_ADMIN) {
      fetchCompanies();
    }
  }, [user]);

  const fetchUser = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/auth/me', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setUser(data.user);
        // Set default companyId for non-super-admins
        if (data.user.companyId && data.user.role !== UserRole.SUPER_ADMIN) {
          setFormData(prev => ({ ...prev, companyId: data.user.companyId }));
        }
      }
    } catch (error) {
      console.error('Failed to fetch user:', error);
    }
  };

  const fetchCompanies = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/companies', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setCompanies(data.companies || []);
      }
    } catch (error) {
      console.error('Failed to fetch companies:', error);
    }
  };

  const fetchEmployees = async () => {
    try {
      const token = localStorage.getItem('token');
      // Include today's date to get attendance stats
      const today = format(new Date(), 'yyyy-MM-dd');
      const response = await fetch(`/api/employees?attendanceDate=${today}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setEmployees(data.employees || []);
        setFilteredEmployees(data.employees || []);
      }
    } catch (error) {
      console.error('Failed to fetch employees:', error);
    } finally {
      setLoading(false);
    }
  };

  // Filter employees based on search and filters
  useEffect(() => {
    let filtered = [...employees];

    // Search filter
    if (searchTerm) {
      filtered = filtered.filter(emp =>
        emp.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        emp.email.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Status filter
    if (filterStatus !== 'all') {
      filtered = filtered.filter(emp => {
        const status = emp.attendanceStats?.todayStatus;
        if (!status) return filterStatus === 'not-checked-in';
        
        if (filterStatus === 'checked-in') {
          return status.checkedIn && !status.checkedOut;
        }
        if (filterStatus === 'checked-out') {
          return status.checkedOut;
        }
        if (filterStatus === 'not-checked-in') {
          return !status.checkedIn;
        }
        return true;
      });
    }

    // Role filter
    if (filterRole !== 'all') {
      filtered = filtered.filter(emp => emp.role === filterRole);
    }

    setFilteredEmployees(filtered);
  }, [employees, searchTerm, filterStatus, filterRole]);

  const formatTime = (dateString: string | null) => {
    if (!dateString) return '-';
    return format(new Date(dateString), 'HH:mm:ss');
  };

  const formatDateTime = (dateString: string | null) => {
    if (!dateString) return '-';
    return format(new Date(dateString), 'MMM dd, yyyy HH:mm:ss');
  };

  const calculateWorkTime = (checkInTime: string | null, checkOutTime: string | null) => {
    if (!checkInTime) return '-';
    if (!checkOutTime) {
      // Calculate from check-in to now
      const checkIn = new Date(checkInTime);
      const now = new Date();
      const seconds = differenceInSeconds(now, checkIn);
      const hours = Math.floor(seconds / 3600);
      const minutes = Math.floor((seconds % 3600) / 60);
      return `${hours}h ${minutes}m`;
    }
    const checkIn = new Date(checkInTime);
    const checkOut = new Date(checkOutTime);
    const seconds = differenceInSeconds(checkOut, checkIn);
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return `${hours}h ${minutes}m`;
  };

  const parseAttendanceHistory = (notes: string | null) => {
    if (!notes) return [];
    try {
      const data = JSON.parse(notes);
      return data.checkInOutHistory || [];
    } catch {
      return [];
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const token = localStorage.getItem('token');
      
      // Prepare request body - only include companyId for super admins
      const requestBody: any = {
        name: formData.name,
        email: formData.email,
        password: formData.password,
        role: formData.role,
      };
      
      // Add optional fields only if they have values
      if (formData.designationId) {
        requestBody.designationId = formData.designationId;
      }
      if (formData.managerId) {
        requestBody.managerId = formData.managerId;
      }
      if (formData.paymentType) {
        requestBody.paymentType = formData.paymentType;
      }
      if (formData.hourlyRate) {
        requestBody.hourlyRate = parseFloat(formData.hourlyRate);
      }
      if (formData.monthlySalary) {
        requestBody.monthlySalary = parseFloat(formData.monthlySalary);
      }
      
      // Only include companyId for super admins
      if (user?.role === UserRole.SUPER_ADMIN && formData.companyId) {
        requestBody.companyId = formData.companyId;
      }
      
      const response = await fetch('/api/employees', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      if (response.ok) {
        const data = await response.json();
        setOpen(false);
        setFormData({
          name: '',
          email: '',
          password: '',
          designationId: '',
          role: 'EMPLOYEE',
          managerId: '',
          companyId: user?.companyId || '',
          paymentType: '' as '' | 'HOURLY' | 'SALARY',
          hourlyRate: '',
          monthlySalary: '',
        });
        fetchEmployees();
        // Show success message
        alert(data.message || 'Employee created successfully');
      } else {
        const data = await response.json();
        alert(data.error || 'Failed to create employee');
      }
    } catch (error) {
      console.error('Failed to create employee:', error);
      alert('Failed to create employee');
    }
  };

  const handleUpdateProfile = async () => {
    if (!selectedEmployee) return;
    
    try {
      setUpdatingProfile(true);
      const token = localStorage.getItem('token');
      
      const requestBody: any = {};
      
      if (profileFormData.paymentType) {
        requestBody.paymentType = profileFormData.paymentType;
      }
      if (profileFormData.hourlyRate) {
        requestBody.hourlyRate = parseFloat(profileFormData.hourlyRate);
      }
      if (profileFormData.monthlySalary) {
        requestBody.monthlySalary = parseFloat(profileFormData.monthlySalary);
      }
      
      // If payment type changed, clear the other field
      if (profileFormData.paymentType === 'HOURLY') {
        requestBody.monthlySalary = null;
      } else if (profileFormData.paymentType === 'SALARY') {
        requestBody.hourlyRate = null;
      }
      
      const response = await fetch(`/api/employees/${selectedEmployee.id}`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      if (response.ok) {
        setProfileModalOpen(false);
        fetchEmployees();
        alert('Employee profile updated successfully');
      } else {
        const data = await response.json();
        alert(data.error || 'Failed to update employee profile');
      }
    } catch (error) {
      console.error('Failed to update employee profile:', error);
      alert('Failed to update employee profile');
    } finally {
      setUpdatingProfile(false);
    }
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Employees</h1>
            <p className="text-gray-600 mt-1">Manage your team members</p>
          </div>
          <div className="flex gap-2">
            {(user?.role === UserRole.MANAGER || user?.role === UserRole.COMPANY_ADMIN || user?.role === UserRole.SUPER_ADMIN) && (
              <Dialog open={taskDialogOpen} onOpenChange={setTaskDialogOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline">
                    <CheckSquare className="mr-2 h-4 w-4" />
                    Assign Task
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-2xl">
                  <DialogHeader>
                    <DialogTitle>Assign New Task</DialogTitle>
                    <DialogDescription>
                      Create a task and assign it to one or more employees
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="taskTitle">Title *</Label>
                      <Input
                        id="taskTitle"
                        value={taskFormData.title}
                        onChange={(e) => setTaskFormData({ ...taskFormData, title: e.target.value })}
                        placeholder="Enter task title"
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="taskDescription">Description</Label>
                      <Textarea
                        id="taskDescription"
                        value={taskFormData.description}
                        onChange={(e) => setTaskFormData({ ...taskFormData, description: e.target.value })}
                        placeholder="Enter task description"
                        rows={3}
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="taskDueDate">Due Date *</Label>
                        <Input
                          id="taskDueDate"
                          type="date"
                          value={taskFormData.dueDate}
                          onChange={(e) => setTaskFormData({ ...taskFormData, dueDate: e.target.value })}
                          required
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="taskPriority">Priority</Label>
                        <Select
                          value={taskFormData.priority}
                          onValueChange={(value) => setTaskFormData({ ...taskFormData, priority: value as 'LOW' | 'MEDIUM' | 'HIGH' })}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="LOW">Low</SelectItem>
                            <SelectItem value="MEDIUM">Medium</SelectItem>
                            <SelectItem value="HIGH">High</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label>Assign To *</Label>
                      <div className="max-h-48 overflow-y-auto border rounded p-2 space-y-2">
                        {employees.filter(e => e.isActive).map((emp) => (
                          <div key={emp.id} className="flex items-center space-x-2">
                            <input
                              type="checkbox"
                              id={`assignee-${emp.id}`}
                              checked={taskFormData.assigneeIds.includes(emp.id)}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setTaskFormData({
                                    ...taskFormData,
                                    assigneeIds: [...taskFormData.assigneeIds, emp.id],
                                  });
                                } else {
                                  setTaskFormData({
                                    ...taskFormData,
                                    assigneeIds: taskFormData.assigneeIds.filter(id => id !== emp.id),
                                  });
                                }
                              }}
                            />
                            <label htmlFor={`assignee-${emp.id}`} className="text-sm cursor-pointer">
                              {emp.name} ({emp.email})
                            </label>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                  <DialogFooter>
                    <Button
                      variant="outline"
                      onClick={() => {
                        setTaskDialogOpen(false);
                        setTaskFormData({
                          title: '',
                          description: '',
                          dueDate: '',
                          priority: 'MEDIUM',
                          assigneeIds: [],
                        });
                      }}
                      disabled={creatingTask}
                    >
                      Cancel
                    </Button>
                    <Button
                      onClick={async () => {
                        if (!taskFormData.title || !taskFormData.dueDate || taskFormData.assigneeIds.length === 0) {
                          alert('Please fill in all required fields');
                          return;
                        }
                        try {
                          setCreatingTask(true);
                          const token = localStorage.getItem('token');
                          const response = await fetch('/api/tasks/assignments', {
                            method: 'POST',
                            headers: {
                              Authorization: `Bearer ${token}`,
                              'Content-Type': 'application/json',
                            },
                            body: JSON.stringify(taskFormData),
                          });

                          if (response.ok) {
                            setTaskDialogOpen(false);
                            setTaskFormData({
                              title: '',
                              description: '',
                              dueDate: '',
                              priority: 'MEDIUM',
                              assigneeIds: [],
                            });
                            alert('Task assigned successfully');
                          } else {
                            const data = await response.json();
                            alert(data.error || 'Failed to assign task');
                          }
                        } catch (error) {
                          console.error('Failed to assign task:', error);
                          alert('Failed to assign task');
                        } finally {
                          setCreatingTask(false);
                        }
                      }}
                      disabled={creatingTask || !taskFormData.title || !taskFormData.dueDate || taskFormData.assigneeIds.length === 0}
                    >
                      {creatingTask ? 'Assigning...' : 'Assign Task'}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            )}
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button className="bg-primary hover:bg-primary/90">
                  <Plus className="mr-2 h-4 w-4" />
                  Add Employee
                </Button>
              </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Add New Employee</DialogTitle>
                <DialogDescription>
                  Create a new employee account
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                {/* Company Assignment Section */}
                <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                  <div className="space-y-2">
                    <Label className="text-sm font-semibold text-blue-900">Company Assignment</Label>
                    {user?.role === UserRole.SUPER_ADMIN ? (
                      <>
                        <Select
                          value={formData.companyId}
                          onValueChange={(value) => setFormData({ ...formData, companyId: value })}
                          required
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select company" />
                          </SelectTrigger>
                          <SelectContent>
                            {companies
                              .filter(c => c.isActive)
                              .map((company) => (
                                <SelectItem key={company.id} value={company.id}>
                                  {company.name}
                                </SelectItem>
                              ))}
                          </SelectContent>
                        </Select>
                        <p className="text-xs text-blue-700">
                          Select the company this employee will be assigned to
                        </p>
                      </>
                    ) : (
                      <>
                        <div className="p-2 bg-white rounded border">
                          <div className="flex items-center gap-2">
                            <CompanyBadge company={user?.company || null} />
                            <span className="text-sm text-gray-600">
                              Employee will be assigned to your company
                            </span>
                          </div>
                        </div>
                        <p className="text-xs text-blue-700">
                          Employee will be automatically assigned to: <strong>{user?.company?.name || 'Your company'}</strong>
                        </p>
                      </>
                    )}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="name">Name *</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Email *</Label>
                  <Input
                    id="email"
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">Password *</Label>
                  <Input
                    id="password"
                    type="password"
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    required
                    minLength={6}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="role">Role</Label>
                  <Select
                    value={formData.role}
                    onValueChange={(value) => setFormData({ ...formData, role: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="EMPLOYEE">Employee</SelectItem>
                      <SelectItem value="TEAM_LEAD">Team Lead</SelectItem>
                      <SelectItem value="MANAGER">Manager</SelectItem>
                      <SelectItem value="COMPANY_ADMIN">Company Admin</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                {/* Payment Type Section */}
                <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                  <Label className="text-sm font-semibold text-gray-900 mb-2 block">Payment Information</Label>
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="paymentType">Payment Type</Label>
                      <Select
                        value={formData.paymentType}
                        onValueChange={(value) => setFormData({ ...formData, paymentType: value as 'HOURLY' | 'SALARY', hourlyRate: '', monthlySalary: '' })}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select payment type (optional)" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="HOURLY">Hourly</SelectItem>
                          <SelectItem value="SALARY">Salary</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    {formData.paymentType === 'HOURLY' && (
                      <div className="space-y-2">
                        <Label htmlFor="hourlyRate">Hourly Rate ($) *</Label>
                        <Input
                          id="hourlyRate"
                          type="number"
                          step="0.01"
                          min="0"
                          value={formData.hourlyRate}
                          onChange={(e) => setFormData({ ...formData, hourlyRate: e.target.value })}
                          placeholder="e.g., 25.00"
                          required
                        />
                      </div>
                    )}
                    {formData.paymentType === 'SALARY' && (
                      <div className="space-y-2">
                        <Label htmlFor="monthlySalary">Monthly Salary ($) *</Label>
                        <Input
                          id="monthlySalary"
                          type="number"
                          step="0.01"
                          min="0"
                          value={formData.monthlySalary}
                          onChange={(e) => setFormData({ ...formData, monthlySalary: e.target.value })}
                          placeholder="e.g., 5000.00"
                          required
                        />
                      </div>
                    )}
                  </div>
                </div>
                
                <div className="flex justify-end gap-2">
                  <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                    Cancel
                  </Button>
                  <Button type="submit">Create Employee</Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
          </div>
        </div>

        {/* Filters */}
        <Card>
          <CardHeader>
            <CardTitle>Filters</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Search</Label>
                <div className="relative">
                  <Search className="absolute left-2 top-2.5 h-4 w-4 text-gray-400" />
                  <Input
                    placeholder="Search by name or email..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-8"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Attendance Status</Label>
                <Select value={filterStatus} onValueChange={setFilterStatus}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="checked-in">Checked In</SelectItem>
                    <SelectItem value="checked-out">Checked Out</SelectItem>
                    <SelectItem value="not-checked-in">Not Checked In</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Role</Label>
                <Select value={filterRole} onValueChange={setFilterRole}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Roles</SelectItem>
                    <SelectItem value="EMPLOYEE">Employee</SelectItem>
                    <SelectItem value="TEAM_LEAD">Team Lead</SelectItem>
                    <SelectItem value="MANAGER">Manager</SelectItem>
                    <SelectItem value="COMPANY_ADMIN">Company Admin</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Employee List</CardTitle>
              <div className="text-sm text-gray-500">
                Showing {filteredEmployees.length} of {employees.length} employees
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-center py-8">Loading...</div>
            ) : employees.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                No employees found. Add your first employee to get started.
              </div>
            ) : filteredEmployees.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                No employees match your filters. Try adjusting your search criteria.
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Email</TableHead>
                    {user?.role === UserRole.SUPER_ADMIN && <TableHead>Company</TableHead>}
                    <TableHead>Role</TableHead>
                    <TableHead>Today&apos;s Attendance</TableHead>
                    <TableHead>Check-In Time</TableHead>
                    <TableHead>Check-Out Time</TableHead>
                    <TableHead>Work Time</TableHead>
                    <TableHead>Monthly Stats</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredEmployees.map((employee) => (
                    <TableRow key={employee.id}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <Avatar>
                            <AvatarFallback className="bg-primary text-primary-foreground">
                              {getInitials(employee.name)}
                            </AvatarFallback>
                          </Avatar>
                          <span className="font-medium">{employee.name}</span>
                        </div>
                      </TableCell>
                      <TableCell>{employee.email}</TableCell>
                      {user?.role === UserRole.SUPER_ADMIN && (
                        <TableCell>
                          {employee.company ? (
                            <CompanyBadge company={employee.company} />
                          ) : (
                            <span className="text-gray-400 text-xs">No company</span>
                          )}
                        </TableCell>
                      )}
                      <TableCell>
                        <span className="px-2 py-1 text-xs rounded-full bg-gray-100 text-gray-800">
                          {employee.role.replace('_', ' ')}
                        </span>
                      </TableCell>
                      <TableCell>
                        {employee.attendanceStats?.todayStatus ? (
                          <div className="flex items-center gap-2">
                            {employee.attendanceStats.todayStatus.checkedIn ? (
                              <div className="flex items-center gap-1 text-green-600">
                                <CheckCircle className="h-4 w-4" />
                                <span className="text-xs">
                                  {employee.attendanceStats.todayStatus.checkedOut ? 'Checked Out' : 'Checked In'}
                                </span>
                              </div>
                            ) : (
                              <div className="flex items-center gap-1 text-gray-400">
                                <XCircle className="h-4 w-4" />
                                <span className="text-xs">Not Checked In</span>
                              </div>
                            )}
                          </div>
                        ) : (
                          <span className="text-gray-400 text-xs">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {employee.attendanceStats?.todayStatus?.checkInTime ? (
                          <div className="flex flex-col gap-0.5">
                            <span className="text-xs font-medium text-gray-900">
                              {formatTime(employee.attendanceStats.todayStatus.checkInTime)}
                            </span>
                            <span className="text-xs text-gray-500">
                              {formatDateTime(employee.attendanceStats.todayStatus.checkInTime).split(' ')[0]}
                            </span>
                          </div>
                        ) : (
                          <span className="text-gray-400 text-xs">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {employee.attendanceStats?.todayStatus?.checkOutTime ? (
                          <div className="flex flex-col gap-0.5">
                            <span className="text-xs font-medium text-gray-900">
                              {formatTime(employee.attendanceStats.todayStatus.checkOutTime)}
                            </span>
                            <span className="text-xs text-gray-500">
                              {formatDateTime(employee.attendanceStats.todayStatus.checkOutTime).split(' ')[0]}
                            </span>
                          </div>
                        ) : employee.attendanceStats?.todayStatus?.checkedIn && !employee.attendanceStats?.todayStatus?.checkedOut ? (
                          <span className="text-xs text-blue-600 font-medium">In Progress</span>
                        ) : (
                          <span className="text-gray-400 text-xs">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {employee.attendanceStats?.todayStatus?.checkInTime ? (
                          <div className="flex items-center gap-1 text-xs text-gray-700">
                            <Clock className="h-3 w-3" />
                            <span className="font-medium">
                              {calculateWorkTime(
                                employee.attendanceStats.todayStatus.checkInTime,
                                employee.attendanceStats.todayStatus.checkOutTime
                              )}
                            </span>
                          </div>
                        ) : (
                          <span className="text-gray-400 text-xs">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {employee.attendanceStats ? (
                          <div className="flex flex-col gap-1">
                            <div className="flex items-center gap-1 text-xs text-gray-600">
                              <Clock className="h-3 w-3" />
                              <span>{employee.attendanceStats.daysWorkedThisMonth} days</span>
                            </div>
                          </div>
                        ) : (
                          <span className="text-gray-400 text-xs">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <span
                          className={`px-2 py-1 text-xs rounded-full ${
                            employee.isActive
                              ? 'bg-green-100 text-green-800'
                              : 'bg-red-100 text-red-800'
                          }`}
                        >
                          {employee.isActive ? 'Active' : 'Inactive'}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button 
                            variant="ghost" 
                            size="sm"
                            onClick={() => {
                              setSelectedEmployee(employee);
                              setViewAttendanceOpen(true);
                            }}
                            title="View detailed attendance"
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="sm"
                            onClick={async () => {
                              try {
                                const token = localStorage.getItem('token');
                                const response = await fetch(`/api/employees/${employee.id}`, {
                                  headers: {
                                    Authorization: `Bearer ${token}`,
                                  },
                                });
                                if (response.ok) {
                                  const data = await response.json();
                                  setSelectedEmployee(data.employee);
                                  setProfileFormData({
                                    paymentType: data.employee.paymentType || '',
                                    hourlyRate: data.employee.hourlyRate?.toString() || '',
                                    monthlySalary: data.employee.monthlySalary?.toString() || '',
                                  });
                                  setProfileModalOpen(true);
                                } else {
                                  alert('Failed to load employee profile');
                                }
                              } catch (error) {
                                console.error('Failed to fetch employee:', error);
                                alert('Failed to load employee profile');
                              }
                            }}
                            title="Edit employee profile"
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="sm">
                            <Trash2 className="h-4 w-4 text-red-600" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Attendance Detail Dialog */}
        <Dialog open={viewAttendanceOpen} onOpenChange={setViewAttendanceOpen}>
          <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                Attendance Details - {selectedEmployee?.name}
              </DialogTitle>
              <DialogDescription>
                View detailed check-in/check-out history for today
              </DialogDescription>
            </DialogHeader>
            {selectedEmployee && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-sm">Today&apos;s Summary</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      <div className="flex justify-between">
                        <span className="text-sm text-gray-600">Status:</span>
                        <span className={`text-sm font-medium ${
                          selectedEmployee.attendanceStats?.todayStatus?.checkedIn 
                            ? 'text-green-600' 
                            : 'text-gray-400'
                        }`}>
                          {selectedEmployee.attendanceStats?.todayStatus?.checkedIn
                            ? selectedEmployee.attendanceStats.todayStatus.checkedOut
                              ? 'Checked Out'
                              : 'Checked In'
                            : 'Not Checked In'}
                        </span>
                      </div>
                      {selectedEmployee.attendanceStats?.todayStatus?.checkInTime && (
                        <>
                          <div className="flex justify-between">
                            <span className="text-sm text-gray-600">Check-In:</span>
                            <span className="text-sm font-medium">
                              {formatDateTime(selectedEmployee.attendanceStats.todayStatus.checkInTime)}
                            </span>
                          </div>
                          {selectedEmployee.attendanceStats.todayStatus.checkOutTime && (
                            <div className="flex justify-between">
                              <span className="text-sm text-gray-600">Check-Out:</span>
                              <span className="text-sm font-medium">
                                {formatDateTime(selectedEmployee.attendanceStats.todayStatus.checkOutTime)}
                              </span>
                            </div>
                          )}
                          <div className="flex justify-between pt-2 border-t">
                            <span className="text-sm text-gray-600">Total Work Time:</span>
                            <span className="text-sm font-bold text-primary">
                              {calculateWorkTime(
                                selectedEmployee.attendanceStats.todayStatus.checkInTime,
                                selectedEmployee.attendanceStats.todayStatus.checkOutTime
                              )}
                            </span>
                          </div>
                        </>
                      )}
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-sm">Monthly Statistics</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      <div className="flex justify-between">
                        <span className="text-sm text-gray-600">Days Worked:</span>
                        <span className="text-sm font-medium">
                          {selectedEmployee.attendanceStats?.daysWorkedThisMonth || 0} days
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm text-gray-600">Pending Timesheets:</span>
                        <span className="text-sm font-medium text-orange-600">
                          {selectedEmployee.attendanceStats?.pendingTimesheets || 0}
                        </span>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* Check-in/Check-out History */}
                {selectedEmployee.attendanceStats?.todayStatus?.notes && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-sm">Today&apos;s Timeline</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        {parseAttendanceHistory(selectedEmployee.attendanceStats.todayStatus.notes).map((event: any, index: number) => (
                          <div key={index} className="flex items-center gap-3 p-2 rounded border">
                            <div className={`w-2 h-2 rounded-full ${
                              event.type === 'in' ? 'bg-green-500' : 'bg-red-500'
                            }`}></div>
                            <div className="flex-1">
                              <div className="text-sm font-medium">
                                {event.type === 'in' ? 'Checked In' : 'Checked Out'}
                              </div>
                              <div className="text-xs text-gray-500">
                                {formatDateTime(event.time)}
                              </div>
                            </div>
                          </div>
                        ))}
                        {parseAttendanceHistory(selectedEmployee.attendanceStats.todayStatus.notes).length === 0 && (
                          <div className="text-sm text-gray-500 text-center py-4">
                            No detailed history available
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                )}
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* Employee Profile Modal */}
        <Dialog open={profileModalOpen} onOpenChange={setProfileModalOpen}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Employee Profile - {selectedEmployee?.name}</DialogTitle>
              <DialogDescription>
                Update employee payment information
              </DialogDescription>
            </DialogHeader>
            {selectedEmployee && (
              <div className="space-y-4">
                <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                  <div className="space-y-2 mb-4">
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-600">Name:</span>
                      <span className="text-sm font-medium">{selectedEmployee.name}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-600">Email:</span>
                      <span className="text-sm font-medium">{selectedEmployee.email}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-600">Role:</span>
                      <span className="text-sm font-medium">{selectedEmployee.role.replace('_', ' ')}</span>
                    </div>
                    {selectedEmployee.designation && (
                      <div className="flex justify-between">
                        <span className="text-sm text-gray-600">Designation:</span>
                        <span className="text-sm font-medium">{selectedEmployee.designation.name}</span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                  <Label className="text-sm font-semibold text-gray-900 mb-2 block">Payment Information</Label>
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="profilePaymentType">Payment Type</Label>
                      <Select
                        value={profileFormData.paymentType}
                        onValueChange={(value) => setProfileFormData({ 
                          ...profileFormData, 
                          paymentType: value as 'HOURLY' | 'SALARY',
                          hourlyRate: value === 'HOURLY' ? profileFormData.hourlyRate : '',
                          monthlySalary: value === 'SALARY' ? profileFormData.monthlySalary : '',
                        })}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select payment type" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="HOURLY">Hourly</SelectItem>
                          <SelectItem value="SALARY">Salary</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    {profileFormData.paymentType === 'HOURLY' && (
                      <div className="space-y-2">
                        <Label htmlFor="profileHourlyRate">Hourly Rate ($) *</Label>
                        <Input
                          id="profileHourlyRate"
                          type="number"
                          step="0.01"
                          min="0"
                          value={profileFormData.hourlyRate}
                          onChange={(e) => setProfileFormData({ ...profileFormData, hourlyRate: e.target.value })}
                          placeholder="e.g., 25.00"
                          required
                        />
                      </div>
                    )}
                    {profileFormData.paymentType === 'SALARY' && (
                      <div className="space-y-2">
                        <Label htmlFor="profileMonthlySalary">Monthly Salary ($) *</Label>
                        <Input
                          id="profileMonthlySalary"
                          type="number"
                          step="0.01"
                          min="0"
                          value={profileFormData.monthlySalary}
                          onChange={(e) => setProfileFormData({ ...profileFormData, monthlySalary: e.target.value })}
                          placeholder="e.g., 5000.00"
                          required
                        />
                      </div>
                    )}
                  </div>
                </div>

                <DialogFooter>
                  <Button
                    variant="outline"
                    onClick={() => setProfileModalOpen(false)}
                    disabled={updatingProfile}
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={handleUpdateProfile}
                    disabled={updatingProfile || !profileFormData.paymentType}
                  >
                    {updatingProfile ? 'Updating...' : 'Update Profile'}
                  </Button>
                </DialogFooter>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </MainLayout>
  );
}
















