import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/db';
import { loginSchema } from '@/lib/validations';
import { generateToken } from '@/lib/auth';
import { getUserDashboardRoute } from '@/lib/permissions';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validatedData = loginSchema.parse(body);

    // Find user
    const user = await prisma.user.findUnique({
      where: { email: validatedData.email },
      include: {
        company: {
          select: {
            id: true,
            name: true,
            isActive: true,
          },
        },
        designation: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    if (!user) {
      return NextResponse.json(
        { error: 'Invalid email or password' },
        { status: 401 }
      );
    }

    // Check if user is active
    if (!user.isActive) {
      return NextResponse.json(
        { error: 'Account is deactivated' },
        { status: 403 }
      );
    }

    // Check if company is active (if user belongs to a company)
    if (user.company && !user.company.isActive) {
      return NextResponse.json(
        { error: 'Company account is deactivated' },
        { status: 403 }
      );
    }

    // Verify password
    const isValidPassword = await bcrypt.compare(validatedData.password, user.password);

    if (!isValidPassword) {
      return NextResponse.json(
        { error: 'Invalid email or password' },
        { status: 401 }
      );
    }

    // Generate token
    const token = generateToken({
      userId: user.id,
      email: user.email,
      role: user.role,
      companyId: user.companyId,
    });

    // Get dashboard route based on role
    const dashboardRoute = getUserDashboardRoute(user.role);

    // Create response with user data
    const response = NextResponse.json({
      message: 'Login successful',
      token,
      dashboardRoute,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        companyId: user.companyId,
        company: user.company,
        designation: user.designation,
      },
    });

    // Set cookie for middleware
    response.cookies.set('token', token, {
      httpOnly: false, // Allow client-side access
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7, // 7 days
      path: '/',
    });

    return response;
  } catch (error: any) {
    console.error('Login error:', error);
    
    if (error.name === 'ZodError') {
      return NextResponse.json(
        { error: 'Validation error', details: error.errors },
        { status: 400 }
      );
    }

    // Handle Prisma/database errors
    if (error.code === 'P1001' || error.message?.includes('connect')) {
      return NextResponse.json(
        { error: 'Database connection failed. Please check your database configuration.' },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { error: error.message || 'Failed to login. Please try again.' },
      { status: 500 }
    );
  }
}

