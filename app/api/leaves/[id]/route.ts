import { NextRequest, NextResponse } from 'next/server';
import { getAuthContext, unauthorizedResponse, forbiddenResponse } from '@/lib/middleware-helpers';
import { prisma } from '@/lib/db';
import { updateLeaveSchema } from '@/lib/validations';
import { UserRole, LeaveStatus } from '@prisma/client';
import { canManageUser } from '@/lib/permissions';

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const context = await getAuthContext(request);
    if (!context) {
      return unauthorizedResponse();
    }

    const body = await request.json();
    const validatedData = updateLeaveSchema.parse(body);

    const leave = await prisma.leave.findUnique({
      where: { id: params.id },
    });

    if (!leave) {
      return NextResponse.json(
        { error: 'Leave request not found' },
        { status: 404 }
      );
    }

    // Check permissions
    const canEdit = leave.userId === context.userId ||
      await canManageUser(context, leave.userId);

    if (!canEdit) {
      return forbiddenResponse('You do not have permission to update this leave request');
    }

    // Employees can only cancel their own pending leaves
    if (context.role === UserRole.EMPLOYEE && leave.userId === context.userId) {
      if (validatedData.status && validatedData.status !== LeaveStatus.CANCELLED) {
        return forbiddenResponse('You can only cancel your own leave requests');
      }
      if (leave.status !== LeaveStatus.PENDING) {
        return NextResponse.json(
          { error: 'You can only cancel pending leave requests' },
          { status: 400 }
        );
      }
    }

    // Only managers/admins can approve/reject
    if (validatedData.status === LeaveStatus.APPROVED || 
        validatedData.status === LeaveStatus.REJECTED) {
      const allowedRoles: UserRole[] = [UserRole.SUPER_ADMIN, UserRole.COMPANY_ADMIN, UserRole.MANAGER];
      if (!allowedRoles.includes(context.role)) {
        return forbiddenResponse('You do not have permission to approve/reject leaves');
      }
    }

    const updateData: any = { ...validatedData };
    
    // Set approver and approval time if approving/rejecting
    if (validatedData.status === LeaveStatus.APPROVED || 
        validatedData.status === LeaveStatus.REJECTED) {
      updateData.approvedBy = context.userId;
      updateData.approvedAt = new Date();
    }

    const updated = await prisma.leave.update({
      where: { id: params.id },
      data: updateData,
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    return NextResponse.json({ leave: updated });
  } catch (error: any) {
    if (error.name === 'ZodError') {
      return NextResponse.json(
        { error: 'Validation error', details: error.errors },
        { status: 400 }
      );
    }

    console.error('Update leave error:', error);
    return NextResponse.json(
      { error: 'Failed to update leave request' },
      { status: 500 }
    );
  }
}



