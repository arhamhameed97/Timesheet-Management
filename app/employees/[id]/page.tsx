'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { ArrowLeft, Edit, Save, X, Calendar, DollarSign, Clock, User } from 'lucide-react';
import { format } from 'date-fns';
import { UserRole, PayrollStatus } from '@prisma/client';

interface Employee {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  phone?: string | null;
  paymentType?: 'HOURLY' | 'SALARY' | null;
  hourlyRate?: number | null;
  monthlySalary?: number | null;
  designation?: {
    id: string;
    name: string;
  } | null;
  manager?: {
    id: string;
    name: string;
    email: string;
  } | null;
  company?: {
    id: string;
    name: string;
  } | null;
  isActive: boolean;
}

interface Attendance {
  id: string;
  date: string;
  checkInTime: string | null;
  checkOutTime: string | null;
  status: string;
  notes: string | null;
}

interface Payroll {
  id: string;
  month: number;
  year: number;
  paymentType: 'HOURLY' | 'SALARY' | null;
  hoursWorked: number | null;
  hourlyRate: number | null;
  baseSalary: number;
  bonuses: Array<{ name: string; amount: number }> | null;
  deductions: Array<{ name: string; amount: number }> | null;
  totalBonuses: number;
  totalDeductions: number;
  netSalary: number;
  status: PayrollStatus;
  notes: string | null;
}

const months = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

export default function EmployeeDetailPage() {
  const params = useParams();
  const router = useRouter();
  const employeeId = params.id as string;

  const [employee, setEmployee] = useState<Employee | null>(null);
  const [attendance, setAttendance] = useState<Attendance[]>([]);
  const [payroll, setPayroll] = useState<Payroll[]>([]);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<any>(null);
  
  // Profile edit state
  const [profileEditOpen, setProfileEditOpen] = useState(false);
  const [profileFormData, setProfileFormData] = useState({
    name: '',
    email: '',
    phone: '',
    paymentType: '' as '' | 'HOURLY' | 'SALARY',
    hourlyRate: '',
    monthlySalary: '',
  });
  const [updatingProfile, setUpdatingProfile] = useState(false);

  // Attendance edit state
  const [attendanceEditOpen, setAttendanceEditOpen] = useState(false);
  const [selectedAttendance, setSelectedAttendance] = useState<Attendance | null>(null);
  const [attendanceFormData, setAttendanceFormData] = useState({
    checkInTime: '',
    checkOutTime: '',
    status: 'PRESENT',
    notes: '',
  });
  const [updatingAttendance, setUpdatingAttendance] = useState(false);

  // Payroll edit state
  const [payrollEditOpen, setPayrollEditOpen] = useState(false);
  const [selectedPayroll, setSelectedPayroll] = useState<Payroll | null>(null);
  const [payrollFormData, setPayrollFormData] = useState({
    baseSalary: '',
    bonuses: [] as Array<{ name: string; amount: number }>,
    deductions: [] as Array<{ name: string; amount: number }>,
    notes: '',
  });
  const [updatingPayroll, setUpdatingPayroll] = useState(false);

  useEffect(() => {
    fetchUser();
    fetchEmployee();
    fetchAttendance();
    fetchPayroll();
  }, [employeeId]);

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
      }
    } catch (error) {
      console.error('Failed to fetch user:', error);
    }
  };

  const fetchEmployee = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/employees/${employeeId}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      if (response.ok) {
        const data = await response.json();
        setEmployee(data.employee);
      } else {
        alert('Failed to load employee');
        router.push('/employees');
      }
    } catch (error) {
      console.error('Failed to fetch employee:', error);
      router.push('/employees');
    } finally {
      setLoading(false);
    }
  };

  const fetchAttendance = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/attendance?userId=${employeeId}`, {
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
    }
  };

  const fetchPayroll = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/payroll?userId=${employeeId}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      if (response.ok) {
        const data = await response.json();
        setPayroll(data.payroll || []);
      }
    } catch (error) {
      console.error('Failed to fetch payroll:', error);
    }
  };

  const handleOpenProfileEdit = () => {
    if (!employee) return;
    setProfileFormData({
      name: employee.name,
      email: employee.email,
      phone: employee.phone || '',
      paymentType: employee.paymentType || '',
      hourlyRate: employee.hourlyRate?.toString() || '',
      monthlySalary: employee.monthlySalary?.toString() || '',
    });
    setProfileEditOpen(true);
  };

  const handleUpdateProfile = async () => {
    if (!employee) return;
    
    try {
      setUpdatingProfile(true);
      const token = localStorage.getItem('token');
      
      const requestBody: any = {};
      if (profileFormData.name !== employee.name) requestBody.name = profileFormData.name;
      if (profileFormData.email !== employee.email) requestBody.email = profileFormData.email;
      if (profileFormData.phone !== (employee.phone || '')) requestBody.phone = profileFormData.phone || null;
      if (profileFormData.paymentType !== (employee.paymentType || '')) {
        requestBody.paymentType = profileFormData.paymentType || null;
      }
      if (profileFormData.hourlyRate) {
        requestBody.hourlyRate = parseFloat(profileFormData.hourlyRate);
      }
      if (profileFormData.monthlySalary) {
        requestBody.monthlySalary = parseFloat(profileFormData.monthlySalary);
      }
      
      // Clear opposite field when payment type changes
      if (profileFormData.paymentType === 'HOURLY') {
        requestBody.monthlySalary = null;
      } else if (profileFormData.paymentType === 'SALARY') {
        requestBody.hourlyRate = null;
      }
      
      const response = await fetch(`/api/employees/${employeeId}`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      if (response.ok) {
        setProfileEditOpen(false);
        fetchEmployee();
        alert('Profile updated successfully');
      } else {
        const data = await response.json();
        alert(data.error || 'Failed to update profile');
      }
    } catch (error) {
      console.error('Failed to update profile:', error);
      alert('Failed to update profile');
    } finally {
      setUpdatingProfile(false);
    }
  };

  const handleOpenAttendanceEdit = (att: Attendance) => {
    setSelectedAttendance(att);
    setAttendanceFormData({
      checkInTime: att.checkInTime ? format(new Date(att.checkInTime), "yyyy-MM-dd'T'HH:mm") : '',
      checkOutTime: att.checkOutTime ? format(new Date(att.checkOutTime), "yyyy-MM-dd'T'HH:mm") : '',
      status: att.status,
      notes: att.notes || '',
    });
    setAttendanceEditOpen(true);
  };

  const handleUpdateAttendance = async () => {
    if (!selectedAttendance) return;
    
    try {
      setUpdatingAttendance(true);
      const token = localStorage.getItem('token');
      
      const response = await fetch('/api/attendance', {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          id: selectedAttendance.id,
          checkInTime: attendanceFormData.checkInTime ? new Date(attendanceFormData.checkInTime).toISOString() : null,
          checkOutTime: attendanceFormData.checkOutTime ? new Date(attendanceFormData.checkOutTime).toISOString() : null,
          status: attendanceFormData.status,
          notes: attendanceFormData.notes || null,
        }),
      });

      if (response.ok) {
        setAttendanceEditOpen(false);
        fetchAttendance();
        alert('Attendance updated successfully');
      } else {
        const data = await response.json();
        alert(data.error || 'Failed to update attendance');
      }
    } catch (error) {
      console.error('Failed to update attendance:', error);
      alert('Failed to update attendance');
    } finally {
      setUpdatingAttendance(false);
    }
  };

  const handleOpenPayrollEdit = (pay: Payroll) => {
    setSelectedPayroll(pay);
    setPayrollFormData({
      baseSalary: pay.baseSalary.toString(),
      bonuses: pay.bonuses || [],
      deductions: pay.deductions || [],
      notes: pay.notes || '',
    });
    setPayrollEditOpen(true);
  };

  const handleUpdatePayroll = async () => {
    if (!selectedPayroll) return;
    
    try {
      setUpdatingPayroll(true);
      const token = localStorage.getItem('token');
      
      const response = await fetch(`/api/payroll/${selectedPayroll.id}`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          baseSalary: parseFloat(payrollFormData.baseSalary),
          bonuses: payrollFormData.bonuses,
          deductions: payrollFormData.deductions,
          notes: payrollFormData.notes || null,
        }),
      });

      if (response.ok) {
        setPayrollEditOpen(false);
        fetchPayroll();
        alert('Payroll updated successfully');
      } else {
        const data = await response.json();
        alert(data.error || 'Failed to update payroll');
      }
    } catch (error) {
      console.error('Failed to update payroll:', error);
      alert('Failed to update payroll');
    } finally {
      setUpdatingPayroll(false);
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

  const canEdit = user && (
    user.role === UserRole.SUPER_ADMIN ||
    user.role === UserRole.COMPANY_ADMIN ||
    user.role === UserRole.MANAGER
  );

  if (loading) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
            <p className="mt-4 text-muted-foreground">Loading...</p>
          </div>
        </div>
      </MainLayout>
    );
  }

  if (!employee) {
    return (
      <MainLayout>
        <div className="text-center py-8">
          <p className="text-muted-foreground">Employee not found</p>
          <Button onClick={() => router.push('/employees')} className="mt-4">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Employees
          </Button>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" onClick={() => router.push('/employees')}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back
            </Button>
            <div className="flex items-center gap-3">
              <Avatar className="h-12 w-12">
                <AvatarFallback className="bg-primary text-primary-foreground">
                  {getInitials(employee.name)}
                </AvatarFallback>
              </Avatar>
              <div>
                <h1 className="text-3xl font-bold text-foreground">{employee.name}</h1>
                <p className="text-muted-foreground">{employee.email}</p>
              </div>
            </div>
          </div>
          {canEdit && (
            <Button onClick={handleOpenProfileEdit}>
              <Edit className="mr-2 h-4 w-4" />
              Edit Profile
            </Button>
          )}
        </div>

        {/* Tabs */}
        <Tabs defaultValue="profile" className="space-y-4">
          <TabsList>
            <TabsTrigger value="profile">
              <User className="mr-2 h-4 w-4" />
              Profile
            </TabsTrigger>
            <TabsTrigger value="attendance">
              <Clock className="mr-2 h-4 w-4" />
              Attendance
            </TabsTrigger>
            <TabsTrigger value="payroll">
              <DollarSign className="mr-2 h-4 w-4" />
              Payroll
            </TabsTrigger>
          </TabsList>

          {/* Profile Tab */}
          <TabsContent value="profile">
            <Card>
              <CardHeader>
                <CardTitle>Profile Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-muted-foreground">Name</Label>
                    <p className="font-medium">{employee.name}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Email</Label>
                    <p className="font-medium">{employee.email}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Phone</Label>
                    <p className="font-medium">{employee.phone || '-'}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Role</Label>
                    <p className="font-medium">{employee.role.replace('_', ' ')}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Designation</Label>
                    <p className="font-medium">{employee.designation?.name || '-'}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Manager</Label>
                    <p className="font-medium">{employee.manager?.name || '-'}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Company</Label>
                    <p className="font-medium">{employee.company?.name || '-'}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Status</Label>
                    <p className={`font-medium ${employee.isActive ? 'text-green-600' : 'text-red-600'}`}>
                      {employee.isActive ? 'Active' : 'Inactive'}
                    </p>
                  </div>
                </div>
                <div className="border-t pt-4">
                  <h3 className="font-semibold mb-2">Payment Information</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label className="text-muted-foreground">Payment Type</Label>
                      <p className="font-medium">{employee.paymentType || '-'}</p>
                    </div>
                    {employee.paymentType === 'HOURLY' && (
                      <div>
                        <Label className="text-muted-foreground">Hourly Rate</Label>
                        <p className="font-medium">${employee.hourlyRate?.toFixed(2) || '-'}</p>
                      </div>
                    )}
                    {employee.paymentType === 'SALARY' && (
                      <div>
                        <Label className="text-muted-foreground">Monthly Salary</Label>
                        <p className="font-medium">${employee.monthlySalary?.toFixed(2) || '-'}</p>
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Attendance Tab */}
          <TabsContent value="attendance">
            <Card>
              <CardHeader>
                <CardTitle>Attendance History</CardTitle>
              </CardHeader>
              <CardContent>
                {attendance.length === 0 ? (
                  <p className="text-muted-foreground text-center py-8">No attendance records found</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>Check-In</TableHead>
                        <TableHead>Check-Out</TableHead>
                        <TableHead>Status</TableHead>
                        {canEdit && <TableHead className="text-right">Actions</TableHead>}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {attendance.map((att) => (
                        <TableRow key={att.id}>
                          <TableCell>{format(new Date(att.date), 'MMM dd, yyyy')}</TableCell>
                          <TableCell>
                            {att.checkInTime ? format(new Date(att.checkInTime), 'HH:mm:ss') : '-'}
                          </TableCell>
                          <TableCell>
                            {att.checkOutTime ? format(new Date(att.checkOutTime), 'HH:mm:ss') : '-'}
                          </TableCell>
                          <TableCell>{att.status}</TableCell>
                          {canEdit && (
                            <TableCell className="text-right">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleOpenAttendanceEdit(att)}
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                            </TableCell>
                          )}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Payroll Tab */}
          <TabsContent value="payroll">
            <Card>
              <CardHeader>
                <CardTitle>Payroll History</CardTitle>
              </CardHeader>
              <CardContent>
                {payroll.length === 0 ? (
                  <p className="text-muted-foreground text-center py-8">No payroll records found</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Period</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Base Salary</TableHead>
                        <TableHead>Bonuses</TableHead>
                        <TableHead>Deductions</TableHead>
                        <TableHead>Net Salary</TableHead>
                        <TableHead>Status</TableHead>
                        {canEdit && <TableHead className="text-right">Actions</TableHead>}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {payroll.map((pay) => (
                        <TableRow key={pay.id}>
                          <TableCell>
                            {months[pay.month - 1]} {pay.year}
                          </TableCell>
                          <TableCell>{pay.paymentType || '-'}</TableCell>
                          <TableCell>${pay.baseSalary.toFixed(2)}</TableCell>
                          <TableCell>${pay.totalBonuses.toFixed(2)}</TableCell>
                          <TableCell>${pay.totalDeductions.toFixed(2)}</TableCell>
                          <TableCell>${pay.netSalary.toFixed(2)}</TableCell>
                          <TableCell>
                            <span className={`px-2 py-1 text-xs rounded-full ${
                              pay.status === PayrollStatus.APPROVED ? 'bg-green-100 text-green-800' :
                              pay.status === PayrollStatus.PAID ? 'bg-blue-100 text-blue-800' :
                              pay.status === PayrollStatus.REJECTED ? 'bg-red-100 text-red-800' :
                              'bg-yellow-100 text-yellow-800'
                            }`}>
                              {pay.status}
                            </span>
                          </TableCell>
                          {canEdit && (
                            <TableCell className="text-right">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleOpenPayrollEdit(pay)}
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                            </TableCell>
                          )}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Profile Edit Dialog */}
        <Dialog open={profileEditOpen} onOpenChange={setProfileEditOpen}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Edit Profile</DialogTitle>
              <DialogDescription>Update employee profile information</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Name *</Label>
                <Input
                  id="name"
                  value={profileFormData.name}
                  onChange={(e) => setProfileFormData({ ...profileFormData, name: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email *</Label>
                <Input
                  id="email"
                  type="email"
                  value={profileFormData.email}
                  onChange={(e) => setProfileFormData({ ...profileFormData, email: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">Phone</Label>
                <Input
                  id="phone"
                  value={profileFormData.phone}
                  onChange={(e) => setProfileFormData({ ...profileFormData, phone: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="paymentType">Payment Type</Label>
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
                  <Label htmlFor="hourlyRate">Hourly Rate ($) *</Label>
                  <Input
                    id="hourlyRate"
                    type="number"
                    step="0.01"
                    min="0"
                    value={profileFormData.hourlyRate}
                    onChange={(e) => setProfileFormData({ ...profileFormData, hourlyRate: e.target.value })}
                    required
                  />
                </div>
              )}
              {profileFormData.paymentType === 'SALARY' && (
                <div className="space-y-2">
                  <Label htmlFor="monthlySalary">Monthly Salary ($) *</Label>
                  <Input
                    id="monthlySalary"
                    type="number"
                    step="0.01"
                    min="0"
                    value={profileFormData.monthlySalary}
                    onChange={(e) => setProfileFormData({ ...profileFormData, monthlySalary: e.target.value })}
                    required
                  />
                </div>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setProfileEditOpen(false)} disabled={updatingProfile}>
                Cancel
              </Button>
              <Button onClick={handleUpdateProfile} disabled={updatingProfile}>
                {updatingProfile ? 'Updating...' : 'Update Profile'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Attendance Edit Dialog */}
        <Dialog open={attendanceEditOpen} onOpenChange={setAttendanceEditOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Edit Attendance</DialogTitle>
              <DialogDescription>
                {selectedAttendance && `Edit attendance for ${format(new Date(selectedAttendance.date), 'MMM dd, yyyy')}`}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="checkInTime">Check-In Time</Label>
                <Input
                  id="checkInTime"
                  type="datetime-local"
                  value={attendanceFormData.checkInTime}
                  onChange={(e) => setAttendanceFormData({ ...attendanceFormData, checkInTime: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="checkOutTime">Check-Out Time</Label>
                <Input
                  id="checkOutTime"
                  type="datetime-local"
                  value={attendanceFormData.checkOutTime}
                  onChange={(e) => setAttendanceFormData({ ...attendanceFormData, checkOutTime: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="status">Status</Label>
                <Select
                  value={attendanceFormData.status}
                  onValueChange={(value) => setAttendanceFormData({ ...attendanceFormData, status: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="PRESENT">Present</SelectItem>
                    <SelectItem value="ABSENT">Absent</SelectItem>
                    <SelectItem value="HALF_DAY">Half Day</SelectItem>
                    <SelectItem value="LATE">Late</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="notes">Notes</Label>
                <Textarea
                  id="notes"
                  value={attendanceFormData.notes}
                  onChange={(e) => setAttendanceFormData({ ...attendanceFormData, notes: e.target.value })}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setAttendanceEditOpen(false)} disabled={updatingAttendance}>
                Cancel
              </Button>
              <Button onClick={handleUpdateAttendance} disabled={updatingAttendance}>
                {updatingAttendance ? 'Updating...' : 'Update Attendance'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Payroll Edit Dialog */}
        <Dialog open={payrollEditOpen} onOpenChange={setPayrollEditOpen}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Edit Payroll</DialogTitle>
              <DialogDescription>
                {selectedPayroll && `Edit payroll for ${months[selectedPayroll.month - 1]} ${selectedPayroll.year}`}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="baseSalary">Base Salary ($) *</Label>
                <Input
                  id="baseSalary"
                  type="number"
                  step="0.01"
                  min="0"
                  value={payrollFormData.baseSalary}
                  onChange={(e) => setPayrollFormData({ ...payrollFormData, baseSalary: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>Bonuses</Label>
                <div className="space-y-2 max-h-32 overflow-y-auto border rounded p-2">
                  {payrollFormData.bonuses.map((bonus, index) => (
                    <div key={index} className="flex gap-2">
                      <Input
                        placeholder="Bonus name"
                        value={bonus.name}
                        onChange={(e) => {
                          const newBonuses = [...payrollFormData.bonuses];
                          newBonuses[index].name = e.target.value;
                          setPayrollFormData({ ...payrollFormData, bonuses: newBonuses });
                        }}
                      />
                      <Input
                        type="number"
                        step="0.01"
                        placeholder="Amount"
                        value={bonus.amount}
                        onChange={(e) => {
                          const newBonuses = [...payrollFormData.bonuses];
                          newBonuses[index].amount = parseFloat(e.target.value) || 0;
                          setPayrollFormData({ ...payrollFormData, bonuses: newBonuses });
                        }}
                      />
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setPayrollFormData({
                            ...payrollFormData,
                            bonuses: payrollFormData.bonuses.filter((_, i) => i !== index),
                          });
                        }}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setPayrollFormData({
                        ...payrollFormData,
                        bonuses: [...payrollFormData.bonuses, { name: '', amount: 0 }],
                      });
                    }}
                  >
                    Add Bonus
                  </Button>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Deductions</Label>
                <div className="space-y-2 max-h-32 overflow-y-auto border rounded p-2">
                  {payrollFormData.deductions.map((deduction, index) => (
                    <div key={index} className="flex gap-2">
                      <Input
                        placeholder="Deduction name"
                        value={deduction.name}
                        onChange={(e) => {
                          const newDeductions = [...payrollFormData.deductions];
                          newDeductions[index].name = e.target.value;
                          setPayrollFormData({ ...payrollFormData, deductions: newDeductions });
                        }}
                      />
                      <Input
                        type="number"
                        step="0.01"
                        placeholder="Amount"
                        value={deduction.amount}
                        onChange={(e) => {
                          const newDeductions = [...payrollFormData.deductions];
                          newDeductions[index].amount = parseFloat(e.target.value) || 0;
                          setPayrollFormData({ ...payrollFormData, deductions: newDeductions });
                        }}
                      />
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setPayrollFormData({
                            ...payrollFormData,
                            deductions: payrollFormData.deductions.filter((_, i) => i !== index),
                          });
                        }}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setPayrollFormData({
                        ...payrollFormData,
                        deductions: [...payrollFormData.deductions, { name: '', amount: 0 }],
                      });
                    }}
                  >
                    Add Deduction
                  </Button>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="notes">Notes</Label>
                <Textarea
                  id="notes"
                  value={payrollFormData.notes}
                  onChange={(e) => setPayrollFormData({ ...payrollFormData, notes: e.target.value })}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setPayrollEditOpen(false)} disabled={updatingPayroll}>
                Cancel
              </Button>
              <Button onClick={handleUpdatePayroll} disabled={updatingPayroll}>
                {updatingPayroll ? 'Updating...' : 'Update Payroll'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </MainLayout>
  );
}
