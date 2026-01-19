import { NextRequest, NextResponse } from 'next/server';
import { getAuthContext, unauthorizedResponse, forbiddenResponse } from '@/lib/middleware-helpers';
import { prisma } from '@/lib/db';
import { companyRegistrationRequestSchema } from '@/lib/validations';
import { UserRole, RegistrationStatus } from '@prisma/client';
import bcrypt from 'bcryptjs';

// Public endpoint - anyone can submit a registration request
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validatedData = companyRegistrationRequestSchema.parse(body);

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

    // Check if there's already a pending request for this company email
    const existingRequest = await prisma.companyRegistrationRequest.findFirst({
      where: {
        companyEmail: validatedData.companyEmail,
        status: RegistrationStatus.PENDING,
      },
    });

    if (existingRequest) {
      return NextResponse.json(
        { error: 'A pending registration request already exists for this company email' },
        { status: 400 }
      );
    }

    // Hash password before storing
    const hashedPassword = await bcrypt.hash(validatedData.adminPassword, 10);

    // Create registration request
    const registrationRequest = await prisma.companyRegistrationRequest.create({
      data: {
        companyName: validatedData.companyName,
        companyEmail: validatedData.companyEmail,
        companyAddress: validatedData.companyAddress,
        adminName: validatedData.adminName,
        adminEmail: validatedData.adminEmail,
        adminPassword: hashedPassword,
        status: RegistrationStatus.PENDING,
      },
    });

    return NextResponse.json(
      {
        message: 'Registration request submitted successfully. It will be reviewed by an administrator.',
        requestId: registrationRequest.id,
      },
      { status: 201 }
    );
  } catch (error: any) {
    if (error.name === 'ZodError') {
      return NextResponse.json(
        { error: 'Validation error', details: error.errors },
        { status: 400 }
      );
    }

    console.error('Registration request error:', error);
    return NextResponse.json(
      { error: 'Failed to submit registration request' },
      { status: 500 }
    );
  }
}

// Only SUPER_ADMIN can view registration requests
export async function GET(request: NextRequest) {
  try {
    const context = await getAuthContext(request);
    if (!context) {
      return unauthorizedResponse();
    }

    if (context.role !== UserRole.SUPER_ADMIN) {
      return forbiddenResponse('Only super admins can view registration requests');
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status') as RegistrationStatus | null;

    const where: any = {};
    if (status && Object.values(RegistrationStatus).includes(status)) {
      where.status = status;
    }

    const requests = await prisma.companyRegistrationRequest.findMany({
      where,
      include: {
        reviewer: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
      orderBy: {
        submittedAt: 'desc',
      },
    });

    return NextResponse.json({ requests });
  } catch (error) {
    console.error('Get registration requests error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch registration requests' },
      { status: 500 }
    );
  }
}
