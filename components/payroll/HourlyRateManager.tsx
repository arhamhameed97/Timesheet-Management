'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Plus, Trash2, Edit2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { format } from 'date-fns';

interface HourlyRatePeriod {
  id: string;
  userId: string;
  startDate: string;
  endDate: string;
  hourlyRate: number;
  user: {
    id: string;
    name: string;
    email: string;
  };
}

interface HourlyRateManagerProps {
  userId: string;
  onUpdate?: () => void;
}

export function HourlyRateManager({ userId, onUpdate }: HourlyRateManagerProps) {
  const [periods, setPeriods] = useState<HourlyRatePeriod[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingPeriod, setEditingPeriod] = useState<HourlyRatePeriod | null>(null);
  const [formData, setFormData] = useState({
    startDate: '',
    endDate: '',
    hourlyRate: '',
  });

  useEffect(() => {
    fetchPeriods();
  }, [userId]);

  const fetchPeriods = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/payroll/hourly-rates?userId=${userId}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setPeriods(data.hourlyRatePeriods || []);
      }
    } catch (error) {
      console.error('Failed to fetch hourly rate periods:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const token = localStorage.getItem('token');
      const url = editingPeriod
        ? `/api/payroll/hourly-rates/${editingPeriod.id}`
        : '/api/payroll/hourly-rates';
      const method = editingPeriod ? 'PATCH' : 'POST';

      const response = await fetch(url, {
        method,
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId,
          startDate: formData.startDate,
          endDate: formData.endDate,
          hourlyRate: parseFloat(formData.hourlyRate),
        }),
      });

      if (response.ok) {
        setDialogOpen(false);
        setEditingPeriod(null);
        setFormData({ startDate: '', endDate: '', hourlyRate: '' });
        fetchPeriods();
        if (onUpdate) onUpdate();
      } else {
        const data = await response.json();
        alert(data.error || 'Failed to save hourly rate period');
      }
    } catch (error) {
      console.error('Failed to save hourly rate period:', error);
      alert('Failed to save hourly rate period');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this hourly rate period?')) {
      return;
    }

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/payroll/hourly-rates/${id}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.ok) {
        fetchPeriods();
        if (onUpdate) onUpdate();
      } else {
        const data = await response.json();
        alert(data.error || 'Failed to delete hourly rate period');
      }
    } catch (error) {
      console.error('Failed to delete hourly rate period:', error);
      alert('Failed to delete hourly rate period');
    }
  };

  const handleEdit = (period: HourlyRatePeriod) => {
    setEditingPeriod(period);
    setFormData({
      startDate: period.startDate.split('T')[0],
      endDate: period.endDate.split('T')[0],
      hourlyRate: period.hourlyRate.toString(),
    });
    setDialogOpen(true);
  };

  const handleDialogClose = () => {
    setDialogOpen(false);
    setEditingPeriod(null);
    setFormData({ startDate: '', endDate: '', hourlyRate: '' });
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Hourly Rate Periods</CardTitle>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm" onClick={() => setEditingPeriod(null)}>
                <Plus className="h-4 w-4 mr-2" />
                Add Period
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>
                  {editingPeriod ? 'Edit Hourly Rate Period' : 'Add Hourly Rate Period'}
                </DialogTitle>
                <DialogDescription>
                  Set a specific hourly rate for a time period. This will override the default hourly rate.
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleSubmit}>
                <div className="space-y-4 py-4">
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
                    <Label htmlFor="endDate">End Date *</Label>
                    <Input
                      id="endDate"
                      type="date"
                      value={formData.endDate}
                      onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="hourlyRate">Hourly Rate ($) *</Label>
                    <Input
                      id="hourlyRate"
                      type="number"
                      step="0.01"
                      min="0"
                      value={formData.hourlyRate}
                      onChange={(e) => setFormData({ ...formData, hourlyRate: e.target.value })}
                      required
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button type="button" variant="outline" onClick={handleDialogClose}>
                    Cancel
                  </Button>
                  <Button type="submit">Save</Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="text-center py-4 text-muted-foreground">Loading...</div>
        ) : periods.length === 0 ? (
          <div className="text-center py-4 text-muted-foreground">
            No hourly rate periods set. Default hourly rate will be used.
          </div>
        ) : (
          <div className="space-y-2">
            {periods.map((period) => (
              <div
                key={period.id}
                className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50"
              >
                <div>
                  <div className="font-medium">${period.hourlyRate.toFixed(2)}/hr</div>
                  <div className="text-sm text-muted-foreground">
                    {format(new Date(period.startDate), 'MMM d, yyyy')} -{' '}
                    {format(new Date(period.endDate), 'MMM d, yyyy')}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleEdit(period)}
                  >
                    <Edit2 className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleDelete(period.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
