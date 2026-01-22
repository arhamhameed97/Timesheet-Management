import { NextRequest, NextResponse } from 'next/server';
import { getAuthContext, unauthorizedResponse, forbiddenResponse } from '@/lib/middleware-helpers';
import { prisma } from '@/lib/db';
import { generateToken } from '@/lib/auth';
import { UserRole } from '@prisma/client';

export async function POST(request: NextRequest) {
  try {
    const context = await getAuthContext(request);
    if (!context) {
      return unauthorizedResponse();
    }

    const body = await request.json();
    const { userId } = body;

    if (!userId) {
      return NextResponse.json(
        { error: 'User ID is required' },
        { status: 400 }
      );
    }

    // Get target user
    const targetUser = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        company: {
          select: {
            id: true,
            name: true,
            isActive: true,
          },
        },
      },
    });

    if (!targetUser) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    // Check if target user is active
    if (!targetUser.isActive) {
      return NextResponse.json(
        { error: 'Cannot impersonate inactive user' },
        { status: 403 }
      );
    }

    // Check if target user's company is active (if applicable)
    if (targetUser.company && !targetUser.company.isActive) {
      return NextResponse.json(
        { error: 'Cannot impersonate user from inactive company' },
        { status: 403 }
      );
    }

    // Validate impersonation permissions
    let canImpersonate = false;

    if (context.role === UserRole.SUPER_ADMIN) {
      // Super admin can impersonate anyone
      canImpersonate = true;
    } else if (context.role === UserRole.COMPANY_ADMIN) {
      // Company admin can impersonate anyone except super admins in their company
      if (targetUser.role === UserRole.SUPER_ADMIN) {
        canImpersonate = false;
      } else if (targetUser.companyId === context.companyId) {
        canImpersonate = true;
      }
    } else if (context.role === UserRole.MANAGER) {
      // Managers can only impersonate EMPLOYEEs in their company
      if (targetUser.role === UserRole.EMPLOYEE && targetUser.companyId === context.companyId) {
        canImpersonate = true;
      }
    }

    if (!canImpersonate) {
      return forbiddenResponse('You do not have permission to impersonate this user');
    }

    // Generate token for target user
    const impersonationToken = generateToken({
      userId: targetUser.id,
      email: targetUser.email,
      role: targetUser.role,
      companyId: targetUser.companyId,
    });

    // Return token and user info
    return NextResponse.json({
      token: impersonationToken,
      user: {
        id: targetUser.id,
        name: targetUser.name,
        email: targetUser.email,
        role: targetUser.role,
        companyId: targetUser.companyId,
        company: targetUser.company,
      },
    });
  } catch (error) {
    console.error('Impersonation error:', error);
    return NextResponse.json(
      { error: 'Failed to impersonate user' },
      { status: 500 }
    );
  }
}
