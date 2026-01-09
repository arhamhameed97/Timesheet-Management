import { NextRequest, NextResponse } from 'next/server';
import { getAuthContext, unauthorizedResponse, forbiddenResponse } from '@/lib/middleware-helpers';
import { prisma } from '@/lib/db';
import { createPayrollEditRequestSchema } from '@/lib/validations';
import { UserRole, TaskType, TaskStatus, PayrollEditRequestStatus } from '@prisma/client';
import { canManageUser } from '@/lib/permissions';

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const context = await getAuthContext(request);
    if (!context) {
      return unauthorizedResponse();
    }

    const body = await request.json();
    const validationResult = createPayrollEditRequestSchema.safeParse(body);
    
    if (!validationResult.success) {
      return NextResponse.json(
        { error: 'Validation error', details: validationResult.error.errors },
        { status: 400 }
      );
    }

    const validatedData = validationResult.data;

    // Verify payroll exists
    const payroll = await prisma.payroll.findUnique({
      where: { id: params.id },
      include: {
        user: {
          select: {
            id: true,
            companyId: true,
            managerId: true,
          },
        },
      },
    });

    if (!payroll) {
      return NextResponse.json(
        { error: 'Payroll not found' },
        { status: 404 }
      );
    }

    // Check permissions - employees can only request edits to their own payroll
    if (context.role === UserRole.EMPLOYEE) {
      if (payroll.userId !== context.userId) {
        return forbiddenResponse('You can only request edits to your own payroll');
      }
    } else if (context.role !== UserRole.SUPER_ADMIN) {
      // Admins/managers can request edits for employees in their company
      if (payroll.user.companyId !== context.companyId) {
        return forbiddenResponse('You do not have permission to request edits for this payroll');
      }
    }

    // Determine who should approve this request
    let assignedTo: string;
    if (context.role === UserRole.EMPLOYEE) {
      // Employee requests go to their manager or company admin
      if (payroll.user.managerId) {
        assignedTo = payroll.user.managerId;
      } else {
        // Find company admin
        const companyAdmin = await prisma.user.findFirst({
          where: {
            companyId: payroll.user.companyId,
            role: UserRole.COMPANY_ADMIN,
          },
          select: { id: true },
        });
        if (!companyAdmin) {
          return NextResponse.json(
            { error: 'No manager or company admin found to assign this request' },
            { status: 400 }
          );
        }
        assignedTo = companyAdmin.id;
      }
    } else {
      // Admin/manager requests can be self-approved or assigned to another admin
      assignedTo = context.userId; // Self-assign for now, can be enhanced later
    }

    // Store original payroll data
    const originalData = {
      hoursWorked: payroll.hoursWorked,
      hourlyRate: payroll.hourlyRate,
      baseSalary: payroll.baseSalary,
      overtimeHours: payroll.overtimeHours,
      bonuses: payroll.bonuses,
      deductions: payroll.deductions,
      notes: payroll.notes,
    };

    // Create edit request
    const editRequest = await prisma.payrollEditRequest.create({
      data: {
        payrollId: params.id,
        requestedBy: context.userId,
        assignedTo,
        status: PayrollEditRequestStatus.PENDING,
        changes: validatedData.changes,
        originalData,
        notes: validatedData.notes || undefined,
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
      },
    });

    // Create task for approval (only for employee requests)
    if (context.role === UserRole.EMPLOYEE) {
      await prisma.task.create({
        data: {
          title: `Payroll Edit Request - ${payroll.user.name} (${payroll.month}/${payroll.year})`,
          description: `Payroll edit request for ${payroll.user.name}. Review and approve or reject the requested changes.`,
          assignedBy: context.userId,
          dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days from now
          priority: 'MEDIUM',
          status: TaskStatus.PENDING,
          type: TaskType.PAYROLL_EDIT,
          relatedPayrollId: params.id,
          relatedPayrollEditRequestId: editRequest.id,
          assignees: {
            create: {
              userId: assignedTo,
            },
          },
        },
      });
    }

    return NextResponse.json({ editRequest }, { status: 201 });
  } catch (error: any) {
    if (error.name === 'ZodError') {
      return NextResponse.json(
        { error: 'Validation error', details: error.errors },
        { status: 400 }
      );
    }

    console.error('Create payroll edit request error:', error);
    return NextResponse.json(
      { error: 'Failed to create payroll edit request' },
      { status: 500 }
    );
  }
}
