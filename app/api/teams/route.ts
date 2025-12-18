import { NextRequest, NextResponse } from 'next/server';
import { getAuthContext, unauthorizedResponse, forbiddenResponse } from '@/lib/middleware-helpers';
import { prisma } from '@/lib/db';
import { createTeamSchema } from '@/lib/validations';
import { UserRole } from '@prisma/client';
import { canAccessCompany, canManageUser } from '@/lib/permissions';

export async function GET(request: NextRequest) {
  try {
    const context = await getAuthContext(request);
    if (!context) {
      return unauthorizedResponse();
    }

    const { searchParams } = new URL(request.url);
    const companyId = searchParams.get('companyId');

    let targetCompanyId = context.companyId;

    // Super admin can view teams for any company
    if (context.role === UserRole.SUPER_ADMIN && companyId) {
      targetCompanyId = companyId;
    }

    if (!targetCompanyId) {
      return NextResponse.json({ teams: [] });
    }

    // Check access
    if (!canAccessCompany(context, targetCompanyId)) {
      return forbiddenResponse();
    }

    // Filter teams based on role
    const where: any = { companyId: targetCompanyId };

    // Team leads can only see teams they're part of
    if (context.role === UserRole.TEAM_LEAD) {
      const userTeams = await prisma.teamMember.findMany({
        where: { userId: context.userId },
        select: { teamId: true },
      });
      const teamIds = userTeams.map(t => t.teamId);
      where.id = { in: teamIds };
    }

    // Employees can only see teams they're members of
    if (context.role === UserRole.EMPLOYEE) {
      const userTeams = await prisma.teamMember.findMany({
        where: { userId: context.userId },
        select: { teamId: true },
      });
      const teamIds = userTeams.map(t => t.teamId);
      where.id = { in: teamIds };
    }

    const teams = await prisma.team.findMany({
      where,
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
        _count: {
          select: {
            members: true,
            progress: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({ teams });
  } catch (error) {
    console.error('Get teams error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch teams' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const context = await getAuthContext(request);
    if (!context) {
      return unauthorizedResponse();
    }

    // Only super admin, company admin, managers, and team leads can create teams
    const allowedRoles: UserRole[] = [UserRole.SUPER_ADMIN, UserRole.COMPANY_ADMIN, UserRole.MANAGER, UserRole.TEAM_LEAD];
    if (!allowedRoles.includes(context.role)) {
      return forbiddenResponse('You do not have permission to create teams');
    }

    const body = await request.json();
    const validatedData = createTeamSchema.parse(body);

    let companyId = context.companyId;
    if (context.role === UserRole.SUPER_ADMIN && body.companyId) {
      companyId = body.companyId;
    }

    if (!companyId) {
      return NextResponse.json(
        { error: 'Company ID is required' },
        { status: 400 }
      );
    }

    // Check access
    if (!canAccessCompany(context, companyId)) {
      return forbiddenResponse();
    }

    // Validate manager if provided
    if (validatedData.managerId) {
      const canManage = await canManageUser(context, validatedData.managerId);
      if (!canManage && context.role !== UserRole.SUPER_ADMIN && context.role !== UserRole.COMPANY_ADMIN) {
        return forbiddenResponse('You cannot assign this manager');
      }
    }

    const team = await prisma.team.create({
      data: {
        name: validatedData.name,
        companyId,
        managerId: validatedData.managerId || null,
        description: validatedData.description || null,
      },
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

    return NextResponse.json({ team }, { status: 201 });
  } catch (error: any) {
    if (error.name === 'ZodError') {
      return NextResponse.json(
        { error: 'Validation error', details: error.errors },
        { status: 400 }
      );
    }

    console.error('Create team error:', error);
    return NextResponse.json(
      { error: 'Failed to create team' },
      { status: 500 }
    );
  }
}



