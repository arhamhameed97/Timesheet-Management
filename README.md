# Timesheet Management Application

A comprehensive timesheet management application built with Next.js, TypeScript, and PostgreSQL. This application allows companies to register, manage employees, track attendance, log timesheets, manage teams, process payroll, and more.

## Features

### Core Features
- **Company Registration**: Companies can register and create admin accounts
- **Employee Management**: Add, edit, and manage employees with designations
- **Designation Management**: Create and manage employee designations (Intern, Associate, Manager, etc.)
- **Attendance Tracking**: Check-in/check-out functionality with daily attendance records
- **Timesheet Management**: Create timesheets, log tasks, and submit for approval
- **Team Management**: Create teams, add members, and track team progress
- **Payroll Management**: Generate and manage payroll with approvals
- **Leave Management**: Request and approve leaves

### Role-Based Access Control
- **Super Admin**: Full access across all companies
- **Company Admin**: Full access within their company
- **Manager**: Can manage employees below them in hierarchy
- **Team Lead**: Can manage team members and their timesheets
- **Employee**: Can only manage their own data

### Additional Features
- Role-based dashboards
- Reports and analytics
- Settings management
- Hierarchical employee management

## Tech Stack

- **Framework**: Next.js 14+ (App Router)
- **Language**: TypeScript
- **Database**: PostgreSQL (hosted on Railway)
- **ORM**: Prisma
- **Authentication**: JWT tokens
- **UI**: Tailwind CSS + shadcn/ui
- **Validation**: Zod
- **Date Handling**: date-fns

## Getting Started

### Prerequisites
- Node.js 18+ installed
- PostgreSQL database (Railway recommended)
- npm or yarn package manager

### Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd timesheet-management
```

2. Install dependencies:
```bash
npm install
```

3. Set up environment variables:
```bash
cp .env.example .env
```

Edit `.env` and add your database URL and JWT secret:
```
DATABASE_URL="postgresql://user:password@host:port/database?schema=public"
JWT_SECRET="your-secret-key-here"
```

4. Set up the database:
```bash
npx prisma generate
npx prisma db push
```

5. Run the development server:
```bash
npm run dev
```

6. Open [http://localhost:3000](http://localhost:3000) in your browser.

## Project Structure

```
/
├── app/
│   ├── api/              # API routes
│   ├── (auth)/           # Authentication pages
│   ├── dashboard/        # Dashboard pages
│   ├── employees/        # Employee management
│   ├── attendance/       # Attendance tracking
│   ├── timesheets/       # Timesheet management
│   ├── teams/            # Team management
│   ├── payroll/          # Payroll management
│   ├── reports/          # Reports and analytics
│   ├── leaves/           # Leave management
│   ├── settings/         # Settings
│   └── super-admin/      # Super admin pages
├── components/
│   ├── ui/               # shadcn/ui components
│   └── layout/           # Layout components
├── lib/
│   ├── auth.ts           # JWT utilities
│   ├── db.ts             # Prisma client
│   ├── permissions.ts    # Permission checks
│   └── validations.ts    # Zod schemas
├── prisma/
│   └── schema.prisma     # Database schema
└── middleware.ts         # Auth middleware
```

## Database Schema

The application uses Prisma ORM with the following main entities:
- Company
- User (with role hierarchy)
- Designation
- Attendance
- Timesheet
- TaskLog
- Team
- TeamMember
- TeamProgress
- Payroll
- Leave

## API Routes

All API routes are protected and require authentication via JWT token in the Authorization header:
```
Authorization: Bearer <token>
```

### Authentication
- `POST /api/auth/register` - Register company and admin
- `POST /api/auth/login` - Login user
- `GET /api/auth/me` - Get current user

### Companies
- `GET /api/companies` - Get companies
- `PATCH /api/companies` - Update company

### Employees
- `GET /api/employees` - Get employees
- `POST /api/employees` - Create employee
- `GET /api/employees/[id]` - Get employee
- `PATCH /api/employees/[id]` - Update employee
- `DELETE /api/employees/[id]` - Delete employee

### Attendance
- `GET /api/attendance` - Get attendance records
- `POST /api/attendance/checkin` - Check in
- `POST /api/attendance/checkout` - Check out
- `PATCH /api/attendance` - Update attendance

### Timesheets
- `GET /api/timesheets` - Get timesheets
- `POST /api/timesheets` - Create timesheet
- `GET /api/timesheets/[id]` - Get timesheet
- `PATCH /api/timesheets/[id]` - Update/approve timesheet

### Teams
- `GET /api/teams` - Get teams
- `POST /api/teams` - Create team
- `GET /api/teams/[id]` - Get team
- `PATCH /api/teams/[id]` - Update team
- `POST /api/teams/[id]/members` - Add team member
- `POST /api/teams/[id]/progress` - Add progress update

### Payroll
- `GET /api/payroll` - Get payroll records
- `POST /api/payroll` - Create payroll
- `GET /api/payroll/[id]` - Get payroll
- `PATCH /api/payroll/[id]` - Update/approve payroll

### Leaves
- `GET /api/leaves` - Get leave requests
- `POST /api/leaves` - Create leave request
- `PATCH /api/leaves/[id]` - Update/approve leave

## Design Theme

The application uses a purple-based theme with:
- Dark purple sidebar (`#6B46C1`)
- White/grey main content areas
- Purple accents for interactive elements
- Rounded corners throughout
- Modern, minimalist design

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

## License

This project is licensed under the MIT License.
















