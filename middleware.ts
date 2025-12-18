import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { verifyTokenEdge, getTokenFromRequest } from './lib/auth';
import { UserRole } from '@prisma/client';

export async function middleware(request: NextRequest) {
  // Public routes that don't require authentication
  const publicRoutes = ['/login', '/register', '/api/auth/login', '/api/auth/register'];
  const isPublicRoute = publicRoutes.some(route => 
    request.nextUrl.pathname.startsWith(route)
  );

  if (isPublicRoute) {
    return NextResponse.next();
  }

  // Check authentication for protected routes
  // Try to get token from Authorization header first, then from cookie
  let token = getTokenFromRequest(request);
  
  if (!token) {
    // Try to get from cookie
    const cookieToken = request.cookies.get('token')?.value;
    token = cookieToken ? cookieToken.trim() : null;
  } else {
    token = token.trim();
  }
  
  // Debug logging (remove in production)
  if (process.env.NODE_ENV === 'development') {
    console.log('[Middleware] Path:', request.nextUrl.pathname);
    console.log('[Middleware] Has token from header:', !!getTokenFromRequest(request));
    console.log('[Middleware] Has token from cookie:', !!request.cookies.get('token')?.value);
    console.log('[Middleware] All cookies:', request.cookies.getAll().map(c => c.name));
  }
  
  if (!token) {
    // If accessing API route, return JSON error
    if (request.nextUrl.pathname.startsWith('/api')) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }
    // Otherwise redirect to login
    console.log('[Middleware] No token found, redirecting to login');
    return NextResponse.redirect(new URL('/login', request.url));
  }

  // Debug logging for token
  if (process.env.NODE_ENV === 'development') {
    console.log('[Middleware] Token preview:', token?.substring(0, 30) + '...');
    console.log('[Middleware] Token length:', token?.length);
  }
  
  // Use Edge-compatible verification
  const payload = await verifyTokenEdge(token);
  
  if (!payload) {
    console.log('[Middleware] Token verification failed');
    if (process.env.NODE_ENV === 'development') {
      console.log('[Middleware] Token value:', token);
    }
    if (request.nextUrl.pathname.startsWith('/api')) {
      return NextResponse.json(
        { error: 'Invalid or expired token' },
        { status: 401 }
      );
    }
    return NextResponse.redirect(new URL('/login', request.url));
  }

  // Role-based route protection
  const pathname = request.nextUrl.pathname;
  const userRole = payload.role;

  // Super admin routes - only SUPER_ADMIN can access
  if (pathname.startsWith('/super-admin')) {
    if (userRole !== UserRole.SUPER_ADMIN) {
      if (pathname.startsWith('/api')) {
        return NextResponse.json(
          { error: 'Forbidden: Super admin access required' },
          { status: 403 }
        );
      }
      // Redirect to appropriate dashboard
      const dashboardRoute: string = userRole === UserRole.SUPER_ADMIN 
        ? '/super-admin/dashboard' 
        : '/dashboard';
      return NextResponse.redirect(new URL(dashboardRoute, request.url));
    }
  }

  // Designations route - only COMPANY_ADMIN and SUPER_ADMIN
  if (pathname.startsWith('/designations')) {
    if (![UserRole.SUPER_ADMIN, UserRole.COMPANY_ADMIN].includes(userRole)) {
      if (pathname.startsWith('/api')) {
        return NextResponse.json(
          { error: 'Forbidden: Admin access required' },
          { status: 403 }
        );
      }
      return NextResponse.redirect(new URL('/dashboard', request.url));
    }
  }

  // Payroll route - COMPANY_ADMIN, MANAGER, SUPER_ADMIN (no EMPLOYEE, TEAM_LEAD)
  if (pathname.startsWith('/payroll')) {
    if (![UserRole.SUPER_ADMIN, UserRole.COMPANY_ADMIN, UserRole.MANAGER].includes(userRole)) {
      if (pathname.startsWith('/api')) {
        return NextResponse.json(
          { error: 'Forbidden: Insufficient permissions' },
          { status: 403 }
        );
      }
      return NextResponse.redirect(new URL('/dashboard', request.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};

