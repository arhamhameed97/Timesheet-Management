import { NextRequest, NextResponse } from 'next/server';
import { getAuthContext, unauthorizedResponse, forbiddenResponse } from '@/lib/middleware-helpers';
import { prisma } from '@/lib/db';
import { UserRole } from '@prisma/client';
import { startOfDay, endOfDay, differenceInSeconds } from 'date-fns';

export async function GET(request: NextRequest) {
  try {
    const context = await getAuthContext(request);
    if (!context) {
      return unauthorizedResponse();
    }

    // Only admins and managers can see clocked-in users
    const allowedRoles: UserRole[] = [UserRole.SUPER_ADMIN, UserRole.COMPANY_ADMIN, UserRole.MANAGER];
    if (!allowedRoles.includes(context.role)) {
      return forbiddenResponse('You do not have permission to view clocked-in users');
    }

    const now = new Date();
    const todayStart = startOfDay(now);
    const todayEnd = endOfDay(now);

    let where: any = {
      date: {
        gte: todayStart,
        lte: todayEnd,
      },
      checkInTime: { not: null },
      checkOutTime: null, // Only show users who haven't checked out
    };

    // Filter by company context (for super admin) or company (for others)
    if (context.role !== UserRole.SUPER_ADMIN) {
      if (!context.companyId) {
        return NextResponse.json(
          { error: 'Company ID not found' },
          { status: 400 }
        );
      }

      // Get company employee IDs
      const companyEmployees = await prisma.user.findMany({
        where: {
          companyId: context.companyId,
          isActive: true,
        },
        select: { id: true },
      });
      const employeeIds = companyEmployees.map(e => e.id);

      where.userId = { in: employeeIds };
    } else if (context.companyId) {
      // Super admin with company context - filter by company
      const companyEmployees = await prisma.user.findMany({
        where: {
          companyId: context.companyId,
          isActive: true,
        },
        select: { id: true },
      });
      const employeeIds = companyEmployees.map(e => e.id);
      where.userId = { in: employeeIds };
    }

    // For managers, filter to their team members
    if (context.role === UserRole.MANAGER) {
      const managerEmployees = await prisma.user.findMany({
        where: {
          managerId: context.userId,
          isActive: true,
        },
        select: { id: true },
      });
      const managerEmployeeIds = managerEmployees.map(e => e.id);
      
      if (where.userId && Array.isArray(where.userId.in)) {
        where.userId.in = where.userId.in.filter((id: string) => managerEmployeeIds.includes(id));
      } else {
        where.userId = { in: managerEmployeeIds };
      }
    }

    const clockedInRecords = await prisma.attendance.findMany({
      where,
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
            designation: {
              select: {
                id: true,
                name: true,
              },
            },
            company: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
      },
      orderBy: {
        checkInTime: 'asc',
      },
    });

    // Calculate time since check-in for each user
    const clockedInUsers = clockedInRecords.map(record => {
      const checkInTime = record.checkInTime!;
      const secondsSinceCheckIn = differenceInSeconds(now, checkInTime);
      const hoursSinceCheckIn = Math.floor(secondsSinceCheckIn / 3600);
      const minutesSinceCheckIn = Math.floor((secondsSinceCheckIn % 3600) / 60);

      return {
        id: record.user.id,
        name: record.user.name,
        email: record.user.email,
        role: record.user.role,
        designation: record.user.designation,
        company: record.user.company,
        checkInTime: checkInTime.toISOString(),
        timeSinceCheckIn: `${hoursSinceCheckIn}h ${minutesSinceCheckIn}m`,
        hoursSinceCheckIn,
        minutesSinceCheckIn,
      };
    });

    return NextResponse.json({ clockedInUsers });
  } catch (error) {
    console.error('Get clocked-in users error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch clocked-in users' },
      { status: 500 }
    );
  }
}
