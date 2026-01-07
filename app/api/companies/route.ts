import { NextRequest, NextResponse } from 'next/server';
import { getAuthContext, unauthorizedResponse, forbiddenResponse } from '@/lib/middleware-helpers';
import { prisma } from '@/lib/db';
import { UserRole } from '@prisma/client';
import { canAccessCompany } from '@/lib/permissions';

export async function GET(request: NextRequest) {
  try {
    const context = await getAuthContext(request);
    if (!context) {
      return unauthorizedResponse();
    }

    // Super admin can see all companies
    if (context.role === UserRole.SUPER_ADMIN) {
      const companies = await prisma.company.findMany({
        include: {
          _count: {
            select: {
              users: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      });

      return NextResponse.json({ companies });
    }

    // Others can only see their own company
    if (!context.companyId) {
      return NextResponse.json({ companies: [] });
    }

    const company = await prisma.company.findUnique({
      where: { id: context.companyId },
      include: {
        _count: {
          select: {
            users: true,
          },
        },
      },
    });

    return NextResponse.json({ companies: company ? [company] : [] });
  } catch (error) {
    console.error('Get companies error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch companies' },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const context = await getAuthContext(request);
    if (!context) {
      return unauthorizedResponse();
    }

    // Only super admin and company admin can update company
    if (context.role !== UserRole.SUPER_ADMIN && context.role !== UserRole.COMPANY_ADMIN) {
      return forbiddenResponse('Only admins can update company information');
    }

    const body = await request.json();
    const { name, email, address, isActive } = body;

    if (!context.companyId && context.role !== UserRole.SUPER_ADMIN) {
      return NextResponse.json(
        { error: 'Company ID is required' },
        { status: 400 }
      );
    }

    const companyId = context.role === UserRole.SUPER_ADMIN 
      ? body.companyId || context.companyId 
      : context.companyId;

    if (!companyId) {
      return NextResponse.json(
        { error: 'Company ID is required' },
        { status: 400 }
      );
    }

    // Check if company exists and user has access
    if (!canAccessCompany(context, companyId)) {
      return forbiddenResponse();
    }

    const updateData: any = {};
    if (name !== undefined) updateData.name = name;
    if (email !== undefined) updateData.email = email;
    if (address !== undefined) updateData.address = address;
    if (isActive !== undefined && context.role === UserRole.SUPER_ADMIN) {
      updateData.isActive = isActive;
    }

    const company = await prisma.company.update({
      where: { id: companyId },
      data: updateData,
    });

    return NextResponse.json({ company });
  } catch (error: any) {
    if (error.code === 'P2002') {
      return NextResponse.json(
        { error: 'Email already exists' },
        { status: 400 }
      );
    }

    console.error('Update company error:', error);
    return NextResponse.json(
      { error: 'Failed to update company' },
      { status: 500 }
    );
  }
}
















