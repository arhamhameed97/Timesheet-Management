import { NextRequest, NextResponse } from 'next/server';
import { getAuthContext, unauthorizedResponse, forbiddenResponse } from '@/lib/middleware-helpers';
import { prisma } from '@/lib/db';
import { UserRole } from '@prisma/client';

export async function GET(request: NextRequest) {
  try {
    const context = await getAuthContext(request);
    if (!context) {
      return unauthorizedResponse();
    }

    if (context.role !== UserRole.SUPER_ADMIN) {
      return forbiddenResponse('Only super admins can access all users');
    }

    // Check if there's a company context override from cookie
    // For SUPER_ADMIN, we check the cookie directly to see if a company context is selected
    const companyContextCookie = request.cookies.get('superAdminCompanyContext')?.value || null;
    
    let where: any = {};

    // If company context cookie is set, filter by that company
    // If null/undefined, show all users (global view)
    if (companyContextCookie) {
      where.companyId = companyContextCookie;
    }
    // If no company context cookie, where remains empty {} which returns all users

    // Fetch all users (including super admins if no company context)
    // If company context is set, super admins won't be included since they don't have companyId
    const users = await prisma.user.findMany({
      where,
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
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    // Remove password from response
    const usersWithoutPassword = users.map(({ password, ...user }) => user);

    return NextResponse.json({ users: usersWithoutPassword });
  } catch (error) {
    console.error('Get all users error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch users' },
      { status: 500 }
    );
  }
}
