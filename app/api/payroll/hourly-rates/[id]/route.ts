import { NextRequest, NextResponse } from 'next/server';
import { getAuthContext, unauthorizedResponse, forbiddenResponse } from '@/lib/middleware-helpers';
import { prisma } from '@/lib/db';
import { updateHourlyRatePeriodSchema } from '@/lib/validations';
import { UserRole } from '@prisma/client';
import { canManageUser } from '@/lib/permissions';

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const context = await getAuthContext(request);
    if (!context) {
      return unauthorizedResponse();
    }

    // Only super admin, company admin, and managers can update hourly rate periods
    const allowedRoles: UserRole[] = [UserRole.SUPER_ADMIN, UserRole.COMPANY_ADMIN, UserRole.MANAGER];
    if (!allowedRoles.includes(context.role)) {
      return forbiddenResponse('You do not have permission to update hourly rate periods');
    }

    const body = await request.json();
    const validationResult = updateHourlyRatePeriodSchema.safeParse(body);
    
    if (!validationResult.success) {
      return NextResponse.json(
        { error: 'Validation error', details: validationResult.error.errors },
        { status: 400 }
      );
    }

    const validatedData = validationResult.data;

    const hourlyRatePeriod = await prisma.hourlyRatePeriod.findUnique({
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

    if (!hourlyRatePeriod) {
      return NextResponse.json(
        { error: 'Hourly rate period not found' },
        { status: 404 }
      );
    }

    // Check permissions
    if (context.role !== UserRole.SUPER_ADMIN) {
      if (hourlyRatePeriod.user.companyId !== context.companyId) {
        return forbiddenResponse('You do not have permission to update this hourly rate period');
      }
    }

    // Check for overlapping periods if dates are being updated
    if (validatedData.startDate || validatedData.endDate) {
      const startDate = validatedData.startDate ? new Date(validatedData.startDate) : hourlyRatePeriod.startDate;
      const endDate = validatedData.endDate ? new Date(validatedData.endDate) : hourlyRatePeriod.endDate;

      const overlapping = await prisma.hourlyRatePeriod.findFirst({
        where: {
          userId: hourlyRatePeriod.userId,
          id: { not: params.id },
          OR: [
            {
              startDate: { lte: endDate },
              endDate: { gte: startDate },
            },
          ],
        },
      });

      if (overlapping) {
        return NextResponse.json(
          { error: 'Hourly rate period overlaps with an existing period' },
          { status: 400 }
        );
      }
    }

    const updateData: any = {};
    if (validatedData.startDate) updateData.startDate = new Date(validatedData.startDate);
    if (validatedData.endDate) updateData.endDate = new Date(validatedData.endDate);
    if (validatedData.hourlyRate !== undefined) updateData.hourlyRate = validatedData.hourlyRate;

    const updated = await prisma.hourlyRatePeriod.update({
      where: { id: params.id },
      data: updateData,
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        creator: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    return NextResponse.json({ hourlyRatePeriod: updated });
  } catch (error: any) {
    if (error.name === 'ZodError') {
      return NextResponse.json(
        { error: 'Validation error', details: error.errors },
        { status: 400 }
      );
    }

    console.error('Update hourly rate period error:', error);
    return NextResponse.json(
      { error: 'Failed to update hourly rate period' },
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

    // Only super admin, company admin, and managers can delete hourly rate periods
    const allowedRoles: UserRole[] = [UserRole.SUPER_ADMIN, UserRole.COMPANY_ADMIN, UserRole.MANAGER];
    if (!allowedRoles.includes(context.role)) {
      return forbiddenResponse('You do not have permission to delete hourly rate periods');
    }

    const hourlyRatePeriod = await prisma.hourlyRatePeriod.findUnique({
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

    if (!hourlyRatePeriod) {
      return NextResponse.json(
        { error: 'Hourly rate period not found' },
        { status: 404 }
      );
    }

    // Check permissions
    if (context.role !== UserRole.SUPER_ADMIN) {
      if (hourlyRatePeriod.user.companyId !== context.companyId) {
        return forbiddenResponse('You do not have permission to delete this hourly rate period');
      }
    }

    await prisma.hourlyRatePeriod.delete({
      where: { id: params.id },
    });

    return NextResponse.json({ message: 'Hourly rate period deleted successfully' });
  } catch (error) {
    console.error('Delete hourly rate period error:', error);
    return NextResponse.json(
      { error: 'Failed to delete hourly rate period' },
      { status: 500 }
    );
  }
}
