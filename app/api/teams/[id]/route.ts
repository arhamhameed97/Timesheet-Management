import { NextRequest, NextResponse } from 'next/server';
import { getAuthContext, unauthorizedResponse, forbiddenResponse } from '@/lib/middleware-helpers';
import { prisma } from '@/lib/db';
import { createTeamSchema, addTeamMemberSchema } from '@/lib/validations';
import { UserRole } from '@prisma/client';
import { canAccessCompany, canManageUser } from '@/lib/permissions';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const context = await getAuthContext(request);
    if (!context) {
      return unauthorizedResponse();
    }

    const team = await prisma.team.findUnique({
      where: { id: params.id },
      include: {
        company: {
          select: {
            id: true,
            name: true,
          },
        },
        manager: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        members: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
                role: true,
              },
            },
          },
        },
        progress: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
              },
            },
          },
          orderBy: { date: 'desc' },
          take: 10,
        },
      },
    });

    if (!team) {
      return NextResponse.json(
        { error: 'Team not found' },
        { status: 404 }
      );
    }

    // Check access
    if (!canAccessCompany(context, team.companyId)) {
      return forbiddenResponse();
    }

    // Check if user is member (for employees/team leads)
    const restrictedRoles: UserRole[] = [UserRole.EMPLOYEE, UserRole.TEAM_LEAD];
    if (restrictedRoles.includes(context.role)) {
      const isMember = team.members.some(m => m.userId === context.userId);
      if (!isMember) {
        return forbiddenResponse('You are not a member of this team');
      }
    }

    return NextResponse.json({ team });
  } catch (error) {
    console.error('Get team error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch team' },
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
    const validatedData = createTeamSchema.partial().parse(body);

    const team = await prisma.team.findUnique({
      where: { id: params.id },
    });

    if (!team) {
      return NextResponse.json(
        { error: 'Team not found' },
        { status: 404 }
      );
    }

    // Check access
    if (!canAccessCompany(context, team.companyId)) {
      return forbiddenResponse();
    }

    // Only admins/managers can update team details
    const allowedRoles: UserRole[] = [UserRole.SUPER_ADMIN, UserRole.COMPANY_ADMIN, UserRole.MANAGER];
    if (!allowedRoles.includes(context.role)) {
      return forbiddenResponse('You do not have permission to update this team');
    }

    // Validate manager if being updated
    if (validatedData.managerId !== undefined) {
      if (validatedData.managerId) {
        const canManage = await canManageUser(context, validatedData.managerId);
        if (!canManage && context.role !== UserRole.SUPER_ADMIN && context.role !== UserRole.COMPANY_ADMIN) {
          return forbiddenResponse('You cannot assign this manager');
        }
      }
    }

    const updated = await prisma.team.update({
      where: { id: params.id },
      data: validatedData,
      include: {
        manager: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        members: {
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
      },
    });

    return NextResponse.json({ team: updated });
  } catch (error: any) {
    if (error.name === 'ZodError') {
      return NextResponse.json(
        { error: 'Validation error', details: error.errors },
        { status: 400 }
      );
    }

    console.error('Update team error:', error);
    return NextResponse.json(
      { error: 'Failed to update team' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const context = await getAuthContext(request);
    if (!context) {
      return unauthorizedResponse();
    }

    const team = await prisma.team.findUnique({
      where: { id: params.id },
    });

    if (!team) {
      return NextResponse.json(
        { error: 'Team not found' },
        { status: 404 }
      );
    }

    // Only super admin and company admin can delete teams
    if (context.role !== UserRole.SUPER_ADMIN && context.role !== UserRole.COMPANY_ADMIN) {
      return forbiddenResponse('Only admins can delete teams');
    }

    // Check access
    if (!canAccessCompany(context, team.companyId)) {
      return forbiddenResponse();
    }

    await prisma.team.delete({
      where: { id: params.id },
    });

    return NextResponse.json({ message: 'Team deleted successfully' });
  } catch (error) {
    console.error('Delete team error:', error);
    return NextResponse.json(
      { error: 'Failed to delete team' },
      { status: 500 }
    );
  }
}



