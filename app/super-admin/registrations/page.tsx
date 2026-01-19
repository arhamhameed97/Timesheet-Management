'use client';

import { useState, useEffect } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Clock, CheckCircle, XCircle, Eye } from 'lucide-react';
import { RegistrationStatus } from '@prisma/client';

interface RegistrationRequest {
  id: string;
  companyName: string;
  companyEmail: string;
  companyAddress: string | null;
  adminName: string;
  adminEmail: string;
  status: RegistrationStatus;
  submittedAt: string;
  reviewedAt: string | null;
  notes: string | null;
  reviewer: {
    id: string;
    name: string;
    email: string;
  } | null;
}

export default function SuperAdminRegistrationsPage() {
  const [requests, setRequests] = useState<RegistrationRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedRequest, setSelectedRequest] = useState<RegistrationRequest | null>(null);
  const [reviewDialogOpen, setReviewDialogOpen] = useState(false);
  const [reviewStatus, setReviewStatus] = useState<RegistrationStatus | null>(null);
  const [reviewNotes, setReviewNotes] = useState('');
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    fetchRequests();
  }, []);

  const fetchRequests = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/company-registrations', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setRequests(data.requests || []);
      }
    } catch (error) {
      console.error('Failed to fetch registration requests:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleReview = (request: RegistrationRequest) => {
    setSelectedRequest(request);
    setReviewStatus(null);
    setReviewNotes('');
    setReviewDialogOpen(true);
  };

  const handleSubmitReview = async () => {
    if (!selectedRequest || !reviewStatus) return;

    setProcessing(true);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/company-registrations/${selectedRequest.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          status: reviewStatus,
          notes: reviewNotes || undefined,
        }),
      });

      if (response.ok) {
        setReviewDialogOpen(false);
        fetchRequests();
      } else {
        const data = await response.json();
        alert(data.error || 'Failed to review request');
      }
    } catch (error) {
      console.error('Failed to review request:', error);
      alert('An error occurred while reviewing the request');
    } finally {
      setProcessing(false);
    }
  };

  const getStatusBadge = (status: RegistrationStatus) => {
    switch (status) {
      case RegistrationStatus.PENDING:
        return (
          <Badge variant="outline" className="flex items-center gap-1">
            <Clock className="h-3 w-3" />
            Pending
          </Badge>
        );
      case RegistrationStatus.APPROVED:
        return (
          <Badge variant="default" className="flex items-center gap-1 bg-green-600">
            <CheckCircle className="h-3 w-3" />
            Approved
          </Badge>
        );
      case RegistrationStatus.REJECTED:
        return (
          <Badge variant="destructive" className="flex items-center gap-1">
            <XCircle className="h-3 w-3" />
            Rejected
          </Badge>
        );
    }
  };

  const pendingRequests = requests.filter((r) => r.status === RegistrationStatus.PENDING);
  const reviewedRequests = requests.filter((r) => r.status !== RegistrationStatus.PENDING);

  return (
    <MainLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Company Registration Requests</h1>
          <p className="text-muted-foreground mt-1">Review and approve company registration requests</p>
        </div>

        {loading ? (
          <Card>
            <CardContent className="py-8">
              <div className="text-center">Loading...</div>
            </CardContent>
          </Card>
        ) : (
          <>
            {pendingRequests.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>Pending Requests ({pendingRequests.length})</CardTitle>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Company Name</TableHead>
                        <TableHead>Company Email</TableHead>
                        <TableHead>Admin Name</TableHead>
                        <TableHead>Admin Email</TableHead>
                        <TableHead>Submitted</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {pendingRequests.map((request) => (
                        <TableRow key={request.id}>
                          <TableCell className="font-medium">{request.companyName}</TableCell>
                          <TableCell>{request.companyEmail}</TableCell>
                          <TableCell>{request.adminName}</TableCell>
                          <TableCell>{request.adminEmail}</TableCell>
                          <TableCell>
                            {new Date(request.submittedAt).toLocaleDateString()}
                          </TableCell>
                          <TableCell>{getStatusBadge(request.status)}</TableCell>
                          <TableCell>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleReview(request)}
                            >
                              <Eye className="h-4 w-4 mr-1" />
                              Review
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            )}

            {reviewedRequests.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>Reviewed Requests ({reviewedRequests.length})</CardTitle>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Company Name</TableHead>
                        <TableHead>Company Email</TableHead>
                        <TableHead>Admin Name</TableHead>
                        <TableHead>Admin Email</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Reviewed By</TableHead>
                        <TableHead>Reviewed At</TableHead>
                        <TableHead>Notes</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {reviewedRequests.map((request) => (
                        <TableRow key={request.id}>
                          <TableCell className="font-medium">{request.companyName}</TableCell>
                          <TableCell>{request.companyEmail}</TableCell>
                          <TableCell>{request.adminName}</TableCell>
                          <TableCell>{request.adminEmail}</TableCell>
                          <TableCell>{getStatusBadge(request.status)}</TableCell>
                          <TableCell>
                            {request.reviewer ? request.reviewer.name : '-'}
                          </TableCell>
                          <TableCell>
                            {request.reviewedAt
                              ? new Date(request.reviewedAt).toLocaleDateString()
                              : '-'}
                          </TableCell>
                          <TableCell className="max-w-xs truncate">
                            {request.notes || '-'}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            )}

            {requests.length === 0 && (
              <Card>
                <CardContent className="py-8">
                  <div className="text-center text-muted-foreground">
                    No registration requests found.
                  </div>
                </CardContent>
              </Card>
            )}
          </>
        )}

        <Dialog open={reviewDialogOpen} onOpenChange={setReviewDialogOpen}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Review Registration Request</DialogTitle>
              <DialogDescription>
                Review the company registration request and approve or reject it.
              </DialogDescription>
            </DialogHeader>

            {selectedRequest && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium">Company Name</label>
                    <p className="text-sm text-muted-foreground">{selectedRequest.companyName}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium">Company Email</label>
                    <p className="text-sm text-muted-foreground">{selectedRequest.companyEmail}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium">Company Address</label>
                    <p className="text-sm text-muted-foreground">
                      {selectedRequest.companyAddress || 'Not provided'}
                    </p>
                  </div>
                  <div>
                    <label className="text-sm font-medium">Admin Name</label>
                    <p className="text-sm text-muted-foreground">{selectedRequest.adminName}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium">Admin Email</label>
                    <p className="text-sm text-muted-foreground">{selectedRequest.adminEmail}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium">Submitted At</label>
                    <p className="text-sm text-muted-foreground">
                      {new Date(selectedRequest.submittedAt).toLocaleString()}
                    </p>
                  </div>
                </div>

                <div>
                  <label className="text-sm font-medium mb-2 block">Decision</label>
                  <div className="flex gap-2">
                    <Button
                      variant={reviewStatus === RegistrationStatus.APPROVED ? 'default' : 'outline'}
                      onClick={() => setReviewStatus(RegistrationStatus.APPROVED)}
                    >
                      <CheckCircle className="h-4 w-4 mr-1" />
                      Approve
                    </Button>
                    <Button
                      variant={reviewStatus === RegistrationStatus.REJECTED ? 'destructive' : 'outline'}
                      onClick={() => setReviewStatus(RegistrationStatus.REJECTED)}
                    >
                      <XCircle className="h-4 w-4 mr-1" />
                      Reject
                    </Button>
                  </div>
                </div>

                <div>
                  <label className="text-sm font-medium mb-2 block">Notes (Optional)</label>
                  <Textarea
                    value={reviewNotes}
                    onChange={(e) => setReviewNotes(e.target.value)}
                    placeholder="Add any notes about this review..."
                    rows={3}
                  />
                </div>
              </div>
            )}

            <DialogFooter>
              <Button variant="outline" onClick={() => setReviewDialogOpen(false)}>
                Cancel
              </Button>
              <Button
                onClick={handleSubmitReview}
                disabled={!reviewStatus || processing}
              >
                {processing ? 'Processing...' : 'Submit Review'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </MainLayout>
  );
}
