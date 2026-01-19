import { NextRequest, NextResponse } from 'next/server';
import { getAuthContext, unauthorizedResponse, forbiddenResponse } from '@/lib/middleware-helpers';
import { prisma } from '@/lib/db';
import { reviewCompanyRegistrationSchema } from '@/lib/validations';
import { UserRole, RegistrationStatus } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { generateToken } from '@/lib/auth';

// Only SUPER_ADMIN can review requests
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const context = await getAuthContext(request);
    if (!context) {
      return unauthorizedResponse();
    }

    if (context.role !== UserRole.SUPER_ADMIN) {
      return forbiddenResponse('Only super admins can review registration requests');
    }

    const body = await request.json();
    const validatedData = reviewCompanyRegistrationSchema.parse(body);

    // Find the registration request
    const registrationRequest = await prisma.companyRegistrationRequest.findUnique({
      where: { id: params.id },
    });

    if (!registrationRequest) {
      return NextResponse.json(
        { error: 'Registration request not found' },
        { status: 404 }
      );
    }

    if (registrationRequest.status !== RegistrationStatus.PENDING) {
      return NextResponse.json(
        { error: 'This registration request has already been reviewed' },
        { status: 400 }
      );
    }

    // If approving, create company and admin user
    if (validatedData.status === RegistrationStatus.APPROVED) {
      // Double-check company email doesn't exist (race condition protection)
      const existingCompany = await prisma.company.findUnique({
        where: { email: registrationRequest.companyEmail },
      });

      if (existingCompany) {
        return NextResponse.json(
          { error: 'Company with this email already exists' },
          { status: 400 }
        );
      }

      // Double-check admin email doesn't exist
      const existingUser = await prisma.user.findUnique({
        where: { email: registrationRequest.adminEmail },
      });

      if (existingUser) {
        return NextResponse.json(
          { error: 'User with this email already exists' },
          { status: 400 }
        );
      }

      // Create company and admin user in a transaction
      const result = await prisma.$transaction(async (tx) => {
        // Create company
        const company = await tx.company.create({
          data: {
            name: registrationRequest.companyName,
            email: registrationRequest.companyEmail,
            address: registrationRequest.companyAddress,
          },
        });

        // Create admin user (password is already hashed in the request)
        const user = await tx.user.create({
          data: {
            name: registrationRequest.adminName,
            email: registrationRequest.adminEmail,
            password: registrationRequest.adminPassword,
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

        // Update registration request
        await tx.companyRegistrationRequest.update({
          where: { id: params.id },
          data: {
            status: RegistrationStatus.APPROVED,
            reviewedBy: context.userId,
            reviewedAt: new Date(),
            notes: validatedData.notes,
          },
        });

        return { company, user };
      });

      return NextResponse.json({
        message: 'Registration request approved and company created successfully',
        company: result.company,
        adminUser: {
          id: result.user.id,
          name: result.user.name,
          email: result.user.email,
          role: result.user.role,
        },
      });
    } else if (validatedData.status === RegistrationStatus.REJECTED) {
      // Just update the request status
      const updatedRequest = await prisma.companyRegistrationRequest.update({
        where: { id: params.id },
        data: {
          status: RegistrationStatus.REJECTED,
          reviewedBy: context.userId,
          reviewedAt: new Date(),
          notes: validatedData.notes,
        },
      });

      return NextResponse.json({
        message: 'Registration request rejected',
        request: updatedRequest,
      });
    } else {
      return NextResponse.json(
        { error: 'Invalid status. Must be APPROVED or REJECTED' },
        { status: 400 }
      );
    }
  } catch (error: any) {
    if (error.name === 'ZodError') {
      return NextResponse.json(
        { error: 'Validation error', details: error.errors },
        { status: 400 }
      );
    }

    if (error.code === 'P2002') {
      return NextResponse.json(
        { error: 'Company or user with this email already exists' },
        { status: 400 }
      );
    }

    console.error('Review registration request error:', error);
    return NextResponse.json(
      { error: 'Failed to review registration request' },
      { status: 500 }
    );
  }
}
