# Church Attendance App

A modern, mobile-first Progressive Web App (PWA) for managing church attendance with offline capabilities.

## 🚀 Features

### 🔐 Authentication & Roles
- Supabase email authentication (magic link or password)
- Role-based access control:
  - **Admin**: Full access (manage members, visitors, reports)
  - **Usher**: Can only mark attendance
  - **Pastor**: Can only view attendance history and reports

### 👥 Data Management
- **Members**: Name, Phone, Church, Category
- **Visitors**: Name, Phone, Church, How Heard, Category
- **Attendance**: Auto-logged with date, person details, and who marked them present

### ⚙️ Smart Attendance Logic
- Phone number auto-fill from existing members/visitors
- Prevents duplicate attendance entries for the same day
- Automatic categorization based on existing records

### 📊 Reports & Analytics
- Real-time attendance statistics
- Weekly attendance charts
- Member vs Visitor breakdown
- Exportable attendance data (CSV)
- Historical attendance records

### 📱 Mobile-First Design
- Optimized for mobile devices and tablets
- Large touch-friendly buttons
- Responsive layout with TailwindCSS
- Single-screen attendance form for quick check-ins

### 📲 PWA Features
- Installable on Android/iOS devices
- Offline attendance recording
- Background sync when connection restored
- Service worker for caching static assets
- Works offline with local storage

## 🛠 Tech Stack

- **Frontend**: React 18 + Vite
- **Styling**: TailwindCSS
- **Database**: Supabase (PostgreSQL)
- **Authentication**: Supabase Auth
- **Charts**: Recharts
- **Icons**: Lucide React
- **PWA**: Service Worker + Web App Manifest

## 📋 Setup Instructions

### 1. Clone and Install Dependencies

```bash
git clone <your-repo-url>
cd church-attendance-app
npm install
```

### 2. Supabase Setup

1. Create a new Supabase project at [supabase.com](https://supabase.com)
2. Copy your project URL and anon key
3. Create a `.env` file in the root directory:

```env
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

### 3. Database Schema

Run the SQL commands in `src/lib/database.sql` in your Supabase SQL Editor to create the required tables and policies.

### 4. Run the Application

```bash
npm run dev
```

The app will be available at `http://localhost:3000`

## 🗄️ Database Schema

### Users Table
```sql
- id (UUID, references auth.users)
- name (TEXT)
- email (TEXT, unique)
- role (TEXT: 'Admin', 'Usher', 'Pastor')
- created_at, updated_at (TIMESTAMP)
```

### Members Table
```sql
- id (UUID, primary key)
- name (TEXT)
- phone (TEXT, unique)
- church (TEXT)
- category (TEXT, default: 'Member')
- created_at, updated_at (TIMESTAMP)
```

### Visitors Table
```sql
- id (UUID, primary key)
- name (TEXT)
- phone (TEXT, unique)
- church (TEXT)
- how_heard (TEXT: 'Friend', 'Social Media', 'Evangelism', 'Invitation', 'Other')
- category (TEXT, default: 'Visitor')
- created_at, updated_at (TIMESTAMP)
```

### Attendance Table
```sql
- id (UUID, primary key)
- date (DATE, default: today)
- phone (TEXT)
- name (TEXT)
- church (TEXT)
- how_heard (TEXT, nullable)
- category (TEXT: 'Member', 'Visitor')
- marked_by (TEXT, user email)
- created_at (TIMESTAMP)
```

## 🚀 Deployment

### Vercel Deployment

1. Push your code to GitHub
2. Connect your repository to Vercel
3. Add environment variables in Vercel dashboard:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
4. Deploy!

### Environment Variables

Make sure to set these in your deployment platform:

```env
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

## 📱 PWA Installation

### Android
1. Open the app in Chrome
2. Tap the menu (three dots)
3. Select "Add to Home screen"

### iOS
1. Open the app in Safari
2. Tap the Share button
3. Select "Add to Home Screen"

## 🔒 Security Features

- Row Level Security (RLS) enabled on all tables
- Role-based access policies
- Secure authentication with Supabase
- Environment variables for sensitive data

## 🌐 Offline Capabilities

- Attendance records stored locally when offline
- Automatic sync when connection restored
- Visual offline indicator
- Service worker caching for static assets

## 📊 Usage Guide

### For Ushers
1. Open the app and sign in
2. Enter phone number to check in attendees
3. Form auto-fills if person exists in database
4. Select Member/Visitor and fill required fields
5. Tap "Mark Present" to record attendance

### For Pastors
1. Access Reports tab to view attendance data
2. See weekly charts and statistics
3. Export data for further analysis
4. View historical attendance records

### For Admins
1. Full access to all features
2. Manage members and visitors in Members tab
3. View comprehensive reports
4. Manage user roles and permissions

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## 📄 License

This project is licensed under the MIT License.

## 🆘 Support

For support and questions:
1. Check the documentation
2. Review the database schema
3. Ensure environment variables are set correctly
4. Check Supabase dashboard for errors

## 🔄 Version History

- **v1.0.0**: Initial release with core attendance features
- PWA support with offline capabilities
- Role-based authentication
- Mobile-first responsive design
