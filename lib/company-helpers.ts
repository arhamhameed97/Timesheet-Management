import { prisma } from './db';
import { UserContext } from './permissions';

/**
 * Validate that a company exists
 */
export async function validateCompanyExists(companyId: string): Promise<boolean> {
  const company = await prisma.company.findUnique({
    where: { id: companyId },
    select: { id: true },
  });
  return !!company;
}

/**
 * Validate that a company exists and is active
 */
export async function validateCompanyActive(companyId: string): Promise<{ exists: boolean; isActive: boolean }> {
  const company = await prisma.company.findUnique({
    where: { id: companyId },
    select: { id: true, isActive: true },
  });
  
  if (!company) {
    return { exists: false, isActive: false };
  }
  
  return { exists: true, isActive: company.isActive };
}

/**
 * Get company ID for user context
 */
export function getCompanyForUser(context: UserContext): string | null {
  return context.companyId || null;
}

/**
 * Get company details by ID
 */
export async function getCompanyDetails(companyId: string) {
  return await prisma.company.findUnique({
    where: { id: companyId },
    select: {
      id: true,
      name: true,
      email: true,
      address: true,
      isActive: true,
    },
  });
}









