import { NextRequest, NextResponse } from 'next/server';
import { verifyToken, getTokenFromRequest, JWTPayload } from './auth';
import { UserContext } from './permissions';

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

  return {
    userId: payload.userId,
    role: payload.role,
    companyId: payload.companyId,
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

