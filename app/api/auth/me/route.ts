import { NextRequest, NextResponse } from 'next/server';
import { getAuthContext, unauthorizedResponse } from '@/lib/middleware-helpers';
import { prisma } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const context = await getAuthContext(request);
    if (!context) {
      return unauthorizedResponse();
    }

    const user = await prisma.user.findUnique({
      where: { id: context.userId },
      include: {
        company: {
          select: {
            id: true,
            name: true,
            email: true,
            address: true,
            isActive: true,
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

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Remove password from response
    const { password, ...userWithoutPassword } = user;

    return NextResponse.json({
      user: userWithoutPassword,
    });
  } catch (error) {
    console.error('Get user error:', error);
    return NextResponse.json(
      { error: 'Failed to get user information' },
      { status: 500 }
    );
  }
}




