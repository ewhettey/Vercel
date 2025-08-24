# Deployment Guide

## 🚀 Quick Deployment to Vercel

### Prerequisites
1. Supabase project setup
2. GitHub repository with your code

### Step 1: Supabase Setup

1. **Create Supabase Project**
   - Go to [supabase.com](https://supabase.com)
   - Create a new project
   - Note your Project URL and API Key

2. **Run Database Schema**
   - Go to SQL Editor in Supabase dashboard
   - Copy and paste the content from `src/lib/database.sql`
   - Execute the SQL to create tables and policies

3. **Configure Authentication**
   - Go to Authentication > Settings
   - Enable email authentication
   - Configure email templates if needed

### Step 2: Deploy to Vercel

1. **Connect Repository**
   - Go to [vercel.com](https://vercel.com)
   - Import your GitHub repository
   - Select the `church-attendance-app` folder

2. **Configure Environment Variables**
   Add these environment variables in Vercel dashboard:
   ```
   VITE_SUPABASE_URL=your_supabase_project_url
   VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
   ```

3. **Deploy**
   - Click "Deploy"
   - Wait for build to complete
   - Your app will be live!

### Step 3: Post-Deployment Setup

1. **Create Admin User**
   - Sign up through the app
   - Go to Supabase dashboard > Authentication > Users
   - Find your user and note the UUID
   - Go to SQL Editor and run:
   ```sql
   UPDATE public.users 
   SET role = 'Admin' 
   WHERE id = 'your-user-uuid';
   ```

2. **Test PWA Installation**
   - Open app on mobile device
   - Add to home screen
   - Test offline functionality

### Environment Variables Reference

| Variable | Description | Example |
|----------|-------------|---------|
| `VITE_SUPABASE_URL` | Your Supabase project URL | `https://xxxxx.supabase.co` |
| `VITE_SUPABASE_ANON_KEY` | Your Supabase anon/public key | `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...` |

### Custom Domain (Optional)

1. Go to Vercel dashboard
2. Select your project
3. Go to Settings > Domains
4. Add your custom domain
5. Configure DNS records as instructed

### Troubleshooting

**Build Fails:**
- Check environment variables are set correctly
- Ensure all dependencies are in package.json

**Authentication Issues:**
- Verify Supabase URL and API key
- Check RLS policies are enabled
- Ensure user table is created

**PWA Not Installing:**
- Check manifest.json is accessible
- Verify service worker is registered
- Test on HTTPS (required for PWA)

**Database Errors:**
- Run the SQL schema in Supabase
- Check table permissions
- Verify RLS policies

### Performance Optimization

1. **Enable Vercel Analytics**
   - Go to project settings
   - Enable Web Analytics

2. **Configure Caching**
   - Static assets cached automatically
   - Service worker handles offline caching

3. **Monitor Performance**
   - Use Vercel's performance insights
   - Monitor Supabase dashboard for query performance

### Security Checklist

- ✅ Environment variables set in Vercel (not in code)
- ✅ RLS policies enabled on all tables
- ✅ HTTPS enabled (automatic with Vercel)
- ✅ Service worker caching configured
- ✅ Authentication flows tested

Your Church Attendance App is now live and ready to use! 🎉
