import { NextRequest, NextResponse } from 'next/server';
import { getAuthContext, unauthorizedResponse, forbiddenResponse } from '@/lib/middleware-helpers';
import { prisma } from '@/lib/db';
import { updatePayrollSchema } from '@/lib/validations';
import { UserRole, PayrollStatus } from '@prisma/client';
import { canManageUser } from '@/lib/permissions';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const context = await getAuthContext(request);
    if (!context) {
      return unauthorizedResponse();
    }

    const payroll = await prisma.payroll.findUnique({
      where: { id: params.id },
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

    if (!payroll) {
      return NextResponse.json(
        { error: 'Payroll not found' },
        { status: 404 }
      );
    }

    // Check permissions
    if (payroll.userId !== context.userId) {
      const canView = await canManageUser(context, payroll.userId);
      if (!canView) {
        return forbiddenResponse('You do not have permission to view this payroll');
      }
    }

    return NextResponse.json({ payroll });
  } catch (error) {
    console.error('Get payroll error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch payroll' },
      { status: 500 }
    );
  }
}

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
    const validatedData = updatePayrollSchema.parse(body);

    const payroll = await prisma.payroll.findUnique({
      where: { id: params.id },
    });

    if (!payroll) {
      return NextResponse.json(
        { error: 'Payroll not found' },
        { status: 404 }
      );
    }

    // Check permissions
    const canEdit = payroll.userId === context.userId ||
      await canManageUser(context, payroll.userId);

    if (!canEdit) {
      return forbiddenResponse('You do not have permission to edit this payroll');
    }

    // Employees can only view their own payroll, not edit
    if (context.role === UserRole.EMPLOYEE && payroll.userId === context.userId) {
      return forbiddenResponse('You cannot edit your own payroll');
    }

    // Only admins/managers can approve/reject
    if (validatedData.status === PayrollStatus.APPROVED || 
        validatedData.status === PayrollStatus.REJECTED) {
      const allowedRoles: UserRole[] = [UserRole.SUPER_ADMIN, UserRole.COMPANY_ADMIN, UserRole.MANAGER];
      if (!allowedRoles.includes(context.role)) {
        return forbiddenResponse('You do not have permission to approve/reject payroll');
      }
    }

    // Recalculate net salary if base salary, allowances, or deductions change
    let netSalary = payroll.netSalary;
    if (validatedData.baseSalary !== undefined || 
        validatedData.allowances !== undefined || 
        validatedData.deductions !== undefined) {
      const baseSalary = validatedData.baseSalary ?? payroll.baseSalary;
      const allowances = validatedData.allowances ?? payroll.allowances;
      const deductions = validatedData.deductions ?? payroll.deductions;
      netSalary = baseSalary + allowances - deductions;
    }

    const updateData: any = { ...validatedData, netSalary };
    
    // Set approver and approval time if approving
    if (validatedData.status === PayrollStatus.APPROVED) {
      updateData.approvedBy = context.userId;
      updateData.approvedAt = new Date();
    }

    // Set paid time if marking as paid
    if (validatedData.status === PayrollStatus.PAID) {
      updateData.paidAt = new Date();
    }

    const updated = await prisma.payroll.update({
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

    return NextResponse.json({ payroll: updated });
  } catch (error: any) {
    if (error.name === 'ZodError') {
      return NextResponse.json(
        { error: 'Validation error', details: error.errors },
        { status: 400 }
      );
    }

    console.error('Update payroll error:', error);
    return NextResponse.json(
      { error: 'Failed to update payroll' },
      { status: 500 }
    );
  }
}



