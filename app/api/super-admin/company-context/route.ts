import { NextRequest, NextResponse } from 'next/server';
import { getAuthContext, unauthorizedResponse, forbiddenResponse } from '@/lib/middleware-helpers';
import { prisma } from '@/lib/db';
import { UserRole } from '@prisma/client';

// Get current company context
export async function GET(request: NextRequest) {
  try {
    const context = await getAuthContext(request);
    if (!context) {
      return unauthorizedResponse();
    }

    if (context.role !== UserRole.SUPER_ADMIN) {
      return forbiddenResponse('Only super admins can access company context');
    }

    // Get company context from cookie
    const companyContextId = request.cookies.get('superAdminCompanyContext')?.value || null;

    if (!companyContextId) {
      return NextResponse.json({ companyId: null });
    }

    // Verify company exists
    const company = await prisma.company.findUnique({
      where: { id: companyContextId },
      select: {
        id: true,
        name: true,
        email: true,
      },
    });

    if (!company) {
      // Clear invalid cookie
      const response = NextResponse.json({ companyId: null });
      response.cookies.delete('superAdminCompanyContext');
      return response;
    }

    return NextResponse.json({ companyId: company.id, company });
  } catch (error) {
    console.error('Get company context error:', error);
    return NextResponse.json(
      { error: 'Failed to get company context' },
      { status: 500 }
    );
  }
}

// Set company context
export async function POST(request: NextRequest) {
  try {
    const context = await getAuthContext(request);
    if (!context) {
      return unauthorizedResponse();
    }

    if (context.role !== UserRole.SUPER_ADMIN) {
      return forbiddenResponse('Only super admins can set company context');
    }

    const body = await request.json();
    const { companyId } = body;

    if (companyId === null || companyId === undefined) {
      // Clear context
      const response = NextResponse.json({ message: 'Company context cleared', companyId: null });
      response.cookies.delete('superAdminCompanyContext');
      return response;
    }

    // Verify company exists
    const company = await prisma.company.findUnique({
      where: { id: companyId },
      select: {
        id: true,
        name: true,
        email: true,
      },
    });

    if (!company) {
      return NextResponse.json(
        { error: 'Company not found' },
        { status: 404 }
      );
    }

    // Set cookie with company context
    const response = NextResponse.json({
      message: 'Company context set',
      companyId: company.id,
      company,
    });

    response.cookies.set('superAdminCompanyContext', company.id, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7, // 7 days
      path: '/',
    });

    return response;
  } catch (error) {
    console.error('Set company context error:', error);
    return NextResponse.json(
      { error: 'Failed to set company context' },
      { status: 500 }
    );
  }
}
