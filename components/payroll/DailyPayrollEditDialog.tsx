'use client';

import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Trash2, Save } from 'lucide-react';
import { format } from 'date-fns';

interface DailyPayrollData {
  hours: number;
  earnings: number;
  hourlyRate: number | null;
  overtimeHours: number;
  regularHours: number;
  isOverride?: boolean;
}

interface OriginalAttendanceData {
  hours: number;
  earnings: number;
  hourlyRate: number | null;
  overtimeHours: number;
  regularHours: number;
}

interface DailyPayrollEditDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  date: Date | null;
  userId: string;
  currentData: DailyPayrollData | null;
  originalData: OriginalAttendanceData | null;
  onSave: (data: {
    hourlyRate?: number;
    regularHours?: number;
    overtimeHours?: number;
    totalHours?: number;
    earnings?: number;
    notes?: string;
  }) => Promise<void>;
  onDelete?: () => Promise<void>;
}

export function DailyPayrollEditDialog({
  open,
  onOpenChange,
  date,
  userId,
  currentData,
  originalData,
  onSave,
  onDelete,
}: DailyPayrollEditDialogProps) {
  const [hourlyRate, setHourlyRate] = useState<string>('');
  const [regularHours, setRegularHours] = useState<string>('');
  const [overtimeHours, setOvertimeHours] = useState<string>('');
  const [totalHours, setTotalHours] = useState<string>('');
  const [earnings, setEarnings] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Initialize form when dialog opens or data changes
  useEffect(() => {
    if (open && currentData) {
      setHourlyRate(currentData.hourlyRate?.toString() || '');
      setRegularHours(currentData.regularHours.toString() || '');
      setOvertimeHours(currentData.overtimeHours.toString() || '');
      setTotalHours(currentData.hours.toString() || '');
      setEarnings(currentData.earnings.toString() || '');
      setNotes('');
    } else if (open && originalData) {
      // Initialize with original data if no override exists
      setHourlyRate(originalData.hourlyRate?.toString() || '');
      setRegularHours(originalData.regularHours.toString() || '');
      setOvertimeHours(originalData.overtimeHours.toString() || '');
      setTotalHours(originalData.hours.toString() || '');
      setEarnings(originalData.earnings.toString() || '');
      setNotes('');
    }
  }, [open, currentData, originalData]);

  // Calculate earnings when rate or hours change
  useEffect(() => {
    const rate = parseFloat(hourlyRate) || 0;
    const regHours = parseFloat(regularHours) || 0;
    const otHours = parseFloat(overtimeHours) || 0;
    const total = parseFloat(totalHours) || regHours + otHours;

    if (rate > 0 && total > 0) {
      // Calculate earnings: regular pay + overtime pay (1.5x)
      const regularPay = regHours * rate;
      const overtimePay = otHours * rate * 1.5;
      const calculatedEarnings = regularPay + overtimePay;
      
      // Only update if user hasn't manually edited earnings
      if (!earnings || Math.abs(parseFloat(earnings) - calculatedEarnings) < 0.01) {
        setEarnings(calculatedEarnings.toFixed(2));
      }
    }
  }, [hourlyRate, regularHours, overtimeHours, totalHours]);

  // Update total hours when regular/overtime change
  useEffect(() => {
    const regHours = parseFloat(regularHours) || 0;
    const otHours = parseFloat(overtimeHours) || 0;
    const calculatedTotal = regHours + otHours;
    
    if (calculatedTotal > 0 && (!totalHours || Math.abs(parseFloat(totalHours) - calculatedTotal) < 0.01)) {
      setTotalHours(calculatedTotal.toFixed(2));
    }
  }, [regularHours, overtimeHours]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const rate = hourlyRate ? parseFloat(hourlyRate) : undefined;
      const regHours = regularHours ? parseFloat(regularHours) : undefined;
      const otHours = overtimeHours ? parseFloat(overtimeHours) : undefined;
      const total = totalHours ? parseFloat(totalHours) : undefined;
      const earn = earnings ? parseFloat(earnings) : undefined;

      await onSave({
        hourlyRate: rate,
        regularHours: regHours,
        overtimeHours: otHours,
        totalHours: total,
        earnings: earn,
        notes: notes.trim() || undefined,
      });

      onOpenChange(false);
    } catch (error) {
      console.error('Error saving daily payroll:', error);
      alert('Failed to save daily payroll data');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!onDelete || !currentData?.isOverride) return;
    
    if (!confirm('Are you sure you want to remove this override? It will revert to the original attendance data.')) {
      return;
    }

    setDeleting(true);
    try {
      await onDelete();
      onOpenChange(false);
    } catch (error) {
      console.error('Error deleting override:', error);
      alert('Failed to delete override');
    } finally {
      setDeleting(false);
    }
  };

  if (!date) return null;

  const hasOverride = currentData?.isOverride ?? false;
  const hasOriginalData = originalData && originalData.hours > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            Edit Daily Payroll - {format(date, 'MMMM d, yyyy')}
          </DialogTitle>
          <DialogDescription>
            {hasOverride 
              ? 'This day has a manual override. Edit the values below.'
              : 'Create a manual override for this day. Leave fields empty to use calculated values.'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Original Data Display */}
          {hasOriginalData && originalData && (
            <div className="p-4 bg-muted/50 rounded-lg border-2 border-border">
              <Label className="text-sm font-semibold mb-2 block">Original Attendance Data</Label>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">Hours:</span>{' '}
                  <span className="font-medium">{originalData.hours.toFixed(2)}h</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Regular:</span>{' '}
                  <span className="font-medium">{originalData.regularHours.toFixed(2)}h</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Overtime:</span>{' '}
                  <span className="font-medium">{originalData.overtimeHours.toFixed(2)}h</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Rate:</span>{' '}
                  <span className="font-medium">
                    {originalData.hourlyRate ? `$${originalData.hourlyRate.toFixed(2)}/hr` : 'N/A'}
                  </span>
                </div>
                <div className="col-span-2">
                  <span className="text-muted-foreground">Earnings:</span>{' '}
                  <span className="font-medium">${originalData.earnings.toFixed(2)}</span>
                </div>
              </div>
            </div>
          )}

          {/* Override Indicator */}
          {hasOverride && (
            <div className="p-3 bg-yellow-500/20 dark:bg-yellow-500/30 border-2 border-yellow-300/50 dark:border-yellow-500/30 rounded-md">
              <div className="flex items-center gap-2 text-sm font-semibold text-yellow-700 dark:text-yellow-400">
                <span>⚠️</span>
                <span>Manual Override Active</span>
              </div>
            </div>
          )}

          {/* Form Fields */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="hourlyRate">Hourly Rate ($)</Label>
              <Input
                id="hourlyRate"
                type="number"
                step="0.01"
                min="0"
                value={hourlyRate}
                onChange={(e) => setHourlyRate(e.target.value)}
                placeholder="Enter hourly rate"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="totalHours">Total Hours</Label>
              <Input
                id="totalHours"
                type="number"
                step="0.01"
                min="0"
                max="24"
                value={totalHours}
                onChange={(e) => setTotalHours(e.target.value)}
                placeholder="Total hours"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="regularHours">Regular Hours</Label>
              <Input
                id="regularHours"
                type="number"
                step="0.01"
                min="0"
                value={regularHours}
                onChange={(e) => setRegularHours(e.target.value)}
                placeholder="Regular hours"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="overtimeHours">Overtime Hours</Label>
              <Input
                id="overtimeHours"
                type="number"
                step="0.01"
                min="0"
                value={overtimeHours}
                onChange={(e) => setOvertimeHours(e.target.value)}
                placeholder="Overtime hours"
              />
            </div>

            <div className="space-y-2 col-span-2">
              <Label htmlFor="earnings">Earnings ($)</Label>
              <Input
                id="earnings"
                type="number"
                step="0.01"
                min="0"
                value={earnings}
                onChange={(e) => setEarnings(e.target.value)}
                placeholder="Calculated automatically"
              />
              <p className="text-xs text-muted-foreground">
                Earnings are calculated automatically based on rate and hours, but can be manually overridden
              </p>
            </div>

            <div className="space-y-2 col-span-2">
              <Label htmlFor="notes">Notes</Label>
              <Textarea
                id="notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Optional notes about this override"
                rows={3}
              />
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-between pt-4 border-t">
            <div>
              {hasOverride && onDelete && (
                <Button
                  type="button"
                  variant="destructive"
                  onClick={handleDelete}
                  disabled={deleting}
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  {deleting ? 'Deleting...' : 'Remove Override'}
                </Button>
              )}
            </div>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
              >
                Cancel
              </Button>
              <Button
                type="button"
                onClick={handleSave}
                disabled={saving}
              >
                <Save className="h-4 w-4 mr-2" />
                {saving ? 'Saving...' : 'Save'}
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
