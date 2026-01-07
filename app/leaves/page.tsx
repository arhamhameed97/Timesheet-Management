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
import { Plus, Check, X } from 'lucide-react';
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
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { format } from 'date-fns';

interface Leave {
  id: string;
  startDate: string;
  endDate: string;
  type: string;
  reason: string | null;
  status: string;
  leaveDuration?: string;
  user: {
    name: string;
  };
}

export default function LeavesPage() {
  const [leaves, setLeaves] = useState<Leave[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [formData, setFormData] = useState({
    startDate: format(new Date(), 'yyyy-MM-dd'),
    endDate: format(new Date(), 'yyyy-MM-dd'),
    type: 'Vacation',
    reason: '',
    leaveDuration: 'FULL_DAY' as 'FULL_DAY' | 'HALF_DAY_MORNING' | 'HALF_DAY_AFTERNOON',
  });

  useEffect(() => {
    fetchLeaves();
  }, []);

  const fetchLeaves = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/leaves', {
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
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const token = localStorage.getItem('token');
      const endDate = formData.leaveDuration !== 'FULL_DAY' ? formData.startDate : formData.endDate;
      const response = await fetch('/api/leaves', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...formData,
          endDate,
        }),
      });

      if (response.ok) {
        setOpen(false);
        setFormData({
          startDate: format(new Date(), 'yyyy-MM-dd'),
          endDate: format(new Date(), 'yyyy-MM-dd'),
          type: 'Vacation',
          reason: '',
          leaveDuration: 'FULL_DAY',
        });
        fetchLeaves();
      } else {
        const data = await response.json();
        alert(data.error || 'Failed to create leave request');
      }
    } catch (error) {
      console.error('Failed to create leave request:', error);
      alert('Failed to create leave request');
    }
  };

  const handleApprove = async (id: string) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/leaves/${id}`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ status: 'APPROVED' }),
      });

      if (response.ok) {
        fetchLeaves();
      } else {
        const data = await response.json();
        alert(data.error || 'Failed to approve leave');
      }
    } catch (error) {
      console.error('Failed to approve leave:', error);
      alert('Failed to approve leave');
    }
  };

  const handleReject = async (id: string) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/leaves/${id}`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ status: 'REJECTED' }),
      });

      if (response.ok) {
        fetchLeaves();
      } else {
        const data = await response.json();
        alert(data.error || 'Failed to reject leave');
      }
    } catch (error) {
      console.error('Failed to reject leave:', error);
      alert('Failed to reject leave');
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'APPROVED':
        return 'bg-green-100 text-green-800';
      case 'REJECTED':
        return 'bg-red-100 text-red-800';
      case 'CANCELLED':
        return 'bg-gray-100 text-gray-800';
      default:
        return 'bg-yellow-100 text-yellow-800';
    }
  };

  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Leave Management</h1>
            <p className="text-gray-600 mt-1">Request and manage leaves</p>
          </div>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button className="bg-primary hover:bg-primary/90">
                <Plus className="mr-2 h-4 w-4" />
                Request Leave
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Request Leave</DialogTitle>
                <DialogDescription>
                  Submit a new leave request
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="startDate">Start Date *</Label>
                    <Input
                      id="startDate"
                      type="date"
                      value={formData.startDate}
                      onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="leaveDuration">Leave Duration *</Label>
                    <Select
                      value={formData.leaveDuration}
                      onValueChange={(value) => {
                        const duration = value as 'FULL_DAY' | 'HALF_DAY_MORNING' | 'HALF_DAY_AFTERNOON';
                        setFormData({ 
                          ...formData, 
                          leaveDuration: duration,
                          endDate: duration !== 'FULL_DAY' ? formData.startDate : formData.endDate,
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
                </div>
                <div className="space-y-2">
                  <Label htmlFor="endDate">End Date *</Label>
                  <Input
                    id="endDate"
                    type="date"
                    value={formData.endDate}
                    onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                    required
                    disabled={formData.leaveDuration !== 'FULL_DAY'}
                  />
                  {formData.leaveDuration !== 'FULL_DAY' && (
                    <p className="text-xs text-gray-500">End date is automatically set to start date for half-day leaves</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="type">Leave Type *</Label>
                  <Select
                    value={formData.type}
                    onValueChange={(value) => setFormData({ ...formData, type: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Vacation">Vacation</SelectItem>
                      <SelectItem value="Sick Leave">Sick Leave</SelectItem>
                      <SelectItem value="Personal">Personal</SelectItem>
                      <SelectItem value="Other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="reason">Reason</Label>
                  <Textarea
                    id="reason"
                    value={formData.reason}
                    onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
                    rows={3}
                  />
                </div>
                <div className="flex justify-end gap-2">
                  <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                    Cancel
                  </Button>
                  <Button type="submit">Submit</Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Leave Requests</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-center py-8">Loading...</div>
            ) : leaves.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                No leave requests found.
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Employee</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Duration</TableHead>
                    <TableHead>Start Date</TableHead>
                    <TableHead>End Date</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {leaves.map((leave) => (
                    <TableRow key={leave.id}>
                      <TableCell className="font-medium">{leave.user.name}</TableCell>
                      <TableCell>{leave.type}</TableCell>
                      <TableCell>
                        <span className="px-2 py-1 text-xs rounded-full bg-blue-100 text-blue-800">
                          {leave.leaveDuration === 'HALF_DAY_MORNING' ? 'Half Day (Morning)' :
                           leave.leaveDuration === 'HALF_DAY_AFTERNOON' ? 'Half Day (Afternoon)' :
                           'Full Day'}
                        </span>
                      </TableCell>
                      <TableCell>{format(new Date(leave.startDate), 'MMM dd, yyyy')}</TableCell>
                      <TableCell>{format(new Date(leave.endDate), 'MMM dd, yyyy')}</TableCell>
                      <TableCell>
                        <span className={`px-2 py-1 text-xs rounded-full ${getStatusColor(leave.status)}`}>
                          {leave.status}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        {leave.status === 'PENDING' && (
                          <div className="flex justify-end gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleApprove(leave.id)}
                            >
                              <Check className="h-4 w-4 text-green-600" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleReject(leave.id)}
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
















