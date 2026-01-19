import { NextRequest, NextResponse } from 'next/server';
import { getAuthContext, unauthorizedResponse, forbiddenResponse } from '@/lib/middleware-helpers';
import { prisma } from '@/lib/db';
import { UserRole, TaskStatus } from '@prisma/client';

export async function GET(request: NextRequest) {
  try {
    const context = await getAuthContext(request);
    if (!context) {
      return unauthorizedResponse();
    }

    // Only super admin can access this endpoint
    if (context.role !== UserRole.SUPER_ADMIN) {
      return forbiddenResponse('Only super admins can access this endpoint');
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status') as TaskStatus | null;

    let where: any = {};

    // Filter by company context if set
    if (context.companyId) {
      where.creator = {
        companyId: context.companyId,
      };
    }

    // Filter by status if provided
    if (status) {
      where.status = status;
    }

    const tasks = await prisma.task.findMany({
      where,
      include: {
        creator: {
          select: {
            id: true,
            name: true,
            email: true,
            company: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
        approver: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        assignees: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
                company: {
                  select: {
                    id: true,
                    name: true,
                  },
                },
              },
            },
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: 100, // Limit to recent 100 tasks
    });

    return NextResponse.json({ tasks });
  } catch (error) {
    console.error('Get super admin tasks error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch tasks' },
      { status: 500 }
    );
  }
}
