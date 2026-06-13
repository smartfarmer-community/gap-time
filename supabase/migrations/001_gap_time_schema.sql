-- =====================================================
-- GAP-TIME — Complete Database Reset & Setup
-- Paste this ENTIRE file into Supabase SQL Editor and Run
-- =====================================================

-- =====================================================
-- PART 0 — RESET (drops everything from previous setup)
-- Safe to run even on a fresh project — uses IF EXISTS
-- =====================================================
DROP TABLE IF EXISTS public.correction_requests CASCADE;
DROP TABLE IF EXISTS public.time_logs CASCADE;
DROP TABLE IF EXISTS public.geofence_hubs CASCADE;
DROP TABLE IF EXISTS public.user_roles CASCADE;
DROP TABLE IF EXISTS public.profiles CASCADE;

DROP FUNCTION IF EXISTS public.get_all_user_roles() CASCADE;
DROP FUNCTION IF EXISTS public.current_user_role() CASCADE;
DROP FUNCTION IF EXISTS public.handle_new_user() CASCADE;
DROP FUNCTION IF EXISTS public.update_updated_at_column() CASCADE;
DROP FUNCTION IF EXISTS private.has_role(UUID, public.app_role) CASCADE;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

DROP TYPE IF EXISTS public.correction_status CASCADE;
DROP TYPE IF EXISTS public.log_status CASCADE;
DROP TYPE IF EXISTS public.work_mode CASCADE;
DROP TYPE IF EXISTS public.app_role CASCADE;

DROP SCHEMA IF EXISTS private CASCADE;

-- =====================================================
-- PART 1 — ENUMS
-- =====================================================
CREATE TYPE public.app_role AS ENUM ('employee','manager','admin');
CREATE TYPE public.work_mode AS ENUM ('on_site','field','remote');
CREATE TYPE public.log_status AS ENUM ('pending','verified','flagged','corrected');
CREATE TYPE public.correction_status AS ENUM ('pending','approved','rejected');

-- =====================================================
-- PART 2 — TABLES
-- =====================================================

-- PROFILES (includes job position)
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  department TEXT,
  position TEXT,
  default_work_mode public.work_mode NOT NULL DEFAULT 'on_site',
  default_hub_id UUID,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- USER ROLES
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- GEOFENCE HUBS
CREATE TABLE public.geofence_hubs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  location_name TEXT NOT NULL,
  latitude DOUBLE PRECISION NOT NULL,
  longitude DOUBLE PRECISION NOT NULL,
  radius_meters INTEGER NOT NULL DEFAULT 150,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.geofence_hubs TO authenticated;
GRANT ALL ON public.geofence_hubs TO service_role;
ALTER TABLE public.geofence_hubs ENABLE ROW LEVEL SECURITY;

-- TIME LOGS
CREATE TABLE public.time_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  log_date DATE NOT NULL DEFAULT CURRENT_DATE,
  work_mode public.work_mode NOT NULL,
  hub_id UUID REFERENCES public.geofence_hubs(id) ON DELETE SET NULL,
  clock_in_time TIMESTAMPTZ,
  clock_out_time TIMESTAMPTZ,
  clock_in_lat DOUBLE PRECISION,
  clock_in_long DOUBLE PRECISION,
  clock_in_accuracy DOUBLE PRECISION,
  clock_out_lat DOUBLE PRECISION,
  clock_out_long DOUBLE PRECISION,
  clock_out_accuracy DOUBLE PRECISION,
  geofence_verified BOOLEAN NOT NULL DEFAULT false,
  distance_meters DOUBLE PRECISION,
  daily_summary_notes TEXT,
  status public.log_status NOT NULL DEFAULT 'pending',
  correction_notes TEXT,
  is_offline_cached BOOLEAN NOT NULL DEFAULT false,
  flagged_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.time_logs TO authenticated;
GRANT ALL ON public.time_logs TO service_role;
ALTER TABLE public.time_logs ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_time_logs_user_date ON public.time_logs(user_id, log_date DESC);

-- CORRECTION REQUESTS
CREATE TABLE public.correction_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  log_id UUID REFERENCES public.time_logs(id) ON DELETE SET NULL,
  request_date DATE NOT NULL,
  requested_work_mode public.work_mode NOT NULL,
  requested_in_time TIMESTAMPTZ,
  requested_out_time TIMESTAMPTZ,
  justification TEXT NOT NULL,
  status public.correction_status NOT NULL DEFAULT 'pending',
  reviewed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ,
  review_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.correction_requests TO authenticated;
GRANT ALL ON public.correction_requests TO service_role;
ALTER TABLE public.correction_requests ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- PART 3 — PRIVATE SCHEMA / SECURITY FUNCTIONS
-- =====================================================
CREATE SCHEMA private;
REVOKE ALL ON SCHEMA private FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION private.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

-- Public RPC: current user's own role
CREATE OR REPLACE FUNCTION public.current_user_role()
RETURNS public.app_role LANGUAGE SQL STABLE SECURITY INVOKER SET search_path = public AS $$
  SELECT role FROM public.user_roles WHERE user_id = auth.uid()
  ORDER BY CASE role WHEN 'admin' THEN 1 WHEN 'manager' THEN 2 ELSE 3 END LIMIT 1
$$;
REVOKE EXECUTE ON FUNCTION public.current_user_role() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.current_user_role() TO authenticated;

-- Public RPC: all roles (used by Admin panel, avoids 403 on user_roles table)
CREATE OR REPLACE FUNCTION public.get_all_user_roles()
RETURNS TABLE(user_id UUID, role public.app_role)
LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT user_id, role FROM public.user_roles;
$$;
REVOKE EXECUTE ON FUNCTION public.get_all_user_roles() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_all_user_roles() TO authenticated;

-- =====================================================
-- PART 4 — ROW LEVEL SECURITY POLICIES
-- =====================================================

-- profiles
CREATE POLICY "own profile select" ON public.profiles FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "managers admins view all profiles" ON public.profiles FOR SELECT TO authenticated USING (private.has_role(auth.uid(),'manager') OR private.has_role(auth.uid(),'admin'));
CREATE POLICY "own profile update" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "admin manage profiles" ON public.profiles FOR ALL TO authenticated USING (private.has_role(auth.uid(),'admin')) WITH CHECK (private.has_role(auth.uid(),'admin'));
CREATE POLICY "insert own profile on signup" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

-- user_roles
CREATE POLICY "view own roles" ON public.user_roles FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "admins view all roles" ON public.user_roles FOR SELECT TO authenticated USING (private.has_role(auth.uid(),'admin'));
CREATE POLICY "admins manage roles" ON public.user_roles FOR ALL TO authenticated USING (private.has_role(auth.uid(),'admin')) WITH CHECK (private.has_role(auth.uid(),'admin'));

-- geofence_hubs
CREATE POLICY "all auth view hubs" ON public.geofence_hubs FOR SELECT TO authenticated USING (true);
CREATE POLICY "admins manage hubs" ON public.geofence_hubs FOR ALL TO authenticated USING (private.has_role(auth.uid(),'admin')) WITH CHECK (private.has_role(auth.uid(),'admin'));

-- time_logs
CREATE POLICY "view own logs" ON public.time_logs FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "managers admins view all logs" ON public.time_logs FOR SELECT TO authenticated USING (private.has_role(auth.uid(),'manager') OR private.has_role(auth.uid(),'admin'));
CREATE POLICY "insert own logs" ON public.time_logs FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "update own logs" ON public.time_logs FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "admins update any log" ON public.time_logs FOR UPDATE TO authenticated USING (private.has_role(auth.uid(),'admin')) WITH CHECK (private.has_role(auth.uid(),'admin'));
CREATE POLICY "managers flag logs" ON public.time_logs FOR UPDATE TO authenticated USING (private.has_role(auth.uid(),'manager')) WITH CHECK (private.has_role(auth.uid(),'manager'));

-- correction_requests
CREATE POLICY "view own corrections" ON public.correction_requests FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "managers admins view corrections" ON public.correction_requests FOR SELECT TO authenticated USING (private.has_role(auth.uid(),'manager') OR private.has_role(auth.uid(),'admin'));
CREATE POLICY "create own corrections" ON public.correction_requests FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "managers admins review corrections" ON public.correction_requests FOR UPDATE TO authenticated USING (private.has_role(auth.uid(),'manager') OR private.has_role(auth.uid(),'admin')) WITH CHECK (private.has_role(auth.uid(),'manager') OR private.has_role(auth.uid(),'admin'));

-- =====================================================
-- PART 5 — TRIGGERS
-- =====================================================
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE TRIGGER trg_profiles_updated BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_hubs_updated BEFORE UPDATE ON public.geofence_hubs FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_logs_updated BEFORE UPDATE ON public.time_logs FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Auto-create profile + employee role on signup (now captures position)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (user_id, name, email, department, position, default_work_mode)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email,'@',1)),
    NEW.email,
    NEW.raw_user_meta_data->>'department',
    NEW.raw_user_meta_data->>'position',
    COALESCE((NEW.raw_user_meta_data->>'default_work_mode')::public.work_mode,'on_site')
  );
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'employee');
  RETURN NEW;
END; $$;

CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- =====================================================
-- PART 6 — SEED HUBS (correct Kumasi coordinates)
-- =====================================================
INSERT INTO public.geofence_hubs (location_name, latitude, longitude, radius_meters)
VALUES
  ('Kumasi Administrative Studio', 6.71282, -1.59829, 150),
  ('Main Processing Plant (Ejisu)',  6.74230, -1.53120, 200),
  ('Accra Liaison Office',           5.60370, -0.18700, 100);

-- =====================================================
-- PART 7 — BACKFILL PROFILES FOR EXISTING AUTH USERS
-- (Auth accounts survive the reset above, but their
--  profiles/roles were just dropped — this recreates them)
-- =====================================================
INSERT INTO public.profiles (user_id, name, email, department, position, default_work_mode)
SELECT
  u.id,
  COALESCE(u.raw_user_meta_data->>'name', split_part(u.email,'@',1)),
  u.email,
  u.raw_user_meta_data->>'department',
  u.raw_user_meta_data->>'position',
  COALESCE((u.raw_user_meta_data->>'default_work_mode')::public.work_mode, 'on_site')
FROM auth.users u
ON CONFLICT (user_id) DO NOTHING;

INSERT INTO public.user_roles (user_id, role)
SELECT u.id, 'employee' FROM auth.users u
ON CONFLICT (user_id, role) DO NOTHING;

-- =====================================================
-- PART 8 — PROMOTE YOUR ADMIN ACCOUNT
-- Change the email below to your own HR/Admin account
-- =====================================================
UPDATE public.user_roles
SET role = 'admin'
WHERE user_id = (SELECT id FROM auth.users WHERE email = 'quansah@gap.com');

-- If the line above affected 0 rows, run this instead:
-- DELETE FROM public.user_roles WHERE user_id = (SELECT id FROM auth.users WHERE email = 'quansah@gap.com');
-- INSERT INTO public.user_roles (user_id, role) VALUES ((SELECT id FROM auth.users WHERE email = 'quansah@gap.com'), 'admin');

-- =====================================================
-- DONE. Next steps:
-- 1. Authentication → Providers → Email → turn OFF "Confirm email"
-- 2. Sign in with your existing accounts — profiles/roles are restored
-- 3. As Admin, set each person's Job Position from User Management,
--    or run: UPDATE public.profiles SET position = 'Farms Officer' WHERE email = '...';
-- =====================================================
