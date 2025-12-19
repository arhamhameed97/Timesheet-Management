import jwt from 'jsonwebtoken';
import { UserRole } from '@prisma/client';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

// Warn if using default secret in production
if (process.env.NODE_ENV === 'production' && JWT_SECRET === 'your-secret-key-change-in-production') {
  console.warn('[AUTH] WARNING: Using default JWT_SECRET in production!');
}

export interface JWTPayload {
  userId: string;
  email: string;
  role: UserRole;
  companyId?: string | null;
}

export function generateToken(payload: JWTPayload): string {
  if (!JWT_SECRET) {
    throw new Error('JWT_SECRET is not set!');
  }
  
  const token = jwt.sign(payload, JWT_SECRET, {
    expiresIn: '7d',
  });
  
  if (process.env.NODE_ENV === 'development') {
    console.log('[generateToken] Token generated:', {
      tokenLength: token.length,
      tokenPreview: token.substring(0, 30) + '...',
      payload,
      jwtSecretSet: !!JWT_SECRET && JWT_SECRET !== 'your-secret-key-change-in-production',
    });
  }
  
  return token;
}

/**
 * Verify token using jsonwebtoken (Node.js runtime only)
 * Use this in API routes
 */
export function verifyToken(token: string): JWTPayload | null {
  if (!token || typeof token !== 'string') {
    if (process.env.NODE_ENV === 'development') {
      console.error('[verifyToken] Invalid token provided:', typeof token);
    }
    return null;
  }

  if (!JWT_SECRET) {
    console.error('[verifyToken] JWT_SECRET is not set!');
    return null;
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as JWTPayload;
    return decoded;
  } catch (error: any) {
    // Log error details in development
    if (process.env.NODE_ENV === 'development') {
      console.error('[verifyToken] Token verification failed:', {
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

// verifyTokenEdge has been moved to lib/auth-edge.ts for Edge runtime compatibility
// Import directly from './lib/auth-edge' in middleware and Edge runtime contexts

export function getTokenFromRequest(request: Request): string | null {
  const authHeader = request.headers.get('authorization');
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.substring(7);
  }
  return null;
}


