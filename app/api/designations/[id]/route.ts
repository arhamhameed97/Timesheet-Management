import { NextRequest, NextResponse } from 'next/server';
import { getAuthContext, unauthorizedResponse, forbiddenResponse } from '@/lib/middleware-helpers';
import { prisma } from '@/lib/db';
import { createDesignationSchema } from '@/lib/validations';
import { UserRole } from '@prisma/client';
import { canAccessCompany } from '@/lib/permissions';

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const context = await getAuthContext(request);
    if (!context) {
      return unauthorizedResponse();
    }

    // Only super admin and company admin can update designations
    if (context.role !== UserRole.SUPER_ADMIN && context.role !== UserRole.COMPANY_ADMIN) {
      return forbiddenResponse('Only admins can update designations');
    }

    const body = await request.json();
    const validatedData = createDesignationSchema.parse(body);

    const designation = await prisma.designation.findUnique({
      where: { id: params.id },
    });

    if (!designation) {
      return NextResponse.json(
        { error: 'Designation not found' },
        { status: 404 }
      );
    }

    // Check access
    if (!canAccessCompany(context, designation.companyId)) {
      return forbiddenResponse();
    }

    const updated = await prisma.designation.update({
      where: { id: params.id },
      data: { name: validatedData.name },
    });

    return NextResponse.json({ designation: updated });
  } catch (error: any) {
    if (error.name === 'ZodError') {
      return NextResponse.json(
        { error: 'Validation error', details: error.errors },
        { status: 400 }
      );
    }

    console.error('Update designation error:', error);
    return NextResponse.json(
      { error: 'Failed to update designation' },
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

    // Only super admin and company admin can delete designations
    if (context.role !== UserRole.SUPER_ADMIN && context.role !== UserRole.COMPANY_ADMIN) {
      return forbiddenResponse('Only admins can delete designations');
    }

    const designation = await prisma.designation.findUnique({
      where: { id: params.id },
    });

    if (!designation) {
      return NextResponse.json(
        { error: 'Designation not found' },
        { status: 404 }
      );
    }

    // Check access
    if (!canAccessCompany(context, designation.companyId)) {
      return forbiddenResponse();
    }

    await prisma.designation.delete({
      where: { id: params.id },
    });

    return NextResponse.json({ message: 'Designation deleted successfully' });
  } catch (error: any) {
    if (error.code === 'P2003') {
      return NextResponse.json(
        { error: 'Cannot delete designation that is assigned to employees' },
        { status: 400 }
      );
    }

    console.error('Delete designation error:', error);
    return NextResponse.json(
      { error: 'Failed to delete designation' },
      { status: 500 }
    );
  }
}



