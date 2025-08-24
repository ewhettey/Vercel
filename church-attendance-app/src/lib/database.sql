-- Church Attendance App Database Schema
-- Run these SQL commands in your Supabase SQL Editor

-- Create Users table (extends Supabase auth.users)
CREATE TABLE IF NOT EXISTS public.users (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('Admin', 'Usher', 'Pastor')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create Members table
CREATE TABLE IF NOT EXISTS public.members (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  phone TEXT UNIQUE NOT NULL,
  church TEXT NOT NULL,
  category TEXT DEFAULT 'Member',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create Visitors table
CREATE TABLE IF NOT EXISTS public.visitors (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  phone TEXT UNIQUE NOT NULL,
  church TEXT NOT NULL,
  how_heard TEXT NOT NULL CHECK (how_heard IN ('Friend', 'Social Media', 'Evangelism', 'Invitation', 'Other')),
  category TEXT DEFAULT 'Visitor',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create Events table
CREATE TABLE IF NOT EXISTS public.events (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  event_date DATE NOT NULL,
  start_time TIME,
  end_time TIME,
  church TEXT NOT NULL,
  event_type TEXT DEFAULT 'Service' CHECK (event_type IN ('Service', 'Bible Study', 'Prayer Meeting', 'Special Event', 'Conference', 'Workshop', 'Other')),
  location TEXT,
  is_active BOOLEAN DEFAULT true,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create Attendance table
CREATE TABLE IF NOT EXISTS public.attendance (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id UUID REFERENCES public.events(id) ON DELETE CASCADE,
  phone TEXT NOT NULL,
  name TEXT NOT NULL,
  church TEXT NOT NULL,
  how_heard TEXT,
  category TEXT NOT NULL CHECK (category IN ('Member', 'Visitor')),
  marked_by UUID REFERENCES auth.users(id),
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Ensure one attendance record per person per event
  UNIQUE(phone, event_id)
);

-- Enable Row Level Security
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.visitors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance ENABLE ROW LEVEL SECURITY;

-- RLS Policies for Users table
CREATE POLICY "Users can view their own profile" ON public.users
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update their own profile" ON public.users
  FOR UPDATE USING (auth.uid() = id);

-- RLS Policies for Members table
CREATE POLICY "Authenticated users can view members" ON public.members
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Admins can manage members" ON public.members
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.users 
      WHERE users.id = auth.uid() AND users.role = 'Admin'
    )
  );

-- RLS Policies for Visitors table
CREATE POLICY "Authenticated users can view visitors" ON public.visitors
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Admins can manage visitors" ON public.visitors
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.users 
      WHERE users.id = auth.uid() AND users.role = 'Admin'
    )
  );

-- RLS Policies for Events table
CREATE POLICY "Authenticated users can view events" ON public.events
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Admins and Pastors can manage events" ON public.events
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.users 
      WHERE users.id = auth.uid() AND users.role IN ('Admin', 'Pastor')
    )
  );

-- RLS Policies for Attendance table
CREATE POLICY "Authenticated users can view attendance" ON public.attendance
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Ushers and Admins can mark attendance" ON public.attendance
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users 
      WHERE users.id = auth.uid() AND users.role IN ('Admin', 'Usher')
    )
  );

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_members_phone ON public.members(phone);
CREATE INDEX IF NOT EXISTS idx_visitors_phone ON public.visitors(phone);
CREATE INDEX IF NOT EXISTS idx_events_date ON public.events(event_date);
CREATE INDEX IF NOT EXISTS idx_events_church ON public.events(church);
CREATE INDEX IF NOT EXISTS idx_attendance_event_id ON public.attendance(event_id);
CREATE INDEX IF NOT EXISTS idx_attendance_phone ON public.attendance(phone);

-- Create function to handle user creation
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (id, name, email, role)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'name', ''), NEW.email, 'Usher');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for new user creation
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Insert sample events
INSERT INTO public.events (name, description, event_date, start_time, end_time, church, event_type, location) VALUES
  ('Sunday Morning Service', 'Weekly Sunday worship service', CURRENT_DATE, '10:00', '12:00', 'First Baptist Church', 'Service', 'Main Sanctuary'),
  ('Wednesday Bible Study', 'Midweek Bible study and prayer', CURRENT_DATE + INTERVAL '3 days', '19:00', '20:30', 'First Baptist Church', 'Bible Study', 'Fellowship Hall'),
  ('Youth Conference 2025', 'Annual youth conference', CURRENT_DATE + INTERVAL '30 days', '09:00', '17:00', 'First Baptist Church', 'Conference', 'Main Sanctuary')
ON CONFLICT DO NOTHING;

-- Insert sample members
INSERT INTO public.members (name, phone, church) VALUES
  ('John Smith', '555-0101', 'First Baptist Church'),
  ('Mary Johnson', '555-0102', 'First Baptist Church'),
  ('David Wilson', '555-0103', 'First Baptist Church')
ON CONFLICT (phone) DO NOTHING;
