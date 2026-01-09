'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { CheckCircle, XCircle, Clock, AlertCircle } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { PayrollEditRequestStatus } from '@prisma/client';
import { format } from 'date-fns';

interface PayrollEditRequest {
  id: string;
  payrollId: string;
  status: PayrollEditRequestStatus;
  changes: any;
  originalData: any;
  requestedAt: string;
  approvedAt?: string | null;
  approvedBy?: string | null;
  notes?: string | null;
  requester: {
    id: string;
    name: string;
    email: string;
  };
  assignee: {
    id: string;
    name: string;
    email: string;
  };
  approver?: {
    id: string;
    name: string;
    email: string;
  } | null;
  payroll: {
    id: string;
    month: number;
    year: number;
    user: {
      id: string;
      name: string;
      email: string;
    };
  };
}

interface PayrollEditRequestComponentProps {
  payrollId: string;
  onUpdate?: () => void;
  canApprove?: boolean;
}

export function PayrollEditRequestComponent({
  payrollId,
  onUpdate,
  canApprove = false,
}: PayrollEditRequestComponentProps) {
  const [requests, setRequests] = useState<PayrollEditRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedRequest, setSelectedRequest] = useState<PayrollEditRequest | null>(null);
  const [approvalDialogOpen, setApprovalDialogOpen] = useState(false);
  const [approvalNotes, setApprovalNotes] = useState('');
  const [approving, setApproving] = useState(false);

  useEffect(() => {
    fetchRequests();
  }, [payrollId]);

  const fetchRequests = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/payroll/edit-requests?payrollId=${payrollId}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setRequests(data.editRequests || []);
      }
    } catch (error) {
      console.error('Failed to fetch edit requests:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (approved: boolean) => {
    if (!selectedRequest) return;

    try {
      setApproving(true);
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/payroll/edit-requests/${selectedRequest.id}`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          status: approved ? PayrollEditRequestStatus.APPROVED : PayrollEditRequestStatus.REJECTED,
          notes: approvalNotes,
        }),
      });

      if (response.ok) {
        setApprovalDialogOpen(false);
        setSelectedRequest(null);
        setApprovalNotes('');
        fetchRequests();
        if (onUpdate) onUpdate();
        alert(`Edit request ${approved ? 'approved' : 'rejected'} successfully`);
      } else {
        const data = await response.json();
        alert(data.error || `Failed to ${approved ? 'approve' : 'reject'} edit request`);
      }
    } catch (error) {
      console.error('Failed to process edit request:', error);
      alert(`Failed to ${approved ? 'approve' : 'reject'} edit request`);
    } finally {
      setApproving(false);
    }
  };

  const getStatusBadge = (status: PayrollEditRequestStatus) => {
    switch (status) {
      case PayrollEditRequestStatus.APPROVED:
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-semibold bg-green-100 text-green-800">
            <CheckCircle className="h-3 w-3" />
            Approved
          </span>
        );
      case PayrollEditRequestStatus.REJECTED:
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-semibold bg-red-100 text-red-800">
            <XCircle className="h-3 w-3" />
            Rejected
          </span>
        );
      case PayrollEditRequestStatus.PENDING:
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-semibold bg-yellow-100 text-yellow-800">
            <Clock className="h-3 w-3" />
            Pending
          </span>
        );
    }
  };

  const renderChanges = (changes: any) => {
    const changeItems: JSX.Element[] = [];
    
    Object.entries(changes).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        const formattedKey = key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());
        let displayValue: string;
        
        if (key === 'bonuses' || key === 'deductions') {
          displayValue = Array.isArray(value) ? `${value.length} items` : String(value);
        } else if (typeof value === 'number') {
          displayValue = key.includes('Rate') || key.includes('Salary') || key.includes('Pay') || key.includes('amount')
            ? `$${value.toFixed(2)}`
            : value.toString();
        } else {
          displayValue = String(value);
        }
        
        changeItems.push(
          <div key={key} className="flex justify-between py-1 border-b">
            <span className="font-medium">{formattedKey}:</span>
            <span className="text-blue-600">{displayValue}</span>
          </div>
        );
      }
    });
    
    return changeItems.length > 0 ? changeItems : <div className="text-muted-foreground">No changes</div>;
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Payroll Edit Requests</CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="text-center py-4 text-muted-foreground">Loading...</div>
        ) : requests.length === 0 ? (
          <div className="text-center py-4 text-muted-foreground">No edit requests found</div>
        ) : (
          <div className="space-y-4">
            {requests.map((request) => (
              <div
                key={request.id}
                className="p-4 border rounded-lg hover:bg-muted/50"
              >
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      {getStatusBadge(request.status)}
                      <span className="text-sm text-muted-foreground">
                        Requested by {request.requester.name}
                      </span>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {format(new Date(request.requestedAt), 'MMM d, yyyy HH:mm')}
                    </div>
                  </div>
                  {canApprove &&
                    request.status === PayrollEditRequestStatus.PENDING && (
                      <Button
                        size="sm"
                        onClick={() => {
                          setSelectedRequest(request);
                          setApprovalDialogOpen(true);
                        }}
                      >
                        Review
                      </Button>
                    )}
                </div>

                <div className="space-y-2">
                  <div>
                    <Label className="text-xs text-muted-foreground">Requested Changes:</Label>
                    <div className="mt-1 p-2 bg-muted rounded text-sm">
                      {renderChanges(request.changes)}
                    </div>
                  </div>

                  {request.notes && (
                    <div>
                      <Label className="text-xs text-muted-foreground">Notes:</Label>
                      <div className="mt-1 text-sm">{request.notes}</div>
                    </div>
                  )}

                  {request.approvedAt && (
                    <div className="text-xs text-muted-foreground">
                      {request.status === PayrollEditRequestStatus.APPROVED ? 'Approved' : 'Rejected'} by{' '}
                      {request.approver?.name} on{' '}
                      {format(new Date(request.approvedAt), 'MMM d, yyyy HH:mm')}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        <Dialog open={approvalDialogOpen} onOpenChange={setApprovalDialogOpen}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Review Payroll Edit Request</DialogTitle>
              <DialogDescription>
                Review the requested changes and approve or reject them.
              </DialogDescription>
            </DialogHeader>
            {selectedRequest && (
              <div className="space-y-4 py-4">
                <div>
                  <Label className="text-sm font-semibold">Requested Changes:</Label>
                  <div className="mt-2 p-3 bg-muted rounded">
                    {renderChanges(selectedRequest.changes)}
                  </div>
                </div>
                <div>
                  <Label className="text-sm font-semibold">Original Values:</Label>
                  <div className="mt-2 p-3 bg-muted rounded">
                    {renderChanges(selectedRequest.originalData)}
                  </div>
                </div>
                {selectedRequest.notes && (
                  <div>
                    <Label className="text-sm font-semibold">Request Notes:</Label>
                    <div className="mt-2 p-3 bg-muted rounded">{selectedRequest.notes}</div>
                  </div>
                )}
                <div>
                  <Label htmlFor="approvalNotes">Approval Notes (optional)</Label>
                  <Textarea
                    id="approvalNotes"
                    value={approvalNotes}
                    onChange={(e) => setApprovalNotes(e.target.value)}
                    placeholder="Add any notes about your decision..."
                    rows={3}
                  />
                </div>
              </div>
            )}
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => {
                  setApprovalDialogOpen(false);
                  setApprovalNotes('');
                }}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={() => handleApprove(false)}
                disabled={approving}
              >
                <XCircle className="h-4 w-4 mr-2" />
                Reject
              </Button>
              <Button onClick={() => handleApprove(true)} disabled={approving}>
                <CheckCircle className="h-4 w-4 mr-2" />
                {approving ? 'Processing...' : 'Approve'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}
