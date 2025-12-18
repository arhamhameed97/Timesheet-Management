import { NextRequest, NextResponse } from 'next/server';
import { getAuthContext, unauthorizedResponse, forbiddenResponse } from '@/lib/middleware-helpers';
import { prisma } from '@/lib/db';
import { createDesignationSchema } from '@/lib/validations';
import { UserRole } from '@prisma/client';
import { canAccessCompany } from '@/lib/permissions';

export async function GET(request: NextRequest) {
  try {
    const context = await getAuthContext(request);
    if (!context) {
      return unauthorizedResponse();
    }

    const { searchParams } = new URL(request.url);
    const companyId = searchParams.get('companyId');

    let targetCompanyId = context.companyId;

    // Super admin can view designations for any company
    if (context.role === UserRole.SUPER_ADMIN && companyId) {
      targetCompanyId = companyId;
    }

    if (!targetCompanyId) {
      return NextResponse.json({ designations: [] });
    }

    // Check access
    if (!canAccessCompany(context, targetCompanyId)) {
      return forbiddenResponse();
    }

    const designations = await prisma.designation.findMany({
      where: { companyId: targetCompanyId },
      include: {
        _count: {
          select: {
            users: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({ designations });
  } catch (error) {
    console.error('Get designations error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch designations' },
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

    // Only super admin and company admin can create designations
    if (context.role !== UserRole.SUPER_ADMIN && context.role !== UserRole.COMPANY_ADMIN) {
      return forbiddenResponse('Only admins can create designations');
    }

    const body = await request.json();
    const validatedData = createDesignationSchema.parse(body);

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

    // Check if designation already exists for this company
    const existing = await prisma.designation.findFirst({
      where: {
        companyId,
        name: validatedData.name,
      },
    });

    if (existing) {
      return NextResponse.json(
        { error: 'Designation with this name already exists' },
        { status: 400 }
      );
    }

    const designation = await prisma.designation.create({
      data: {
        name: validatedData.name,
        companyId,
      },
    });

    return NextResponse.json({ designation }, { status: 201 });
  } catch (error: any) {
    if (error.name === 'ZodError') {
      return NextResponse.json(
        { error: 'Validation error', details: error.errors },
        { status: 400 }
      );
    }

    console.error('Create designation error:', error);
    return NextResponse.json(
      { error: 'Failed to create designation' },
      { status: 500 }
    );
  }
}



