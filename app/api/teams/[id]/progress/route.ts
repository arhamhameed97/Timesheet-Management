import { NextRequest, NextResponse } from 'next/server';
import { getAuthContext, unauthorizedResponse, forbiddenResponse } from '@/lib/middleware-helpers';
import { prisma } from '@/lib/db';
import { createTeamProgressSchema } from '@/lib/validations';
import { UserRole } from '@prisma/client';
import { canAccessCompany } from '@/lib/permissions';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const context = await getAuthContext(request);
    if (!context) {
      return unauthorizedResponse();
    }

    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

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

    // Check if user is member (for employees/team leads)
    const restrictedRoles: UserRole[] = [UserRole.EMPLOYEE, UserRole.TEAM_LEAD];
    if (restrictedRoles.includes(context.role)) {
      const isMember = await prisma.teamMember.findFirst({
        where: {
          teamId: params.id,
          userId: context.userId,
        },
      });
      if (!isMember) {
        return forbiddenResponse('You are not a member of this team');
      }
    }

    const where: any = { teamId: params.id };
    if (startDate && endDate) {
      where.date = {
        gte: new Date(startDate),
        lte: new Date(endDate),
      };
    }

    const progress = await prisma.teamProgress.findMany({
      where,
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
      orderBy: { date: 'desc' },
    });

    return NextResponse.json({ progress });
  } catch (error) {
    console.error('Get team progress error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch team progress' },
      { status: 500 }
    );
  }
}

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
    const validatedData = createTeamProgressSchema.parse(body);

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

    // Check if user is a member
    const isMember = await prisma.teamMember.findFirst({
      where: {
        teamId: params.id,
        userId: context.userId,
      },
    });

      const allowedRoles: UserRole[] = [UserRole.SUPER_ADMIN, UserRole.COMPANY_ADMIN, UserRole.MANAGER];
      if (!isMember && !allowedRoles.includes(context.role)) {
      return forbiddenResponse('You are not a member of this team');
    }

    const date = validatedData.date ? new Date(validatedData.date) : new Date();

    const progress = await prisma.teamProgress.create({
      data: {
        teamId: params.id,
        userId: context.userId,
        update: validatedData.update,
        date,
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

    return NextResponse.json({ progress }, { status: 201 });
  } catch (error: any) {
    if (error.name === 'ZodError') {
      return NextResponse.json(
        { error: 'Validation error', details: error.errors },
        { status: 400 }
      );
    }

    console.error('Create team progress error:', error);
    return NextResponse.json(
      { error: 'Failed to create progress update' },
      { status: 500 }
    );
  }
}



