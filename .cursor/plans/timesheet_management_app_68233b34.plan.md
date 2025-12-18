---
name: Timesheet Management App
overview: Build a comprehensive timesheet management application using Next.js with TypeScript, featuring company registration, employee management, attendance tracking, timesheet logging, team collaboration, and payroll management.
todos:
  - id: setup
    content: Initialize Next.js project with TypeScript, install dependencies (Prisma, Zod, bcrypt, jsonwebtoken, date-fns, shadcn/ui), configure Tailwind CSS
    status: completed
  - id: database
    content: Create Prisma schema with all entities (Company, User, Designation, Attendance, Timesheet, TaskLog, Team, TeamMember, TeamProgress, Payroll), set up Railway PostgreSQL connection, run migrations
    status: completed
  - id: auth
    content: "Implement JWT authentication system: registration, login, protected API routes, middleware, role-based access control"
    status: completed
  - id: company_employee
    content: Build company management and employee CRUD APIs and UI pages (add/remove employees, assign designations)
    status: completed
  - id: designations
    content: Implement designation management (create/edit/delete designations per company) with UI
    status: completed
  - id: attendance
    content: "Build attendance system: check-in/check-out APIs, attendance tracking UI, calendar view, reports"
    status: completed
  - id: timesheets
    content: "Implement timesheet management: create timesheets, task logging, submission workflow, manager approval, timesheet history"
    status: completed
  - id: teams
    content: "Build team management: create teams, add/remove members, team progress updates, team dashboard"
    status: completed
  - id: payroll
    content: "Implement payroll system: payroll generation, salary calculation, allowances/deductions, approval workflow, payroll reports"
    status: completed
  - id: dashboard_reports
    content: Create role-based dashboards and reporting features (attendance reports, timesheet summaries, payroll reports)
    status: completed
  - id: additional_features
    content: Add leave management, notifications, export functionality (PDF/Excel), and other enhancements
    status: completed
  - id: ui_polish
    content: Apply black/white/grey theme, ensure responsive design, add error handling, final UI polish
    status: completed
---

# Timesheet Management Application

## Architecture Overview

Full-stack Next.js application with TypeScript, using PostgreSQL on Railway for the database, JWT authentication, and Tailwind CSS + shadcn/ui for the UI with a black/white/grey theme.

### Tech Stack

- **Frontend/Backend**: Next.js 14+ (App Router) with TypeScript
- **Database**: PostgreSQL (hosted on Railway)
- **ORM**: Prisma
- **Authentication**: JWT tokens
- **UI**: Tailwind CSS + shadcn/ui components
- **Validation**: Zod
- **Date Handling**: date-fns
- **Charts**: Recharts or Chart.js for data visualization

## Design System & Theme

### Color Palette

- **Primary**: Purple shades (dark purple `#6B46C1` for sidebar, medium `#8B5CF6` for accents, light `#A78BFA` for highlights)
- **Background**: White (`#FFFFFF`) for main content, light grey (`#F9FAFB`) for secondary backgrounds
- **Text**: Dark grey/black (`#1F2937`, `#111827`) for primary text, medium grey (`#6B7280`) for secondary text
- **Accents**: Purple gradients for buttons and interactive elements
- **Status Colors**: Green for success, red for errors/warnings, yellow for pending

### Design Principles

- **Layout**: Dark purple vertical sidebar (circular icon navigation) + white main content area
- **Rounded Corners**: All UI elements use rounded corners (buttons, cards, inputs: `rounded-lg` or `rounded-xl`)
- **Card-Based Design**: Data displayed in white cards with subtle shadows
- **Typography**: Clean, modern sans-serif (Inter or similar)
- **Spacing**: Generous padding and margins for breathing room

### UI Components Style

- **Sidebar**: Dark purple background with circular icon buttons, active state highlighted with lighter purple
- **Buttons**: 
  - Primary: Purple background with white text, rounded-full or rounded-lg
  - Secondary: White/light grey with purple border
  - Pill-shaped for tags and badges
- **Tables**: Clean white background, rounded corners, profile pictures in circular avatars
- **Progress Bars**: Horizontal bars with purple fill on light grey track, percentage displayed
- **Tags/Badges**: Rounded pill-shaped tags with various colors (purple, yellow, green, red, blue, etc.)
- **Data Visualization**: 
  - Donut/ring charts with purple gradient segments
  - Line graphs with purple lines and shaded areas
  - Clean, minimal chart styling
- **Icons**: Circular icons in sidebar, consistent icon usage throughout
- **Forms**: Rounded input fields, purple focus states

## Database Schema

### Core Entities

- **Company**: id, name, email, address, createdAt
- **User**: id, email, password (hashed), name, companyId, designationId, role (admin/manager/employee), createdAt
- **Designation**: id, name (Intern, Associate, Manager, etc.), companyId, createdAt
- **Attendance**: id, userId, date, checkInTime, checkOutTime, status (present/absent/half-day), createdAt
- **Timesheet**: id, userId, date, hours, status (draft/submitted/approved/rejected), approvedBy, createdAt
- **TaskLog**: id, timesheetId, description, hours, createdAt
- **Team**: id, name, companyId, managerId, createdAt
- **TeamMember**: id, teamId, userId, role (member/lead), joinedAt
- **TeamProgress**: id, teamId, userId, update, date, createdAt
- **Payroll**: id, userId, month, year, baseSalary, allowances, deductions, netSalary, status, createdAt

## Feature Implementation

### 1. Authentication & Company Registration

- **Files**: `app/api/auth/register/route.ts`, `app/api/auth/login/route.ts`, `app/api/auth/me/route.ts`
- Company registration with admin user creation
- JWT-based authentication
- Protected API routes with middleware
- Role-based access control (RBAC)

### 2. Company Management

- **Files**: `app/api/companies/route.ts`, `app/companies/page.tsx`
- Company profile management
- Company settings

### 3. Employee Management

- **Files**: `app/api/employees/route.ts`, `app/employees/page.tsx`, `app/employees/[id]/page.tsx`
- CRUD operations for employees
- Assign designations to employees
- Employee list with filters and search

### 4. Designation Management

- **Files**: `app/api/designations/route.ts`, `app/designations/page.tsx`
- Create/edit/delete designations per company
- Assign designations to employees

### 5. Attendance Tracking

- **Files**: `app/api/attendance/route.ts`, `app/attendance/page.tsx`, `app/api/attendance/checkin/route.ts`, `app/api/attendance/checkout/route.ts`
- Check-in/check-out functionality
- Daily attendance view
- Attendance calendar
- Attendance reports

### 6. Timesheet Management

- **Files**: `app/api/timesheets/route.ts`, `app/timesheets/page.tsx`, `app/timesheets/[id]/page.tsx`
- Create timesheets with date and hours
- Add task descriptions per timesheet entry
- Submit timesheets for approval
- Manager approval workflow
- Timesheet history and filtering

### 7. Task Logging

- **Files**: `app/api/tasks/route.ts` (nested under timesheets)
- Employees can log detailed task descriptions
- Link tasks to timesheet entries
- Task history and search

### 8. Team Management

- **Files**: `app/api/teams/route.ts`, `app/teams/page.tsx`, `app/teams/[id]/page.tsx`
- Create teams with manager assignment
- Add/remove team members
- Team member roles (member/lead)

### 9. Team Progress Updates

- **Files**: `app/api/teams/[id]/progress/route.ts`, `app/teams/[id]/progress/page.tsx`
- Team members can post progress updates
- View team progress feed
- Filter by date and member

### 10. Payroll Management

- **Files**: `app/api/payroll/route.ts`, `app/payroll/page.tsx`, `app/payroll/[id]/page.tsx`
- Generate payroll records
- Calculate salaries based on attendance and timesheets
- Manage allowances and deductions
- Payroll approval workflow
- Payroll history and reports

### 11. Additional Features

- **Dashboard**: `app/dashboard/page.tsx` - Role-based dashboards showing key metrics
- **Reports**: `app/reports/page.tsx` - Attendance reports, timesheet summaries, payroll reports
- **Leave Management**: `app/api/leaves/route.ts`, `app/leaves/page.tsx` - Request and approve leaves
- **Notifications**: Real-time notifications for approvals, check-in reminders
- **Export**: PDF/Excel export for timesheets and payroll
- **Settings**: `app/settings/page.tsx` - User and company settings

## File Structure

```
/
├── app/
│   ├── api/
│   │   ├── auth/
│   │   │   ├── register/route.ts
│   │   │   ├── login/route.ts
│   │   │   └── me/route.ts
│   │   ├── companies/route.ts
│   │   ├── employees/route.ts
│   │   ├── designations/route.ts
│   │   ├── attendance/
│   │   │   ├── route.ts
│   │   │   ├── checkin/route.ts
│   │   │   └── checkout/route.ts
│   │   ├── timesheets/route.ts
│   │   ├── tasks/route.ts
│   │   ├── teams/
│   │   │   ├── route.ts
│   │   │   └── [id]/progress/route.ts
│   │   └── payroll/route.ts
│   ├── (auth)/
│   │   ├── login/page.tsx
│   │   └── register/page.tsx
│   ├── dashboard/page.tsx
│   ├── employees/
│   │   ├── page.tsx
│   │   └── [id]/page.tsx
│   ├── attendance/page.tsx
│   ├── timesheets/
│   │   ├── page.tsx
│   │   └── [id]/page.tsx
│   ├── teams/
│   │   ├── page.tsx
│   │   └── [id]/page.tsx
│   ├── payroll/page.tsx
│   ├── reports/page.tsx
│   └── settings/page.tsx
├── components/
│   ├── ui/ (shadcn components)
│   ├── layout/
│   │   ├── Sidebar.tsx (dark purple sidebar with circular icons)
│   │   ├── Header.tsx
│   │   └── Navbar.tsx
│   ├── dashboard/
│   │   ├── DashboardCard.tsx (metric cards with rounded corners)
│   │   ├── AnalyticsChart.tsx (line/bar charts with purple theme)
│   │   └── StatCard.tsx
│   ├── attendance/
│   │   ├── CheckInButton.tsx
│   │   └── AttendanceCalendar.tsx
│   ├── timesheets/
│   │   ├── TimesheetForm.tsx
│   │   ├── TimesheetList.tsx
│   │   └── TimesheetTable.tsx (data table with profile pics)
│   ├── employees/
│   │   ├── EmployeeTable.tsx (data table with profile pictures)
│   │   └── EmployeeCard.tsx
│   ├── teams/
│   │   ├── TeamCard.tsx
│   │   └── TeamProgressCard.tsx
│   ├── payroll/
│   │   ├── PayrollTable.tsx
│   │   └── PayrollCard.tsx
│   └── common/
│       ├── ProgressBar.tsx (purple progress bars)
│       ├── TagBadge.tsx (colored category tags)
│       └── DataTable.tsx (reusable table component)
├── lib/
│   ├── db.ts (Prisma client)
│   ├── auth.ts (JWT utilities)
│   ├── utils.ts
│   └── validations.ts (Zod schemas)
├── middleware.ts (Auth middleware)
├── prisma/
│   ├── schema.prisma
│   └── migrations/
├── .env.example
├── package.json
└── README.md
```

## Implementation Steps

1. **Project Setup**: Initialize Next.js project, install dependencies (Prisma, Zod, bcrypt, jsonwebtoken, date-fns)
2. **Database Setup**: Create Prisma schema, set up Railway PostgreSQL connection, run migrations
3. **Authentication**: Implement JWT auth, registration, login, protected routes
4. **Core Models**: Implement Company, User, Designation APIs and UI
5. **Employee Management**: CRUD for employees with designation assignment
6. **Attendance System**: Check-in/check-out, attendance tracking UI
7. **Timesheet System**: Timesheet creation, task logging, approval workflow
8. **Team Management**: Team CRUD, member management, progress updates
9. **Payroll System**: Payroll generation, calculation logic, approval
10. **Dashboard & Reports**: Role-based dashboards, reporting features
11. **Additional Features**: Leave management, notifications, export functionality
12. **UI Polish**: Apply black/white/grey theme, responsive design, error handling

## Role Hierarchy & Permissions

### Role Hierarchy (Highest to Lowest)

1. **Super Admin**: Full access across all companies
2. **Company Admin**: Full access within their company
3. **Manager**: Can manage employees below them in hierarchy
4. **Team Lead**: Can manage team members and their timesheets
5. **Employee**: Can only manage their own data

### Permission Matrix

| Feature | Super Admin | Company Admin | Manager | Team Lead | Employee |

|---------|------------|---------------|---------|-----------|----------|

| View all companies | ✅ | ❌ | ❌ | ❌ | ❌ |

| Manage companies | ✅ | ❌ | ❌ | ❌ | ❌ |

| View own company | ✅ | ✅ | ✅ | ✅ | ✅ |

| Manage company settings | ✅ | ✅ | ❌ | ❌ | ❌ |

| Add/Remove employees | ✅ | ✅ | ✅* | ❌ | ❌ |

| Edit employee profiles | ✅ | ✅ | ✅* | ❌ | ❌ |

| View all employees | ✅ | ✅ | ✅ *| ✅* | ❌ |

| Create designations | ✅ | ✅ | ❌ | ❌ | ❌ |

| View all timesheets | ✅ | ✅ | ✅ *| ✅* | ❌ |

| Edit timesheets | ✅ | ✅ | ✅ *| ✅* | ✅ (own only) |

| Approve timesheets | ✅ | ✅ | ✅ *| ✅* | ❌ |

| View all attendance | ✅ | ✅ | ✅ *| ✅* | ❌ |

| Edit attendance | ✅ | ✅ | ✅ *| ✅* | ✅ (own only) |

| Create/manage teams | ✅ | ✅ | ✅ | ✅ | ❌ |

| View team progress | ✅ | ✅ | ✅ *| ✅* | ✅ (own team) |

| Manage payroll | ✅ | ✅ | ✅ | ❌ | ❌ |

| Approve payroll | ✅ | ✅ | ✅ | ❌ | ❌ |

| View reports | ✅ | ✅ | ✅ *| ✅* | ✅ (own only) |

| Export data | ✅ | ✅ | ✅ | ✅ | ✅ (own only) |

*Only for employees below them in hierarchy

### Hierarchy Rules

- **Manager-Employee Relationship**: Managers can only manage employees who report directly or indirectly to them (via `managerId` field)
- **Team Lead Authority**: Team leads can manage team members' timesheets and attendance within their assigned teams
- **Super Admin Override**: Super admin bypasses all company and hierarchy restrictions
- **Company Isolation**: Company admins and below can only access data within their company (except super admin)

## Super Admin Features

### Super Admin Dashboard

- **Files**: `app/super-admin/dashboard/page.tsx`, `app/super-admin/companies/page.tsx`
- View all registered companies with statistics
- Company management (activate/deactivate companies)
- System-wide analytics and reports
- User management across all companies
- System settings and configuration

### Super Admin APIs

- **Files**: `app/api/super-admin/companies/route.ts`, `app/api/super-admin/users/route.ts`, `app/api/super-admin/analytics/route.ts`
- CRUD operations for companies
- View all users across companies
- System-wide analytics and reporting
- Company activation/deactivation

## Key Considerations

- **Role-based access**: Implemented through middleware and permission checks at API and UI levels
- **Hierarchy enforcement**: All queries respect manager-employee relationships and role hierarchy
- **Data isolation**: Company-scoped queries (except super admin who can access all)
- **Permission checks**: Validate permissions before allowing actions (edit, delete, approve)
- **Validation**: All inputs validated with Zod schemas
- **Error handling**: Comprehensive error handling with user-friendly messages
- **Performance**: Optimized queries with proper indexing, pagination for large datasets
- **Security**: Password hashing with bcrypt, JWT token expiration, input sanitization, role-based route protection