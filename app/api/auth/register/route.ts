import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/db';
import { registerSchema } from '@/lib/validations';
import { generateToken } from '@/lib/auth';
import { UserRole } from '@prisma/client';
import { getUserDashboardRoute } from '@/lib/permissions';

export async function POST(request: NextRequest) {
  // This endpoint is deprecated. Use /api/company-registrations instead.
  return NextResponse.json(
    { 
      error: 'Direct company registration is no longer available. Please submit a registration request at /api/company-registrations',
      redirectTo: '/register'
    },
    { status: 410 } // 410 Gone - indicates the resource is no longer available
  );

  /* DEPRECATED CODE - Keeping for reference
  try {
    const body = await request.json();
    const validatedData = registerSchema.parse(body);

    // Check if company email already exists
    const existingCompany = await prisma.company.findUnique({
      where: { email: validatedData.companyEmail },
    });

    if (existingCompany) {
      return NextResponse.json(
        { error: 'Company with this email already exists' },
        { status: 400 }
      );
    }

    // Check if admin email already exists
    const existingUser = await prisma.user.findUnique({
      where: { email: validatedData.adminEmail },
    });

    if (existingUser) {
      return NextResponse.json(
        { error: 'User with this email already exists' },
        { status: 400 }
      );
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(validatedData.adminPassword, 10);

    // Create company and admin user in a transaction
    const result = await prisma.$transaction(async (tx) => {
      // Create company
      const company = await tx.company.create({
        data: {
          name: validatedData.companyName,
          email: validatedData.companyEmail,
          address: validatedData.companyAddress,
        },
      });

      // Create admin user
      const user = await tx.user.create({
        data: {
          name: validatedData.adminName,
          email: validatedData.adminEmail,
          password: hashedPassword,
          companyId: company.id,
          role: UserRole.COMPANY_ADMIN,
        },
        include: {
          designation: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      });

      return { company, user };
    });

    // Generate token
    const token = generateToken({
      userId: result.user.id,
      email: result.user.email,
      role: result.user.role,
      companyId: result.user.companyId,
    });

    // Get dashboard route based on role
    const dashboardRoute = getUserDashboardRoute(result.user.role);

    // Create response with user data
    const response = NextResponse.json({
      message: 'Company and admin user created successfully',
      token,
      dashboardRoute,
      user: {
        id: result.user.id,
        name: result.user.name,
        email: result.user.email,
        role: result.user.role,
        companyId: result.user.companyId,
        designation: result.user.designation,
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
    if (error.name === 'ZodError') {
      return NextResponse.json(
        { error: 'Validation error', details: error.errors },
        { status: 400 }
      );
    }

    console.error('Registration error:', error);
    return NextResponse.json(
      { error: 'Failed to register company' },
      { status: 500 }
    );
  }
}

