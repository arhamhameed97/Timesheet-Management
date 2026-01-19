import { NextRequest, NextResponse } from 'next/server';
import { getAuthContext, unauthorizedResponse, forbiddenResponse } from '@/lib/middleware-helpers';
import { prisma } from '@/lib/db';
import { UserRole } from '@prisma/client';
import { startOfDay, endOfDay, parseISO } from 'date-fns';

export async function GET(request: NextRequest) {
  try {
    const context = await getAuthContext(request);
    if (!context) {
      return unauthorizedResponse();
    }

    // Only super admin can access this endpoint
    if (context.role !== UserRole.SUPER_ADMIN) {
      return forbiddenResponse('Only super admins can access this endpoint');
    }

    const { searchParams } = new URL(request.url);
    const dateParam = searchParams.get('date');
    
    // Parse date or use today
    let targetDate: Date;
    if (dateParam) {
      targetDate = parseISO(dateParam);
    } else {
      targetDate = new Date();
    }

    const dateStart = startOfDay(targetDate);
    const dateEnd = endOfDay(targetDate);

    // Build where clause based on company context
    let where: any = {
      date: {
        gte: dateStart,
        lte: dateEnd,
      },
    };

    // If company context is set, filter by company
    if (context.companyId) {
      const companyEmployees = await prisma.user.findMany({
        where: {
          companyId: context.companyId,
          isActive: true,
        },
        select: { id: true },
      });
      const employeeIds = companyEmployees.map((e) => e.id);
      where.userId = { in: employeeIds };
    }

    // Fetch attendance records with user and company info
    const attendanceRecords = await prisma.attendance.findMany({
      where,
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
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
        date: 'desc',
      },
    });

    // Group by user and get today's status
    const userMap = new Map<string, any>();

    attendanceRecords.forEach((record) => {
      const userId = record.userId;
      if (!userMap.has(userId)) {
        userMap.set(userId, {
          id: record.user.id,
          name: record.user.name,
          email: record.user.email,
          role: record.user.role,
          company: record.user.company,
          attendanceStats: {
            todayStatus: {
              checkedIn: false,
              checkedOut: false,
              checkInTime: null,
              checkOutTime: null,
              status: null,
            },
          },
        });
      }

      const userData = userMap.get(userId)!;
      if (record.checkInTime) {
        userData.attendanceStats.todayStatus.checkedIn = true;
        userData.attendanceStats.todayStatus.checkInTime = record.checkInTime.toISOString();
        userData.attendanceStats.todayStatus.status = record.status || 'PRESENT';
      }
      if (record.checkOutTime) {
        userData.attendanceStats.todayStatus.checkedOut = true;
        userData.attendanceStats.todayStatus.checkOutTime = record.checkOutTime.toISOString();
      }
    });

    // Include users without attendance records
    let userWhere: any = {
      role: {
        not: UserRole.SUPER_ADMIN,
      },
      isActive: true,
    };

    // If company context is set, filter by company
    if (context.companyId) {
      userWhere.companyId = context.companyId;
    }

    const allUsers = await prisma.user.findMany({
      where: userWhere,
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        company: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    allUsers.forEach((user) => {
      if (!userMap.has(user.id)) {
        userMap.set(user.id, {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          company: user.company,
          attendanceStats: {
            todayStatus: {
              checkedIn: false,
              checkedOut: false,
              checkInTime: null,
              checkOutTime: null,
              status: null,
            },
          },
        });
      }
    });

    const attendance = Array.from(userMap.values());

    return NextResponse.json({ attendance });
  } catch (error) {
    console.error('Get super admin attendance error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch attendance' },
      { status: 500 }
    );
  }
}
