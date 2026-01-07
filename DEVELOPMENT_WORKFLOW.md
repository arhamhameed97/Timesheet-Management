# Development Workflow Guide

## Problem
Your current workflow (push → wait for Vercel → test) is slow and inefficient. Here are better alternatives:

## 🚀 Recommended Solutions (Best to Good)

### Option 1: Vercel CLI for Local Development (BEST)
This runs your app locally in a Vercel-like environment, giving you the best of both worlds.

**Setup:**
```bash
# Install Vercel CLI globally
npm i -g vercel

# Login to Vercel
vercel login

# Link your project (run once)
vercel link

# Run development server with Vercel environment
vercel dev
```

**Benefits:**
- ✅ Fast local development (no deployment wait)
- ✅ Uses Vercel environment variables automatically
- ✅ Simulates Vercel's serverless functions locally
- ✅ Hot reloading works perfectly
- ✅ No need to push to GitHub for testing

**Usage:**
- Make changes → Save → See changes instantly at `http://localhost:3000`
- Test API routes, middleware, and all features locally
- Only push to GitHub when you're ready to deploy

---

### Option 2: Preview Deployments with Staging Branch (GOOD)
Use a separate branch for testing that auto-deploys to preview URLs.

**Setup:**
1. Create a `staging` branch:
```bash
git checkout -b staging
git push -u origin staging
```

2. In Vercel Dashboard:
   - Go to your project → Settings → Git
   - Enable "Auto-deploy" for `staging` branch
   - Each push to `staging` creates a preview URL (e.g., `your-app-staging.vercel.app`)

**Workflow:**
```bash
# Work on staging branch
git checkout staging
git pull origin staging

# Make changes, test locally first
npm run dev:turbo  # Use turbo mode for faster local dev

# When ready to test on Vercel
git add .
git commit -m "Your changes"
git push origin staging

# Get preview URL from Vercel (check GitHub PR or Vercel dashboard)
# Test on preview URL

# When satisfied, merge to main
git checkout main
git merge staging
git push origin main
```

**Benefits:**
- ✅ Preview URLs for each staging push
- ✅ Doesn't affect production
- ✅ Can share preview URLs with team
- ⚠️ Still requires push and wait (but only for staging)

---

### Option 3: Optimize Local Development (ESSENTIAL)
Fix the slowness on localhost so you can develop efficiently.

**Quick Fixes:**

1. **Use Turbo Mode** (already in your package.json):
```bash
npm run dev:turbo
```

2. **Optimize Database Connection:**
   - Use connection pooling for local development
   - See `lib/db.ts` for optimized Prisma client

3. **Use a Local PostgreSQL Database:**
   - If using a remote database, latency causes slowness
   - Use a local PostgreSQL instance or Docker:
```bash
# Using Docker
docker run --name postgres-dev -e POSTGRES_PASSWORD=password -p 5432:5432 -d postgres:15

# Update .env
DATABASE_URL="postgresql://postgres:password@localhost:5432/timesheet_management?schema=public"
```

4. **Clear Next.js Cache:**
```bash
npm run clean
npm run dev:turbo
```

---

## 📋 Recommended Workflow

**For Daily Development:**
1. Use `vercel dev` for local development (Option 1)
2. Test changes instantly on localhost
3. Only push to GitHub when ready

**For Testing Production-like Environment:**
1. Push to `staging` branch (Option 2)
2. Test on preview URL
3. Merge to `main` when ready for production

**For Quick Fixes:**
1. Use `npm run dev:turbo` locally
2. Test quickly
3. Push directly to `main` if confident

---

## 🛠️ Available Scripts

- `npm run dev` - Standard Next.js dev server
- `npm run dev:turbo` - **Faster** Next.js dev with Turbo mode
- `npm run dev:vercel` - Run with Vercel CLI (after `vercel link`)
- `npm run clean` - Clear Next.js cache

---

## 💡 Tips

1. **Always test locally first** - Use `vercel dev` or `dev:turbo` before pushing
2. **Use staging branch** - For features that need production-like testing
3. **Optimize database** - Use local DB or connection pooling for speed
4. **Clear cache regularly** - Run `npm run clean` if things feel slow
5. **Use Turbo mode** - It's significantly faster than standard dev mode

---

## 🔧 Troubleshooting

**If `vercel dev` is slow:**
- Check your database connection (use local DB if possible)
- Ensure `.env` has correct variables
- Try `npm run clean` first

**If localhost is still slow:**
- Check if database is remote (use local instead)
- Use `dev:turbo` instead of `dev`
- Check Windows file watching settings (already optimized in `next.config.js`)

**If preview deployments are slow:**
- This is normal for first deployment
- Subsequent deployments are usually faster
- Consider using `vercel dev` for most testing



