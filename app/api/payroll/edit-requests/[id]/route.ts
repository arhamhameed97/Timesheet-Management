import { NextRequest, NextResponse } from 'next/server';
import { getAuthContext, unauthorizedResponse, forbiddenResponse } from '@/lib/middleware-helpers';
import { prisma } from '@/lib/db';
import { updatePayrollEditRequestSchema } from '@/lib/validations';
import { UserRole, PayrollEditRequestStatus, TaskStatus, TaskType } from '@prisma/client';
import { canManageUser } from '@/lib/permissions';
import {
  calculateTotalBonuses,
  calculateTotalDeductions,
  calculateNetSalary,
} from '@/lib/payroll-helpers';

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
    const validationResult = updatePayrollEditRequestSchema.safeParse(body);
    
    if (!validationResult.success) {
      return NextResponse.json(
        { error: 'Validation error', details: validationResult.error.errors },
        { status: 400 }
      );
    }

    const validatedData = validationResult.data;

    const editRequest = await prisma.payrollEditRequest.findUnique({
      where: { id: params.id },
      include: {
        payroll: {
          include: {
            user: {
              select: {
                id: true,
                companyId: true,
              },
            },
          },
        },
        task: true,
      },
    });

    if (!editRequest) {
      return NextResponse.json(
        { error: 'Payroll edit request not found' },
        { status: 404 }
      );
    }

    // Check permissions - only assigned approver or admins/managers can approve/reject
    const allowedRoles: UserRole[] = [UserRole.SUPER_ADMIN, UserRole.COMPANY_ADMIN, UserRole.MANAGER];
    const canApprove = 
      allowedRoles.includes(context.role) &&
      (editRequest.assignedTo === context.userId || 
       editRequest.payroll.user.companyId === context.companyId ||
       context.role === UserRole.SUPER_ADMIN);

    if (!canApprove && validatedData.status) {
      return forbiddenResponse('You do not have permission to approve or reject this request');
    }

    // If approving, apply changes to payroll
    if (validatedData.status === PayrollEditRequestStatus.APPROVED) {
      if (editRequest.status !== PayrollEditRequestStatus.PENDING) {
        return NextResponse.json(
          { error: 'Only pending requests can be approved' },
          { status: 400 }
        );
      }

      const changes = editRequest.changes as any;
      const updateData: any = {};

      // Apply changes
      if (changes.hoursWorked !== undefined) updateData.hoursWorked = changes.hoursWorked;
      if (changes.hourlyRate !== undefined) updateData.hourlyRate = changes.hourlyRate;
      if (changes.baseSalary !== undefined) updateData.baseSalary = changes.baseSalary;
      if (changes.overtimeHours !== undefined) updateData.overtimeHours = changes.overtimeHours;
      if (changes.bonuses !== undefined) {
        updateData.bonuses = changes.bonuses.length > 0 ? changes.bonuses : null;
        updateData.totalBonuses = calculateTotalBonuses(changes.bonuses);
      }
      if (changes.deductions !== undefined) {
        updateData.deductions = changes.deductions.length > 0 ? changes.deductions : null;
        updateData.totalDeductions = calculateTotalDeductions(changes.deductions);
      }
      if (changes.notes !== undefined) updateData.notes = changes.notes;

      // Recalculate net salary
      const baseSalary = updateData.baseSalary ?? editRequest.payroll.baseSalary;
      const bonuses = changes.bonuses ?? (editRequest.payroll.bonuses ? (typeof editRequest.payroll.bonuses === 'string' ? JSON.parse(editRequest.payroll.bonuses as string) : editRequest.payroll.bonuses) : []);
      const deductions = changes.deductions ?? (editRequest.payroll.deductions ? (typeof editRequest.payroll.deductions === 'string' ? JSON.parse(editRequest.payroll.deductions as string) : editRequest.payroll.deductions) : []);
      updateData.netSalary = calculateNetSalary(baseSalary, bonuses, deductions);

      // Update payroll
      await prisma.payroll.update({
        where: { id: editRequest.payrollId },
        data: updateData,
      });

      // Update edit request
      const updatedRequest = await prisma.payrollEditRequest.update({
        where: { id: params.id },
        data: {
          status: PayrollEditRequestStatus.APPROVED,
          approvedBy: context.userId,
          approvedAt: new Date(),
          notes: validatedData.notes || editRequest.notes || undefined,
        },
        include: {
          payroll: {
            include: {
              user: {
                select: {
                  id: true,
                  name: true,
                  email: true,
                },
              },
            },
          },
          requester: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
          assignee: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
          approver: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
      });

      // Update related task if exists
      if (editRequest.task) {
        await prisma.task.update({
          where: { id: editRequest.task.id },
          data: {
            status: TaskStatus.APPROVED,
            approvedBy: context.userId,
            approvedAt: new Date(),
          },
        });
      }

      return NextResponse.json({ editRequest: updatedRequest });
    } else if (validatedData.status === PayrollEditRequestStatus.REJECTED) {
      if (editRequest.status !== PayrollEditRequestStatus.PENDING) {
        return NextResponse.json(
          { error: 'Only pending requests can be rejected' },
          { status: 400 }
        );
      }

      const updatedRequest = await prisma.payrollEditRequest.update({
        where: { id: params.id },
        data: {
          status: PayrollEditRequestStatus.REJECTED,
          approvedBy: context.userId,
          approvedAt: new Date(),
          notes: validatedData.notes || editRequest.notes || undefined,
        },
        include: {
          payroll: {
            include: {
              user: {
                select: {
                  id: true,
                  name: true,
                  email: true,
                },
              },
            },
          },
          requester: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
          assignee: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
          approver: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
      });

      // Update related task if exists
      if (editRequest.task) {
        await prisma.task.update({
          where: { id: editRequest.task.id },
          data: {
            status: TaskStatus.CANCELLED,
          },
        });
      }

      return NextResponse.json({ editRequest: updatedRequest });
    } else {
      // Just update notes
      const updatedRequest = await prisma.payrollEditRequest.update({
        where: { id: params.id },
        data: {
          notes: validatedData.notes,
        },
        include: {
          payroll: {
            include: {
              user: {
                select: {
                  id: true,
                  name: true,
                  email: true,
                },
              },
            },
          },
          requester: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
          assignee: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
          approver: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
      });

      return NextResponse.json({ editRequest: updatedRequest });
    }
  } catch (error: any) {
    if (error.name === 'ZodError') {
      return NextResponse.json(
        { error: 'Validation error', details: error.errors },
        { status: 400 }
      );
    }

    console.error('Update payroll edit request error:', error);
    return NextResponse.json(
      { error: 'Failed to update payroll edit request' },
      { status: 500 }
    );
  }
}
