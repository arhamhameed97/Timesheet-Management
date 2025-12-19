# Database Setup Guide

## Problem
The current database schema doesn't match your Prisma schema because another app modified it. The `User.phone` column is missing.

## Solution: Create a New Database

### Step 1: Create a New PostgreSQL Database

**Option A: Using PostgreSQL locally**
```bash
# Connect to PostgreSQL
psql -U postgres

# Create a new database
CREATE DATABASE timesheet_management;

# Exit psql
\q
```

**Option B: Using a cloud provider (Recommended for production)**
- **Supabase**: Go to https://supabase.com, create a project, and get the connection string
- **Railway**: Go to https://railway.app, create a PostgreSQL service
- **Neon**: Go to https://neon.tech, create a database
- **Vercel Postgres**: If deploying on Vercel

### Step 2: Update Your .env File

Update your `.env` file with the new database URL:

```env
DATABASE_URL="postgresql://username:password@localhost:5432/timesheet_management?schema=public"
```

For cloud providers, use the connection string they provide.

### Step 3: Run Prisma Migrations

```bash
# Generate Prisma Client
npx prisma generate

# Create and apply migrations
npx prisma migrate dev --name init

# Or if you want to reset everything (WARNING: deletes all data)
npx prisma migrate reset
```

### Step 4: Verify the Setup

```bash
# Open Prisma Studio to verify tables were created
npx prisma studio
```

## Alternative: Reset Current Database (If you don't need the data)

If you don't need any data from the current database:

```bash
# Reset the database and apply all migrations
npx prisma migrate reset

# This will:
# 1. Drop the database
# 2. Create a new database
# 3. Apply all migrations
# 4. Run seed scripts (if any)
```

## Alternative: Manually Add Missing Column (If you need both apps)

If you need to keep both apps on the same database, you can manually add the missing column:

```sql
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "phone" TEXT;
```

Then regenerate Prisma Client:
```bash
npx prisma generate
```

---

**Recommendation**: Create a new database (Step 1-4) for a clean start and to avoid future conflicts.



