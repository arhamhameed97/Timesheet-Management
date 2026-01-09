'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Save } from 'lucide-react';

interface OvertimeConfig {
  id: string;
  userId: string;
  weeklyThresholdHours: number;
  overtimeMultiplier: number;
}

interface OvertimeConfigProps {
  userId: string;
  onUpdate?: () => void;
}

export function OvertimeConfigComponent({ userId, onUpdate }: OvertimeConfigProps) {
  const [config, setConfig] = useState<OvertimeConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    weeklyThresholdHours: '40',
    overtimeMultiplier: '1.5',
  });

  useEffect(() => {
    fetchConfig();
  }, [userId]);

  const fetchConfig = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/payroll/overtime-config?userId=${userId}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        if (data.overtimeConfigs && data.overtimeConfigs.length > 0) {
          const cfg = data.overtimeConfigs[0];
          setConfig(cfg);
          setFormData({
            weeklyThresholdHours: cfg.weeklyThresholdHours.toString(),
            overtimeMultiplier: cfg.overtimeMultiplier.toString(),
          });
        }
      }
    } catch (error) {
      console.error('Failed to fetch overtime config:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSaving(true);
      const token = localStorage.getItem('token');
      const url = config
        ? `/api/payroll/overtime-config/${config.id}`
        : '/api/payroll/overtime-config';
      const method = config ? 'PATCH' : 'POST';

      const response = await fetch(url, {
        method,
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId,
          weeklyThresholdHours: parseFloat(formData.weeklyThresholdHours),
          overtimeMultiplier: parseFloat(formData.overtimeMultiplier),
        }),
      });

      if (response.ok) {
        fetchConfig();
        if (onUpdate) onUpdate();
        alert('Overtime configuration saved successfully');
      } else {
        const data = await response.json();
        alert(data.error || 'Failed to save overtime configuration');
      }
    } catch (error) {
      console.error('Failed to save overtime config:', error);
      alert('Failed to save overtime configuration');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Overtime Configuration</CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="text-center py-4 text-muted-foreground">Loading...</div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="weeklyThresholdHours">Weekly Threshold Hours *</Label>
              <Input
                id="weeklyThresholdHours"
                type="number"
                step="0.5"
                min="0"
                max="168"
                value={formData.weeklyThresholdHours}
                onChange={(e) => setFormData({ ...formData, weeklyThresholdHours: e.target.value })}
                required
              />
              <p className="text-xs text-muted-foreground">
                Hours worked per week before overtime applies (default: 40 hours)
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="overtimeMultiplier">Overtime Multiplier *</Label>
              <Input
                id="overtimeMultiplier"
                type="number"
                step="0.1"
                min="1"
                value={formData.overtimeMultiplier}
                onChange={(e) => setFormData({ ...formData, overtimeMultiplier: e.target.value })}
                required
              />
              <p className="text-xs text-muted-foreground">
                Multiplier for overtime pay (default: 1.5x = time and a half)
              </p>
            </div>
            <Button type="submit" disabled={saving}>
              <Save className="h-4 w-4 mr-2" />
              {saving ? 'Saving...' : 'Save Configuration'}
            </Button>
          </form>
        )}
      </CardContent>
    </Card>
  );
}
