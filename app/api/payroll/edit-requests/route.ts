import { NextRequest, NextResponse } from 'next/server';
import { getAuthContext, unauthorizedResponse, forbiddenResponse } from '@/lib/middleware-helpers';
import { prisma } from '@/lib/db';
import { UserRole, PayrollEditRequestStatus } from '@prisma/client';

export async function GET(request: NextRequest) {
  try {
    const context = await getAuthContext(request);
    if (!context) {
      return unauthorizedResponse();
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status') as PayrollEditRequestStatus | null;
    const payrollId = searchParams.get('payrollId');

    const where: any = {};

    // Determine which edit requests the user can see
    if (context.role === UserRole.SUPER_ADMIN) {
      // Super admin can see all
    } else if (context.role === UserRole.COMPANY_ADMIN || context.role === UserRole.MANAGER) {
      // Admins/managers can see requests for employees in their company or assigned to them
      where.OR = [
        {
          payroll: {
            user: {
              companyId: context.companyId,
            },
          },
        },
        {
          assignedTo: context.userId,
        },
      ];
    } else {
      // Employees can only see their own requests
      where.requestedBy = context.userId;
    }

    // Apply filters
    if (status) {
      where.status = status;
    }
    if (payrollId) {
      where.payrollId = payrollId;
    }

    const editRequests = await prisma.payrollEditRequest.findMany({
      where,
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
      orderBy: {
        requestedAt: 'desc',
      },
    });

    return NextResponse.json({ editRequests });
  } catch (error) {
    console.error('Get payroll edit requests error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch payroll edit requests' },
      { status: 500 }
    );
  }
}
