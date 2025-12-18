import { z } from 'zod';
import { UserRole } from '@prisma/client';

export const registerSchema = z.object({
  companyName: z.string().min(1, 'Company name is required'),
  companyEmail: z.string().email('Invalid email address'),
  companyAddress: z.string().optional(),
  adminName: z.string().min(1, 'Admin name is required'),
  adminEmail: z.string().email('Invalid email address'),
  adminPassword: z.string().min(6, 'Password must be at least 6 characters'),
});

export const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
});

export const createEmployeeSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  email: z.string().email('Invalid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  designationId: z.string().optional(),
  role: z.nativeEnum(UserRole).optional(),
  managerId: z.string().optional(),
  phone: z.string().optional(),
  companyId: z.string().optional(), // Optional for regular users, required for super admin
});

export const updateEmployeeSchema = z.object({
  name: z.string().min(1, 'Name is required').optional(),
  email: z.string().email('Invalid email address').optional(),
  designationId: z.string().optional(),
  role: z.nativeEnum(UserRole).optional(),
  managerId: z.string().optional().nullable(),
  phone: z.string().optional(),
  isActive: z.boolean().optional(),
});

export const createDesignationSchema = z.object({
  name: z.string().min(1, 'Designation name is required'),
});

export const checkInSchema = z.object({
  date: z.string().optional(), // ISO date string, defaults to today
  notes: z.string().optional(),
});

export const checkOutSchema = z.object({
  date: z.string().optional(), // ISO date string, defaults to today
  notes: z.string().optional(),
});

export const createTimesheetSchema = z.object({
  date: z.string(), // ISO date string
  hours: z.number().min(0).max(24, 'Hours cannot exceed 24'),
  notes: z.string().optional(),
});

export const updateTimesheetSchema = z.object({
  hours: z.number().min(0).max(24).optional(),
  status: z.enum(['DRAFT', 'SUBMITTED', 'APPROVED', 'REJECTED']).optional(),
  notes: z.string().optional(),
});

export const createTaskLogSchema = z.object({
  timesheetId: z.string(),
  description: z.string().min(1, 'Description is required'),
  hours: z.number().min(0).max(24),
});

export const createTeamSchema = z.object({
  name: z.string().min(1, 'Team name is required'),
  description: z.string().optional(),
  managerId: z.string().optional(),
});

export const addTeamMemberSchema = z.object({
  userId: z.string(),
  role: z.enum(['LEAD', 'MEMBER']).optional(),
});

export const createTeamProgressSchema = z.object({
  teamId: z.string(),
  update: z.string().min(1, 'Update is required'),
  date: z.string().optional(), // ISO date string
});

export const createPayrollSchema = z.object({
  userId: z.string(),
  month: z.number().min(1).max(12),
  year: z.number().min(2000),
  baseSalary: z.number().min(0),
  allowances: z.number().min(0).optional(),
  deductions: z.number().min(0).optional(),
  notes: z.string().optional(),
});

export const updatePayrollSchema = z.object({
  baseSalary: z.number().min(0).optional(),
  allowances: z.number().min(0).optional(),
  deductions: z.number().min(0).optional(),
  status: z.enum(['PENDING', 'APPROVED', 'PAID', 'REJECTED']).optional(),
  notes: z.string().optional(),
});

export const createLeaveSchema = z.object({
  startDate: z.string(), // ISO date string
  endDate: z.string(), // ISO date string
  type: z.string().min(1, 'Leave type is required'),
  reason: z.string().optional(),
});

export const updateLeaveSchema = z.object({
  status: z.enum(['PENDING', 'APPROVED', 'REJECTED', 'CANCELLED']).optional(),
});




