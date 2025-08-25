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

-- Ensure end_date exists for existing deployments
DO $$ BEGIN
  ALTER TABLE public.events ADD COLUMN IF NOT EXISTS end_date DATE;
EXCEPTION WHEN duplicate_column THEN
  NULL;
END $$;

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
  end_date DATE,
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

-- Prevent duplicate attendance for the same phone within the same event
DO $$ BEGIN
  ALTER TABLE public.attendance
    ADD CONSTRAINT attendance_unique_event_phone UNIQUE (event_id, phone);
EXCEPTION WHEN duplicate_object THEN
  -- constraint already exists
  NULL;
END $$;

-- RLS Policies for Users table
CREATE POLICY "Users can view their own profile" ON public.users
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update their own profile" ON public.users
  FOR UPDATE USING (auth.uid() = id);

-- Allow users to create their own profile on first login
CREATE POLICY "Users can insert their own profile" ON public.users
  FOR INSERT WITH CHECK (auth.uid() = id);

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

-- Public-safe view and policy for listing active events in the attendance form
CREATE OR REPLACE VIEW public.public_active_events AS
SELECT id, name, event_date, end_date, start_time, end_time, church, is_active
FROM public.events
WHERE is_active = true;

-- Allow anyone (including anon) to view only active events
DO $$ BEGIN
  DROP POLICY IF EXISTS "Anyone can view active events via view" ON public.events;
EXCEPTION WHEN undefined_object THEN
  NULL;
END $$;

CREATE POLICY "Anyone can view active events via view" ON public.events
  FOR SELECT USING (is_active = true);

-- RLS Policies for Attendance table
CREATE POLICY "Authenticated users can view attendance" ON public.attendance
  FOR SELECT USING (auth.role() = 'authenticated');

-- Restrict marking attendance to active events that have started (AND correct roles)
DO $$ BEGIN
  DROP POLICY IF EXISTS "Ushers and Admins can mark attendance" ON public.attendance;
  DROP POLICY IF EXISTS "Mark attendance from 2h before start" ON public.attendance;
EXCEPTION WHEN undefined_object THEN
  NULL;
END $$;

CREATE POLICY "Mark attendance in 2h window" ON public.attendance
  FOR INSERT WITH CHECK (
    -- role check
    EXISTS (
      SELECT 1 FROM public.users 
      WHERE users.id = auth.uid() AND users.role IN ('Admin', 'Usher')
    )
    AND
    -- event is active and within window (supports overnight end)
    EXISTS (
      SELECT 1 FROM public.events e
      WHERE e.id = event_id
        AND e.is_active = true
        AND (
          -- If no start time, allow on any date between event_date and end_date (inclusive)
          (
            e.start_time IS NULL AND CURRENT_DATE BETWEEN e.event_date AND COALESCE(e.end_date, e.event_date)
          )
          OR (
            -- Compute timestamp window across midnight using proper casting
            NOW() >= (
              e.event_date::timestamp
              + (e.start_time::interval)
              - INTERVAL '2 hours'
            )
            AND
            NOW() <= (
              COALESCE(e.end_date, e.event_date)::timestamp
              + (COALESCE(e.end_time, e.start_time)::interval)
            )
          )
        )
    )
  );

-- Function to deactivate old events (over 30 days past end)
CREATE OR REPLACE FUNCTION deactivate_old_events()
RETURNS void AS $$
BEGIN
  UPDATE public.events 
  SET is_active = false
  WHERE is_active = true
    AND (
      -- For events with end_date and end_time
      (end_date IS NOT NULL AND end_time IS NOT NULL AND 
       (end_date::timestamp + end_time::interval) < NOW() - INTERVAL '30 days')
      OR
      -- For events with end_date but no end_time (all-day events ending on end_date)
      (end_date IS NOT NULL AND end_time IS NULL AND 
       end_date < CURRENT_DATE - INTERVAL '30 days')
      OR
      -- For events without end_date but with end_time
      (end_date IS NULL AND end_time IS NOT NULL AND 
       (event_date::timestamp + end_time::interval) < NOW() - INTERVAL '30 days')
      OR
      -- For events without end_date or end_time (all-day events ending on event_date)
      (end_date IS NULL AND end_time IS NULL AND 
       event_date < CURRENT_DATE - INTERVAL '30 days')
    );
END;
$$ LANGUAGE plpgsql;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_members_phone ON public.members(phone);
CREATE INDEX IF NOT EXISTS idx_visitors_phone ON public.visitors(phone);
CREATE INDEX IF NOT EXISTS idx_events_date ON public.events(event_date);
CREATE INDEX IF NOT EXISTS idx_attendance_event_phone ON public.attendance(event_id, phone);
CREATE INDEX IF NOT EXISTS idx_attendance_event_id ON public.attendance(event_id);
CREATE INDEX IF NOT EXISTS idx_attendance_date ON public.attendance(created_at);

-- Secure RPC: lookup person by phone (minimal fields). Uses SECURITY DEFINER to bypass RLS safely.
CREATE OR REPLACE FUNCTION public.lookup_person_by_phone(p_phone text)
RETURNS TABLE(category text, name text, church text, how_heard text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $fn$
DECLARE
  raw text := p_phone;
  digits text := regexp_replace(p_phone, '\\D', '', 'g');
BEGIN
  -- Members (raw)
  RETURN QUERY
  SELECT 'Member', m.name, m.church, NULL::text
  FROM public.members m
  WHERE m.phone = raw
  LIMIT 1;
  IF FOUND THEN RETURN; END IF;

  -- Members (digits)
  IF digits IS NOT NULL AND digits <> raw THEN
    RETURN QUERY
    SELECT 'Member', m.name, m.church, NULL::text
    FROM public.members m
    WHERE m.phone = digits
    LIMIT 1;
    IF FOUND THEN RETURN; END IF;
  END IF;

  -- Visitors (raw)
  RETURN QUERY
  SELECT 'Visitor', v.name, v.church, v.how_heard
  FROM public.visitors v
  WHERE v.phone = raw
  LIMIT 1;
  IF FOUND THEN RETURN; END IF;

  -- Visitors (digits)
  IF digits IS NOT NULL AND digits <> raw THEN
    RETURN QUERY
    SELECT 'Visitor', v.name, v.church, v.how_heard
    FROM public.visitors v
    WHERE v.phone = digits
    LIMIT 1;
    IF FOUND THEN RETURN; END IF;
  END IF;

  -- Not found: return nothing
  RETURN;
END;
$fn$;

-- Grants: allow both anon and authenticated to execute
GRANT EXECUTE ON FUNCTION public.lookup_person_by_phone(text) TO anon, authenticated;

-- Convenience view: attendance with marked_by user's name
CREATE OR REPLACE VIEW public.attendance_with_user AS
SELECT a.*, u.name AS marked_by_name
FROM public.attendance a
LEFT JOIN public.users u ON u.id = a.marked_by;

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
