import { z } from 'zod';
import { UserRole, RegistrationStatus } from '@prisma/client';

export const registerSchema = z.object({
  companyName: z.string().min(1, 'Company name is required'),
  companyEmail: z.string().email('Invalid email address'),
  companyAddress: z.string().optional(),
  adminName: z.string().min(1, 'Admin name is required'),
  adminEmail: z.string().email('Invalid email address'),
  adminPassword: z.string().min(6, 'Password must be at least 6 characters'),
});

export const companyRegistrationRequestSchema = z.object({
  companyName: z.string().min(1, 'Company name is required'),
  companyEmail: z.string().email('Invalid email address'),
  companyAddress: z.string().optional(),
  adminName: z.string().min(1, 'Admin name is required'),
  adminEmail: z.string().email('Invalid email address'),
  adminPassword: z.string().min(6, 'Password must be at least 6 characters'),
});

export const reviewCompanyRegistrationSchema = z.object({
  status: z.nativeEnum(RegistrationStatus),
  notes: z.string().optional(),
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
  paymentType: z.enum(['HOURLY', 'SALARY']).optional(),
  hourlyRate: z.number().min(0).optional(),
  monthlySalary: z.number().min(0).optional(),
}).refine((data) => {
  // If paymentType is HOURLY, hourlyRate should be provided
  if (data.paymentType === 'HOURLY' && (!data.hourlyRate || data.hourlyRate <= 0)) {
    return false;
  }
  // If paymentType is SALARY, monthlySalary should be provided
  if (data.paymentType === 'SALARY' && (!data.monthlySalary || data.monthlySalary <= 0)) {
    return false;
  }
  return true;
}, {
  message: 'Hourly rate is required for hourly employees, and monthly salary is required for salaried employees',
});

export const updateEmployeeSchema = z.object({
  name: z.string().min(1, 'Name is required').optional(),
  email: z.string().email('Invalid email address').optional(),
  designationId: z.string().optional(),
  role: z.nativeEnum(UserRole).optional(),
  managerId: z.string().optional().nullable(),
  phone: z.string().optional(),
  isActive: z.boolean().optional(),
  paymentType: z.enum(['HOURLY', 'SALARY']).optional().nullable(),
  hourlyRate: z.number().min(0).optional().nullable(),
  monthlySalary: z.number().min(0).optional().nullable(),
}).refine((data) => {
  // If paymentType is HOURLY, hourlyRate should be provided
  if (data.paymentType === 'HOURLY' && data.hourlyRate !== null && (!data.hourlyRate || data.hourlyRate <= 0)) {
    return false;
  }
  // If paymentType is SALARY, monthlySalary should be provided
  if (data.paymentType === 'SALARY' && data.monthlySalary !== null && (!data.monthlySalary || data.monthlySalary <= 0)) {
    return false;
  }
  return true;
}, {
  message: 'Hourly rate is required for hourly employees, and monthly salary is required for salaried employees',
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

const bonusSchema = z.object({
  name: z.string().min(1, 'Bonus name is required'),
  amount: z.number().min(0, 'Bonus amount must be positive'),
});

const deductionSchema = z.object({
  name: z.string().min(1, 'Deduction name is required'),
  amount: z.number().min(0, 'Deduction amount must be positive'),
});

export const createPayrollSchema = z.object({
  userId: z.string(),
  month: z.number().min(1).max(12),
  year: z.number().min(2000),
  paymentType: z.enum(['HOURLY', 'SALARY']),
  hoursWorked: z.number().min(0).optional(),
  hourlyRate: z.number().min(0).optional(),
  baseSalary: z.number().min(0),
  bonuses: z.array(bonusSchema).optional(),
  deductions: z.array(deductionSchema).optional(),
  notes: z.string().optional(),
}).refine((data) => {
  // If paymentType is HOURLY, hourlyRate should be provided (hoursWorked can be auto-calculated)
  if (data.paymentType === 'HOURLY') {
    if (!data.hourlyRate || data.hourlyRate <= 0) {
      return false;
    }
  }
  return true;
}, {
  message: 'Hourly rate is required for hourly employees',
});

export const updatePayrollSchema = z.object({
  paymentType: z.enum(['HOURLY', 'SALARY']).optional(),
  hoursWorked: z.number().min(0).optional(),
  hourlyRate: z.number().min(0).optional(),
  baseSalary: z.number().min(0).optional(),
  bonuses: z.array(z.object({
    name: z.string().min(1, 'Bonus name is required'),
    amount: z.number().min(0, 'Bonus amount must be positive'),
  })).optional(),
  deductions: z.array(z.object({
    name: z.string().min(1, 'Deduction name is required'),
    amount: z.number().min(0, 'Deduction amount must be positive'),
  })).optional(),
  status: z.enum(['PENDING', 'APPROVED', 'PAID', 'REJECTED']).optional(),
  notes: z.string().optional(),
});

export const createTaskSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  description: z.string().optional(),
  dueDate: z.string(), // ISO date string
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH']).default('MEDIUM'),
  assigneeIds: z.array(z.string()).min(1, 'At least one assignee is required'),
});

export const updateTaskSchema = z.object({
  status: z.enum(['PENDING', 'IN_PROGRESS', 'COMPLETED', 'APPROVED', 'CANCELLED']).optional(),
  title: z.string().min(1).optional(),
  description: z.string().optional(),
  dueDate: z.string().optional(), // ISO date string
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH']).optional(),
  assigneeIds: z.array(z.string()).optional(),
  approve: z.boolean().optional(), // If true, manager/admin approves the task
});

export const createLeaveSchema = z.object({
  startDate: z.string(), // ISO date string
  endDate: z.string(), // ISO date string
  type: z.string().min(1, 'Leave type is required'),
  reason: z.string().optional(),
  leaveDuration: z.enum(['FULL_DAY', 'HALF_DAY_MORNING', 'HALF_DAY_AFTERNOON']).default('FULL_DAY'),
});

export const updateLeaveSchema = z.object({
  status: z.enum(['PENDING', 'APPROVED', 'REJECTED', 'CANCELLED']).optional(),
});

export const createHourlyRatePeriodSchema = z.object({
  userId: z.string(),
  startDate: z.string(), // ISO date string
  endDate: z.string(), // ISO date string
  hourlyRate: z.number().min(0, 'Hourly rate must be positive'),
}).refine((data) => {
  const start = new Date(data.startDate);
  const end = new Date(data.endDate);
  return end >= start;
}, {
  message: 'End date must be after or equal to start date',
});

export const updateHourlyRatePeriodSchema = z.object({
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  hourlyRate: z.number().min(0).optional(),
}).refine((data) => {
  if (data.startDate && data.endDate) {
    const start = new Date(data.startDate);
    const end = new Date(data.endDate);
    return end >= start;
  }
  return true;
}, {
  message: 'End date must be after or equal to start date',
});

export const createOvertimeConfigSchema = z.object({
  userId: z.string(),
  weeklyThresholdHours: z.number().min(0).max(168).default(40), // Max 168 hours per week
  overtimeMultiplier: z.number().min(1).default(1.5),
});

export const updateOvertimeConfigSchema = z.object({
  weeklyThresholdHours: z.number().min(0).max(168).optional(),
  overtimeMultiplier: z.number().min(1).optional(),
});

export const createPayrollEditRequestSchema = z.object({
  payrollId: z.string(),
  changes: z.object({
    hoursWorked: z.number().min(0).optional(),
    hourlyRate: z.number().min(0).optional(),
    baseSalary: z.number().min(0).optional(),
    overtimeHours: z.number().min(0).optional(),
    bonuses: z.array(z.object({
      name: z.string().min(1),
      amount: z.number().min(0),
    })).optional(),
    deductions: z.array(z.object({
      name: z.string().min(1),
      amount: z.number().min(0),
    })).optional(),
    notes: z.string().optional(),
  }),
  notes: z.string().optional(),
});

export const updatePayrollEditRequestSchema = z.object({
  status: z.enum(['PENDING', 'APPROVED', 'REJECTED']).optional(),
  notes: z.string().optional(),
});

export const updateProfileSchema = z.object({
  name: z.string().min(1, 'Name is required').optional(),
  email: z.string().email('Invalid email address').optional(),
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: z.string().min(6, 'New password must be at least 6 characters'),
  confirmPassword: z.string().min(1, 'Please confirm your new password'),
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: 'New passwords do not match',
  path: ['confirmPassword'],
});
















