import { NextRequest, NextResponse } from 'next/server';
import { verifyToken, getTokenFromRequest, JWTPayload } from './auth';
import { UserContext } from './permissions';
import { UserRole } from '@prisma/client';

export async function getAuthContext(request: NextRequest): Promise<UserContext | null> {
  // Try Authorization header first
  let token = getTokenFromRequest(request);
  
  // Fallback to cookie if no header token
  if (!token) {
    token = request.cookies.get('token')?.value || null;
  }
  
  if (!token) {
    return null;
  }

  const payload = verifyToken(token);
  if (!payload) {
    return null;
  }

  let companyId = payload.companyId;

  // For SUPER_ADMIN, check if there's a company context override
  if (payload.role === UserRole.SUPER_ADMIN) {
    const companyContextId = request.cookies.get('superAdminCompanyContext')?.value || null;
    if (companyContextId) {
      companyId = companyContextId;
    }
  }

  return {
    userId: payload.userId,
    role: payload.role,
    companyId: companyId,
  };
}

export function unauthorizedResponse(message = 'Unauthorized'): NextResponse {
  return NextResponse.json({ error: message }, { status: 401 });
}

export function forbiddenResponse(message = 'Forbidden'): NextResponse {
  return NextResponse.json({ error: message }, { status: 403 });
}

export function badRequestResponse(message = 'Bad Request'): NextResponse {
  return NextResponse.json({ error: message }, { status: 400 });
}

