import { NextRequest, NextResponse } from 'next/server';
import { getAuthContext, unauthorizedResponse, forbiddenResponse } from '@/lib/middleware-helpers';
import { recalculateMonthlyPayroll } from '@/lib/payroll-helpers';
import { canManageUser } from '@/lib/permissions';
import { UserRole } from '@prisma/client';
import { prisma } from '@/lib/db';

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const context = await getAuthContext(request);
    if (!context) {
      return unauthorizedResponse();
    }

    // Only admins/managers can recalculate payroll
    if (context.role === UserRole.EMPLOYEE) {
      return forbiddenResponse('Only admins and managers can recalculate payroll');
    }

    // Get payroll
    const payroll = await prisma.payroll.findUnique({
      where: { id: params.id },
      include: {
        user: {
          select: {
            id: true,
            companyId: true,
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
    const canManage = await canManageUser(context, payroll.userId);
    if (!canManage) {
      return forbiddenResponse('You do not have permission to recalculate this payroll');
    }

    // Recalculate payroll
    const updatedPayroll = await recalculateMonthlyPayroll(params.id);

    // Fetch full payroll record for response
    const fullPayroll = await prisma.payroll.findUnique({
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

    // Parse bonuses and deductions
    const payrollResponse = {
      ...fullPayroll!,
      bonuses: fullPayroll!.bonuses ? (typeof fullPayroll!.bonuses === 'string' ? JSON.parse(fullPayroll!.bonuses as string) : fullPayroll!.bonuses) : [],
      deductions: fullPayroll!.deductions ? (typeof fullPayroll!.deductions === 'string' ? JSON.parse(fullPayroll!.deductions as string) : fullPayroll!.deductions) : [],
    };

    return NextResponse.json({
      payroll: payrollResponse,
      recalculated: updatedPayroll,
    });
  } catch (error: any) {
    console.error('Recalculate payroll error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to recalculate payroll' },
      { status: 500 }
    );
  }
}
