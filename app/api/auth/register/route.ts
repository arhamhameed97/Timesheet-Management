import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  // This endpoint is deprecated. Use /api/company-registrations instead.
  return NextResponse.json(
    { 
      error: 'Direct company registration is no longer available. Please submit a registration request at /api/company-registrations',
      redirectTo: '/register'
    },
    { status: 410 } // 410 Gone - indicates the resource is no longer available
  );
}

