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
import { format } from 'date-fns';

interface Timesheet {
  id: string;
  date: string;
  hours: number;
  status: string;
  notes: string | null;
  user: {
    name: string;
  };
  taskLogs: Array<{
    id: string;
    description: string;
    hours: number;
  }>;
}

export default function TimesheetsPage() {
  const [timesheets, setTimesheets] = useState<Timesheet[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [formData, setFormData] = useState({
    date: format(new Date(), 'yyyy-MM-dd'),
    hours: 8,
    notes: '',
  });

  useEffect(() => {
    fetchTimesheets();
  }, []);

  const fetchTimesheets = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/timesheets', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setTimesheets(data.timesheets || []);
      }
    } catch (error) {
      console.error('Failed to fetch timesheets:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/timesheets', {
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
          date: format(new Date(), 'yyyy-MM-dd'),
          hours: 8,
          notes: '',
        });
        fetchTimesheets();
      } else {
        const data = await response.json();
        alert(data.error || 'Failed to create timesheet');
      }
    } catch (error) {
      console.error('Failed to create timesheet:', error);
      alert('Failed to create timesheet');
    }
  };

  const handleApprove = async (id: string) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/timesheets/${id}`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ status: 'APPROVED' }),
      });

      if (response.ok) {
        fetchTimesheets();
      } else {
        const data = await response.json();
        alert(data.error || 'Failed to approve timesheet');
      }
    } catch (error) {
      console.error('Failed to approve timesheet:', error);
      alert('Failed to approve timesheet');
    }
  };

  const handleReject = async (id: string) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/timesheets/${id}`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ status: 'REJECTED' }),
      });

      if (response.ok) {
        fetchTimesheets();
      } else {
        const data = await response.json();
        alert(data.error || 'Failed to reject timesheet');
      }
    } catch (error) {
      console.error('Failed to reject timesheet:', error);
      alert('Failed to reject timesheet');
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'APPROVED':
        return 'bg-green-100 text-green-800';
      case 'REJECTED':
        return 'bg-red-100 text-red-800';
      case 'SUBMITTED':
        return 'bg-yellow-100 text-yellow-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Timesheets</h1>
            <p className="text-gray-600 mt-1">Track and manage work hours</p>
          </div>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button className="bg-primary hover:bg-primary/90">
                <Plus className="mr-2 h-4 w-4" />
                New Timesheet
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create Timesheet</DialogTitle>
                <DialogDescription>
                  Log your work hours for a specific date
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="date">Date *</Label>
                  <Input
                    id="date"
                    type="date"
                    value={formData.date}
                    onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="hours">Hours *</Label>
                  <Input
                    id="hours"
                    type="number"
                    min="0"
                    max="24"
                    step="0.5"
                    value={formData.hours}
                    onChange={(e) => setFormData({ ...formData, hours: parseFloat(e.target.value) })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="notes">Notes</Label>
                  <Textarea
                    id="notes"
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    rows={3}
                  />
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
            <CardTitle>Timesheet List</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-center py-8">Loading...</div>
            ) : timesheets.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                No timesheets found. Create your first timesheet to get started.
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Employee</TableHead>
                    <TableHead>Hours</TableHead>
                    <TableHead>Tasks</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {timesheets.map((timesheet) => (
                    <TableRow key={timesheet.id}>
                      <TableCell>{format(new Date(timesheet.date), 'MMM dd, yyyy')}</TableCell>
                      <TableCell>{timesheet.user.name}</TableCell>
                      <TableCell>{timesheet.hours}</TableCell>
                      <TableCell>{timesheet.taskLogs.length}</TableCell>
                      <TableCell>
                        <span className={`px-2 py-1 text-xs rounded-full ${getStatusColor(timesheet.status)}`}>
                          {timesheet.status}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        {timesheet.status === 'SUBMITTED' && (
                          <div className="flex justify-end gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleApprove(timesheet.id)}
                            >
                              <Check className="h-4 w-4 text-green-600" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleReject(timesheet.id)}
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












