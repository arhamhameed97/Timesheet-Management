import { NextRequest, NextResponse } from 'next/server';
import { getAuthContext, unauthorizedResponse, forbiddenResponse } from '@/lib/middleware-helpers';
import { prisma } from '@/lib/db';
import { updateEmployeeSchema } from '@/lib/validations';
import { UserRole } from '@prisma/client';
import { canManageUser, canUpdateRole } from '@/lib/permissions';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const context = await getAuthContext(request);
    if (!context) {
      return unauthorizedResponse();
    }

    const canView = await canManageUser(context, params.id);
    if (!canView) {
      return forbiddenResponse('You do not have permission to view this employee');
    }

    const employee = await prisma.user.findUnique({
      where: { id: params.id },
      include: {
        company: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        designation: {
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
        subordinates: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
          },
        },
      },
    });

    if (!employee) {
      return NextResponse.json(
        { error: 'Employee not found' },
        { status: 404 }
      );
    }

    const { password, ...employeeWithoutPassword } = employee;

    return NextResponse.json({ employee: employeeWithoutPassword });
  } catch (error) {
    console.error('Get employee error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch employee' },
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

    const canManage = await canManageUser(context, params.id);
    if (!canManage) {
      return forbiddenResponse('You do not have permission to update this employee');
    }

    const body = await request.json();
    const validatedData = updateEmployeeSchema.parse(body);

    // Get current user data to check role changes
    const currentUser = await prisma.user.findUnique({
      where: { id: params.id },
      select: { role: true },
    });

    if (!currentUser) {
      return NextResponse.json(
        { error: 'Employee not found' },
        { status: 404 }
      );
    }

    // Check role assignment permissions if role is being changed
    if (validatedData.role !== undefined && validatedData.role !== currentUser.role) {
      if (!canUpdateRole(context.role, currentUser.role, validatedData.role)) {
        return forbiddenResponse(`You do not have permission to assign role: ${validatedData.role}`);
      }
    }

    // Employees can only update their own basic info (not role, manager, etc.)
    if (context.role === UserRole.EMPLOYEE && params.id !== context.userId) {
      return forbiddenResponse('You can only update your own profile');
    }

    // Restrict what employees can update
    if (context.role === UserRole.EMPLOYEE) {
      const restrictedFields = ['role', 'managerId', 'isActive', 'companyId'];
      for (const field of restrictedFields) {
        if (field in validatedData) {
          delete (validatedData as any)[field];
        }
      }
    }

    // Validate manager if being updated
    if (validatedData.managerId !== undefined && validatedData.managerId !== null) {
      const canManageManager = await canManageUser(context, validatedData.managerId);
      if (!canManageManager && context.role !== UserRole.SUPER_ADMIN && context.role !== UserRole.COMPANY_ADMIN) {
        return forbiddenResponse('You cannot assign this manager');
      }
    }

    const employee = await prisma.user.update({
      where: { id: params.id },
      data: validatedData,
      include: {
        company: {
          select: {
            id: true,
            name: true,
          },
        },
        designation: {
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
      },
    });

    const { password, ...employeeWithoutPassword } = employee;

    return NextResponse.json({ employee: employeeWithoutPassword });
  } catch (error: any) {
    if (error.name === 'ZodError') {
      return NextResponse.json(
        { error: 'Validation error', details: error.errors },
        { status: 400 }
      );
    }

    if (error.code === 'P2025') {
      return NextResponse.json(
        { error: 'Employee not found' },
        { status: 404 }
      );
    }

    console.error('Update employee error:', error);
    return NextResponse.json(
      { error: 'Failed to update employee' },
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

    // Only super admin and company admin can delete employees
    if (context.role !== UserRole.SUPER_ADMIN && context.role !== UserRole.COMPANY_ADMIN) {
      return forbiddenResponse('You do not have permission to delete employees');
    }

    const canManage = await canManageUser(context, params.id);
    if (!canManage) {
      return forbiddenResponse('You do not have permission to delete this employee');
    }

    // Soft delete by setting isActive to false
    await prisma.user.update({
      where: { id: params.id },
      data: { isActive: false },
    });

    return NextResponse.json({ message: 'Employee deactivated successfully' });
  } catch (error: any) {
    if (error.code === 'P2025') {
      return NextResponse.json(
        { error: 'Employee not found' },
        { status: 404 }
      );
    }

    console.error('Delete employee error:', error);
    return NextResponse.json(
      { error: 'Failed to delete employee' },
      { status: 500 }
    );
  }
}



