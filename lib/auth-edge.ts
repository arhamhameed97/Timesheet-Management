import { UserRole } from '@prisma/client';
import type { JWTPayload } from './auth';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

/**
 * Verify token using jose (Edge Runtime compatible)
 * Use this in middleware and Edge runtime contexts
 */
export async function verifyTokenEdge(token: string): Promise<JWTPayload | null> {
  if (!token || typeof token !== 'string') {
    if (process.env.NODE_ENV === 'development') {
      console.error('[verifyTokenEdge] Invalid token provided:', typeof token);
    }
    return null;
  }

  if (!JWT_SECRET) {
    console.error('[verifyTokenEdge] JWT_SECRET is not set!');
    return null;
  }

  try {
    // Dynamic import for jose to ensure proper webpack resolution
    const { jwtVerify } = await import('jose');
    const secret = new TextEncoder().encode(JWT_SECRET);
    const { payload } = await jwtVerify(token, secret);
    
    // Convert the payload to JWTPayload format
    return {
      userId: payload.userId as string,
      email: payload.email as string,
      role: payload.role as UserRole,
      companyId: payload.companyId as string | null | undefined,
    };
  } catch (error: any) {
    // Log error details in development
    if (process.env.NODE_ENV === 'development') {
      console.error('[verifyTokenEdge] Token verification failed:', {
        error: error.message,
        name: error.name,
        tokenLength: token?.length,
        tokenPreview: token?.substring(0, 30) + '...',
        tokenEnd: token?.substring(Math.max(0, token.length - 30)),
        jwtSecretSet: !!JWT_SECRET && JWT_SECRET !== 'your-secret-key-change-in-production',
        jwtSecretLength: JWT_SECRET?.length,
      });
    }
    return null;
  }
}



