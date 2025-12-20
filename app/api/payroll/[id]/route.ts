import { NextRequest, NextResponse } from 'next/server';
import { getAuthContext, unauthorizedResponse, forbiddenResponse } from '@/lib/middleware-helpers';
import { prisma } from '@/lib/db';
import { updatePayrollSchema } from '@/lib/validations';
import { UserRole, PayrollStatus } from '@prisma/client';
import { canManageUser } from '@/lib/permissions';
import {
  calculateTotalBonuses,
  calculateTotalDeductions,
  calculateNetSalary,
} from '@/lib/payroll-helpers';

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

    // Parse bonuses and deductions from JSON
    const payrollResponse = {
      ...payroll,
      bonuses: payroll.bonuses ? (typeof payroll.bonuses === 'string' ? JSON.parse(payroll.bonuses) : payroll.bonuses) : [],
      deductions: payroll.deductions ? (typeof payroll.deductions === 'string' ? JSON.parse(payroll.deductions) : payroll.deductions) : [],
    };

    return NextResponse.json({ payroll: payrollResponse });
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

    // Prepare update data
    const updateData: any = { ...validatedData };

    // Handle bonuses and deductions
    let bonuses = validatedData.bonuses;
    let deductions = validatedData.deductions;

    // If not provided, use existing values
    if (!bonuses) {
      bonuses = payroll.bonuses ? (typeof payroll.bonuses === 'string' ? JSON.parse(payroll.bonuses as string) : payroll.bonuses) : [];
    }
    if (!deductions) {
      deductions = payroll.deductions ? (typeof payroll.deductions === 'string' ? JSON.parse(payroll.deductions as string) : payroll.deductions) : [];
    }

    // Calculate totals
    const totalBonuses = calculateTotalBonuses(bonuses);
    const totalDeductions = calculateTotalDeductions(deductions);

    // Recalculate net salary if base salary, bonuses, or deductions change
    const baseSalary = validatedData.baseSalary ?? payroll.baseSalary;
    const netSalary = calculateNetSalary(baseSalary, bonuses, deductions);

    updateData.totalBonuses = totalBonuses;
    updateData.totalDeductions = totalDeductions;
    updateData.netSalary = netSalary;
    
    // Store bonuses and deductions as JSON
    if (validatedData.bonuses !== undefined) {
      updateData.bonuses = bonuses.length > 0 ? bonuses : null;
    }
    if (validatedData.deductions !== undefined) {
      updateData.deductions = deductions.length > 0 ? deductions : null;
    }
    
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

    // Parse bonuses and deductions for response
    const payrollResponse = {
      ...updated,
      bonuses: updated.bonuses ? (typeof updated.bonuses === 'string' ? JSON.parse(updated.bonuses as string) : updated.bonuses) : [],
      deductions: updated.deductions ? (typeof updated.deductions === 'string' ? JSON.parse(updated.deductions as string) : updated.deductions) : [],
    };

    return NextResponse.json({ payroll: payrollResponse });
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



