import { NextRequest, NextResponse } from 'next/server';
import { getAuthContext, unauthorizedResponse, forbiddenResponse } from '@/lib/middleware-helpers';
import { prisma } from '@/lib/db';
import { addTeamMemberSchema } from '@/lib/validations';
import { UserRole } from '@prisma/client';
import { canAccessCompany, canManageUser } from '@/lib/permissions';

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
    const validatedData = addTeamMemberSchema.parse(body);

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

    // Only admins, managers, and team leads can add members
    const allowedRoles: UserRole[] = [UserRole.SUPER_ADMIN, UserRole.COMPANY_ADMIN, UserRole.MANAGER, UserRole.TEAM_LEAD];
    if (!allowedRoles.includes(context.role)) {
      return forbiddenResponse('You do not have permission to add team members');
    }

    // Team leads can only add to their own teams
    if (context.role === UserRole.TEAM_LEAD) {
      const isLead = await prisma.teamMember.findFirst({
        where: {
          teamId: params.id,
          userId: context.userId,
          role: 'LEAD',
        },
      });
      if (!isLead) {
        return forbiddenResponse('You can only add members to teams you lead');
      }
    }

    // Check if user can be managed
    const canManage = await canManageUser(context, validatedData.userId);
    if (!canManage && context.role !== UserRole.SUPER_ADMIN && context.role !== UserRole.COMPANY_ADMIN) {
      return forbiddenResponse('You cannot add this user to the team');
    }

    // Check if user is already a member
    const existing = await prisma.teamMember.findUnique({
      where: {
        teamId_userId: {
          teamId: params.id,
          userId: validatedData.userId,
        },
      },
    });

    if (existing) {
      return NextResponse.json(
        { error: 'User is already a member of this team' },
        { status: 400 }
      );
    }

    const member = await prisma.teamMember.create({
      data: {
        teamId: params.id,
        userId: validatedData.userId,
        role: validatedData.role || 'MEMBER',
      },
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

    return NextResponse.json({ member }, { status: 201 });
  } catch (error: any) {
    if (error.name === 'ZodError') {
      return NextResponse.json(
        { error: 'Validation error', details: error.errors },
        { status: 400 }
      );
    }

    console.error('Add team member error:', error);
    return NextResponse.json(
      { error: 'Failed to add team member' },
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

    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

    if (!userId) {
      return NextResponse.json(
        { error: 'User ID is required' },
        { status: 400 }
      );
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

    // Check access
    if (!canAccessCompany(context, team.companyId)) {
      return forbiddenResponse();
    }

    // Only admins, managers, and team leads can remove members
    const allowedRoles: UserRole[] = [UserRole.SUPER_ADMIN, UserRole.COMPANY_ADMIN, UserRole.MANAGER, UserRole.TEAM_LEAD];
    if (!allowedRoles.includes(context.role)) {
      return forbiddenResponse('You do not have permission to remove team members');
    }

    // Team leads can only remove from their own teams
    if (context.role === UserRole.TEAM_LEAD) {
      const isLead = await prisma.teamMember.findFirst({
        where: {
          teamId: params.id,
          userId: context.userId,
          role: 'LEAD',
        },
      });
      if (!isLead) {
        return forbiddenResponse('You can only remove members from teams you lead');
      }
    }

    await prisma.teamMember.delete({
      where: {
        teamId_userId: {
          teamId: params.id,
          userId,
        },
      },
    });

    return NextResponse.json({ message: 'Team member removed successfully' });
  } catch (error: any) {
    if (error.code === 'P2025') {
      return NextResponse.json(
        { error: 'Team member not found' },
        { status: 404 }
      );
    }

    console.error('Remove team member error:', error);
    return NextResponse.json(
      { error: 'Failed to remove team member' },
      { status: 500 }
    );
  }
}



