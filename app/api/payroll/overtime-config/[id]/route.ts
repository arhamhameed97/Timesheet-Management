import { NextRequest, NextResponse } from 'next/server';
import { getAuthContext, unauthorizedResponse, forbiddenResponse } from '@/lib/middleware-helpers';
import { prisma } from '@/lib/db';
import { updateOvertimeConfigSchema } from '@/lib/validations';
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

    // Only super admin, company admin, and managers can update overtime configs
    const allowedRoles: UserRole[] = [UserRole.SUPER_ADMIN, UserRole.COMPANY_ADMIN, UserRole.MANAGER];
    if (!allowedRoles.includes(context.role)) {
      return forbiddenResponse('You do not have permission to update overtime configurations');
    }

    const body = await request.json();
    const validationResult = updateOvertimeConfigSchema.safeParse(body);
    
    if (!validationResult.success) {
      return NextResponse.json(
        { error: 'Validation error', details: validationResult.error.errors },
        { status: 400 }
      );
    }

    const validatedData = validationResult.data;

    const overtimeConfig = await prisma.overtimeConfig.findUnique({
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

    if (!overtimeConfig) {
      return NextResponse.json(
        { error: 'Overtime configuration not found' },
        { status: 404 }
      );
    }

    // Check permissions
    if (context.role !== UserRole.SUPER_ADMIN) {
      if (overtimeConfig.user.companyId !== context.companyId) {
        return forbiddenResponse('You do not have permission to update this overtime configuration');
      }
    }

    const updateData: any = {};
    if (validatedData.weeklyThresholdHours !== undefined) {
      updateData.weeklyThresholdHours = validatedData.weeklyThresholdHours;
    }
    if (validatedData.overtimeMultiplier !== undefined) {
      updateData.overtimeMultiplier = validatedData.overtimeMultiplier;
    }

    const updated = await prisma.overtimeConfig.update({
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

    return NextResponse.json({ overtimeConfig: updated });
  } catch (error: any) {
    if (error.name === 'ZodError') {
      return NextResponse.json(
        { error: 'Validation error', details: error.errors },
        { status: 400 }
      );
    }

    console.error('Update overtime config error:', error);
    return NextResponse.json(
      { error: 'Failed to update overtime configuration' },
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

    // Only super admin, company admin, and managers can delete overtime configs
    const allowedRoles: UserRole[] = [UserRole.SUPER_ADMIN, UserRole.COMPANY_ADMIN, UserRole.MANAGER];
    if (!allowedRoles.includes(context.role)) {
      return forbiddenResponse('You do not have permission to delete overtime configurations');
    }

    const overtimeConfig = await prisma.overtimeConfig.findUnique({
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

    if (!overtimeConfig) {
      return NextResponse.json(
        { error: 'Overtime configuration not found' },
        { status: 404 }
      );
    }

    // Check permissions
    if (context.role !== UserRole.SUPER_ADMIN) {
      if (overtimeConfig.user.companyId !== context.companyId) {
        return forbiddenResponse('You do not have permission to delete this overtime configuration');
      }
    }

    await prisma.overtimeConfig.delete({
      where: { id: params.id },
    });

    return NextResponse.json({ message: 'Overtime configuration deleted successfully' });
  } catch (error) {
    console.error('Delete overtime config error:', error);
    return NextResponse.json(
      { error: 'Failed to delete overtime configuration' },
      { status: 500 }
    );
  }
}
