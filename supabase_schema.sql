-- ==========================================
-- VillageConnect Supabase Database Schema
-- Run this script in the Supabase SQL Editor
-- ==========================================

-- Enable UUID extension if not enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Create PUBLIC PROFILES Table
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users ON DELETE CASCADE,
  name text NOT NULL,
  role text NOT NULL DEFAULT 'resident', -- 'admin', 'officer', 'resident'
  approval_status text NOT NULL DEFAULT 'approved', -- 'approved', 'pending', 'rejected'
  address text,
  phone text,
  email text,
  blood_group text,
  occupation text,
  skills text[],
  volunteer text[],
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS for profiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Profiles policies
CREATE POLICY "Allow public read access to profiles" ON public.profiles
  FOR SELECT USING (true);

CREATE POLICY "Allow users to update their own profile" ON public.profiles
  FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Allow system / triggers to insert profiles" ON public.profiles
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow admins to delete profiles" ON public.profiles
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "Allow admins to update any profile" ON public.profiles
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- 2. Trigger function to automatically create profile on sign up
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (
    id,
    name,
    role,
    approval_status,
    address,
    phone,
    email,
    blood_group,
    occupation,
    skills,
    volunteer
  )
  VALUES (
    new.id,
    COALESCE(new.raw_user_meta_data->>'name', 'New Officer'),
    COALESCE(new.raw_user_meta_data->>'role', 'officer'),
    -- Admin is pre-approved; officers are pending; others are approved
    CASE 
      WHEN COALESCE(new.raw_user_meta_data->>'role', 'officer') = 'admin' THEN 'approved'
      WHEN COALESCE(new.raw_user_meta_data->>'role', 'officer') = 'officer' THEN 'pending'
      ELSE 'approved'
    END,
    new.raw_user_meta_data->>'address',
    new.raw_user_meta_data->>'phone',
    new.email,
    new.raw_user_meta_data->>'blood_group',
    new.raw_user_meta_data->>'occupation',
    ARRAY(SELECT jsonb_array_elements_text(COALESCE(new.raw_user_meta_data->'skills', '[]'::jsonb))),
    ARRAY(SELECT jsonb_array_elements_text(COALESCE(new.raw_user_meta_data->'volunteer', '[]'::jsonb)))
  );
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to execute on signup
CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();


-- 3. Announcements Table
CREATE TABLE public.announcements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  content text NOT NULL,
  priority text NOT NULL DEFAULT 'normal', -- 'urgent', 'important', 'normal'
  category text NOT NULL DEFAULT 'General',
  date timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  author text NOT NULL,
  views integer DEFAULT 0,
  pinned boolean DEFAULT false,
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL
);

ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow public read announcements" ON public.announcements FOR SELECT USING (true);
CREATE POLICY "Allow admins/officers to insert announcements" ON public.announcements 
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE id = auth.uid() AND role IN ('admin', 'officer') AND approval_status = 'approved'
    )
  );
CREATE POLICY "Allow admins/officers to update announcements" ON public.announcements 
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE id = auth.uid() AND role IN ('admin', 'officer') AND approval_status = 'approved'
    )
  );
CREATE POLICY "Allow admins/officers to delete announcements" ON public.announcements 
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE id = auth.uid() AND role IN ('admin', 'officer') AND approval_status = 'approved'
    )
  );


-- 4. Feed Posts Table
CREATE TABLE public.posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  author_name text NOT NULL,
  author_role text NOT NULL DEFAULT 'resident',
  author_avatar text NOT NULL DEFAULT '👤',
  content text NOT NULL,
  image text,
  likes integer DEFAULT 0,
  reactions jsonb DEFAULT '{"like": 0, "love": 0, "support": 0}'::jsonb,
  timestamp timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  author_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL
);

ALTER TABLE public.posts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow public read posts" ON public.posts FOR SELECT USING (true);
CREATE POLICY "Allow anyone to insert posts" ON public.posts FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow admins or post author to update/delete posts" ON public.posts
  FOR ALL USING (
    auth.uid() = author_id OR 
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );


-- 5. Post Comments Table
CREATE TABLE public.comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid REFERENCES public.posts(id) ON DELETE CASCADE NOT NULL,
  author_name text NOT NULL,
  text text NOT NULL,
  time timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.comments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow public read comments" ON public.comments FOR SELECT USING (true);
CREATE POLICY "Allow anyone to insert comments" ON public.comments FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow admins to delete comments" ON public.comments
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );


-- 6. Complaints Table
CREATE TABLE public.complaints (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category text NOT NULL,
  title text NOT NULL,
  description text NOT NULL,
  location text,
  complainant_name text NOT NULL,
  complainant_phone text,
  status text NOT NULL DEFAULT 'Pending', -- 'Pending', 'In Progress', 'Resolved'
  date timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  votes integer DEFAULT 0,
  updates jsonb DEFAULT '[]'::jsonb, -- array of update message objects
  upvoted_by text[] DEFAULT '{}'::text[] -- array of IP/Session IDs or Usernames who voted
);

ALTER TABLE public.complaints ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow public read complaints" ON public.complaints FOR SELECT USING (true);
CREATE POLICY "Allow anyone to insert complaints" ON public.complaints FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow anyone to update complaints (votes/status)" ON public.complaints FOR UPDATE USING (true);
CREATE POLICY "Allow admins/officers to delete complaints" ON public.complaints
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE id = auth.uid() AND role IN ('admin', 'officer') AND approval_status = 'approved'
    )
  );


-- 7. Events Table
CREATE TABLE public.events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text NOT NULL,
  date text NOT NULL,
  time text NOT NULL,
  venue text NOT NULL,
  organizer text NOT NULL,
  category text NOT NULL DEFAULT 'General',
  attendees integer DEFAULT 0,
  rsvps jsonb DEFAULT '[]'::jsonb -- array of RSVP registration details
);

ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow public read events" ON public.events FOR SELECT USING (true);
CREATE POLICY "Allow admins/officers to manage events" ON public.events
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE id = auth.uid() AND role IN ('admin', 'officer') AND approval_status = 'approved'
    )
  );
CREATE POLICY "Allow anyone to update events (RSVPs)" ON public.events FOR UPDATE USING (true);


-- 8. Marketplace Items Table
CREATE TABLE public.marketplace (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  price text NOT NULL,
  category text NOT NULL,
  description text NOT NULL,
  seller_name text NOT NULL,
  seller_phone text,
  seller_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  image text,
  date timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.marketplace ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow public read marketplace" ON public.marketplace FOR SELECT USING (true);
CREATE POLICY "Allow anyone to insert marketplace items" ON public.marketplace FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow anyone to delete marketplace items" ON public.marketplace FOR DELETE USING (true);
CREATE POLICY "Allow anyone to update marketplace items" ON public.marketplace FOR UPDATE USING (true);


-- 9. Real-Time Chat Table
CREATE TABLE public.chats (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_name text NOT NULL,
  sender_role text NOT NULL DEFAULT 'resident',
  text text NOT NULL,
  timestamp timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.chats ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow public read chats" ON public.chats FOR SELECT USING (true);
CREATE POLICY "Allow anyone to insert chats" ON public.chats FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow anyone to delete chats" ON public.chats FOR DELETE USING (true);

-- Enable replication for all required tables in one command
alter publication supabase_realtime set table 
  public.chats,
  public.posts,
  public.comments,
  public.complaints,
  public.events,
  public.announcements,
  public.profiles;
