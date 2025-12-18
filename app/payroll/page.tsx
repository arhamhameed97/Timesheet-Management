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
import { Plus, Check, X, DollarSign } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface Payroll {
  id: string;
  month: number;
  year: number;
  baseSalary: number;
  allowances: number;
  deductions: number;
  netSalary: number;
  status: string;
  user: {
    name: string;
  };
}

const months = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

export default function PayrollPage() {
  const [payroll, setPayroll] = useState<Payroll[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [formData, setFormData] = useState({
    userId: '',
    month: new Date().getMonth() + 1,
    year: new Date().getFullYear(),
    baseSalary: 0,
    allowances: 0,
    deductions: 0,
  });

  useEffect(() => {
    fetchPayroll();
  }, []);

  const fetchPayroll = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/payroll', {
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
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/payroll', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });

      if (response.ok) {
        setOpen(false);
        setFormData({
          userId: '',
          month: new Date().getMonth() + 1,
          year: new Date().getFullYear(),
          baseSalary: 0,
          allowances: 0,
          deductions: 0,
        });
        fetchPayroll();
      } else {
        const data = await response.json();
        alert(data.error || 'Failed to create payroll');
      }
    } catch (error) {
      console.error('Failed to create payroll:', error);
      alert('Failed to create payroll');
    }
  };

  const handleApprove = async (id: string) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/payroll/${id}`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ status: 'APPROVED' }),
      });

      if (response.ok) {
        fetchPayroll();
      } else {
        const data = await response.json();
        alert(data.error || 'Failed to approve payroll');
      }
    } catch (error) {
      console.error('Failed to approve payroll:', error);
      alert('Failed to approve payroll');
    }
  };

  const handleReject = async (id: string) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/payroll/${id}`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ status: 'REJECTED' }),
      });

      if (response.ok) {
        fetchPayroll();
      } else {
        const data = await response.json();
        alert(data.error || 'Failed to reject payroll');
      }
    } catch (error) {
      console.error('Failed to reject payroll:', error);
      alert('Failed to reject payroll');
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'APPROVED':
        return 'bg-green-100 text-green-800';
      case 'REJECTED':
        return 'bg-red-100 text-red-800';
      case 'PAID':
        return 'bg-blue-100 text-blue-800';
      default:
        return 'bg-yellow-100 text-yellow-800';
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  };

  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Payroll</h1>
            <p className="text-gray-600 mt-1">Manage employee payroll</p>
          </div>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button className="bg-primary hover:bg-primary/90">
                <Plus className="mr-2 h-4 w-4" />
                New Payroll
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Create Payroll</DialogTitle>
                <DialogDescription>
                  Generate payroll for an employee
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="month">Month *</Label>
                    <Select
                      value={formData.month.toString()}
                      onValueChange={(value) => setFormData({ ...formData, month: parseInt(value) })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {months.map((month, index) => (
                          <SelectItem key={index} value={(index + 1).toString()}>
                            {month}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="year">Year *</Label>
                    <Input
                      id="year"
                      type="number"
                      min="2000"
                      max="2100"
                      value={formData.year}
                      onChange={(e) => setFormData({ ...formData, year: parseInt(e.target.value) })}
                      required
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="baseSalary">Base Salary *</Label>
                  <Input
                    id="baseSalary"
                    type="number"
                    min="0"
                    step="0.01"
                    value={formData.baseSalary}
                    onChange={(e) => setFormData({ ...formData, baseSalary: parseFloat(e.target.value) || 0 })}
                    required
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="allowances">Allowances</Label>
                    <Input
                      id="allowances"
                      type="number"
                      min="0"
                      step="0.01"
                      value={formData.allowances}
                      onChange={(e) => setFormData({ ...formData, allowances: parseFloat(e.target.value) || 0 })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="deductions">Deductions</Label>
                    <Input
                      id="deductions"
                      type="number"
                      min="0"
                      step="0.01"
                      value={formData.deductions}
                      onChange={(e) => setFormData({ ...formData, deductions: parseFloat(e.target.value) || 0 })}
                    />
                  </div>
                </div>
                <div className="flex justify-end gap-2">
                  <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                    Cancel
                  </Button>
                  <Button type="submit">Create</Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Payroll Records</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-center py-8">Loading...</div>
            ) : payroll.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                No payroll records found.
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Employee</TableHead>
                    <TableHead>Period</TableHead>
                    <TableHead>Base Salary</TableHead>
                    <TableHead>Allowances</TableHead>
                    <TableHead>Deductions</TableHead>
                    <TableHead>Net Salary</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {payroll.map((record) => (
                    <TableRow key={record.id}>
                      <TableCell className="font-medium">{record.user.name}</TableCell>
                      <TableCell>
                        {months[record.month - 1]} {record.year}
                      </TableCell>
                      <TableCell>{formatCurrency(record.baseSalary)}</TableCell>
                      <TableCell>{formatCurrency(record.allowances)}</TableCell>
                      <TableCell>{formatCurrency(record.deductions)}</TableCell>
                      <TableCell className="font-semibold">
                        {formatCurrency(record.netSalary)}
                      </TableCell>
                      <TableCell>
                        <span className={`px-2 py-1 text-xs rounded-full ${getStatusColor(record.status)}`}>
                          {record.status}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        {record.status === 'PENDING' && (
                          <div className="flex justify-end gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleApprove(record.id)}
                            >
                              <Check className="h-4 w-4 text-green-600" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleReject(record.id)}
                            >
                              <X className="h-4 w-4 text-red-600" />
                            </Button>
                          </div>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
}




