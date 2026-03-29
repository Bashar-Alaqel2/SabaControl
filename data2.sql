-- ======================================================
-- 1. تهيئة الجداول الأساسية (الهيكل الموحد)
-- ======================================================

-- أ. جدول الملفات الشخصية (Profiles)
CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid NOT NULL PRIMARY KEY REFERENCES auth.users ON DELETE CASCADE,
  email text,
  full_name text,
  role text DEFAULT 'editor',
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

-- ب. جدول الشاشات (Screens)
CREATE TABLE IF NOT EXISTS public.screens (
    device_id TEXT PRIMARY KEY,
    screen_name TEXT,
    ip_address TEXT,
    status TEXT DEFAULT 'pending', -- 'linked' or 'pending'
    play_status TEXT DEFAULT 'empty',
    last_ping TIMESTAMPTZ DEFAULT NOW(),
    created_by uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ج. جدول الأخبار العاجلة (Tickers)
CREATE TABLE IF NOT EXISTS public.tickers (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    message text NOT NULL,
    bg_color varchar(10) DEFAULT '#000000',
    text_color varchar(10) DEFAULT '#ffffff',
    speed integer DEFAULT 50,
    show_ticker boolean DEFAULT true,
    target_screen_id text DEFAULT 'all', 
    created_by uuid REFERENCES public.profiles(id) DEFAULT auth.uid(), 
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- د. جدول الجلسات النشطة (User Sessions)
CREATE TABLE IF NOT EXISTS public.user_sessions (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
  user_email TEXT,
  browser TEXT,
  os TEXT,
  ip_address TEXT,
  session_id TEXT, -- آخر 20 حرف من التوكن
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- هـ. جدول المحتوى (Playlist)
CREATE TABLE IF NOT EXISTS public.playlist (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    url TEXT NOT NULL,
    type TEXT NOT NULL, -- 'image' or 'video'
    duration INTEGER DEFAULT 10000,
    target_screen_id TEXT DEFAULT 'all',
    created_by uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
    starts_at TIMESTAMPTZ,
    expires_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- و. جدول الإعدادات (Settings)
CREATE TABLE IF NOT EXISTS public.settings (
    key TEXT PRIMARY KEY,
    value TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ======================================================
-- 2. الدوال الذكية (Functions)
-- ======================================================

-- دالة جلب الصلاحية (تمنع الدوران اللانهائي)
CREATE OR REPLACE FUNCTION public.get_my_role()
RETURNS text AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER;

-- دالة الأتمتة عند تسجيل مستخدم جديد
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, role)
  VALUES (NEW.id, NEW.email, NEW.raw_user_meta_data->>'full_name', 'editor');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ======================================================
-- 3. تفعيل الحماية (RLS) والسياسات (Policies)
-- ======================================================

-- تفعيل الحماية لكل الجداول
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE screens ENABLE ROW LEVEL SECURITY;
ALTER TABLE tickers ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE playlist ENABLE ROW LEVEL SECURITY;
ALTER TABLE settings ENABLE ROW LEVEL SECURITY;

-- حذف السياسات القديمة لتجنب التكرار
DO $$ 
DECLARE r RECORD;
BEGIN
    FOR r IN (SELECT policyname, tablename FROM pg_policies WHERE schemaname = 'public') 
    LOOP
        EXECUTE 'DROP POLICY IF EXISTS ' || quote_ident(r.policyname) || ' ON ' || quote_ident(r.tablename);
    END LOOP;
END $$;

-- [سياسات القراءة العامة للجميع - لعمل الشاشات وتطبيق Flutter]
CREATE POLICY "Public Read" ON screens FOR SELECT USING (true);
CREATE POLICY "Public Read" ON tickers FOR SELECT USING (true);
CREATE POLICY "Public Read" ON playlist FOR SELECT USING (true);
CREATE POLICY "Public Read" ON settings FOR SELECT USING (true);

-- [سياسات التحكم للمستخدم المسجل - Profiles]
CREATE POLICY "Own Profile View" ON profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Admin All View" ON profiles FOR SELECT USING (get_my_role() = 'admin');

-- [سياسات الجلسات - نظام الطرد]
CREATE POLICY "Own Session View" ON user_sessions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Admin Full Control" ON user_sessions FOR ALL USING (get_my_role() = 'admin');
CREATE POLICY "Allow Insert for Auth" ON user_sessions FOR INSERT WITH CHECK (auth.uid() = user_id);

-- [سياسات التحكم للشاشات والأخبار]
CREATE POLICY "Admin Full Control Screens" ON screens FOR ALL USING (get_my_role() = 'admin');
CREATE POLICY "Admin Full Control Tickers" ON tickers FOR ALL USING (get_my_role() = 'admin');
CREATE POLICY "Editor Own Control Tickers" ON tickers FOR ALL USING (auth.uid() = created_by);

-- ======================================================
-- 4. البث اللحظي (Realtime) والتخزين (Storage)
-- ======================================================

-- إعداد البث اللحظي
DROP PUBLICATION IF EXISTS supabase_realtime;
CREATE PUBLICATION supabase_realtime FOR TABLE 
    screens, tickers, playlist, settings, user_sessions;

-- إعداد التخزين (Media Bucket)
INSERT INTO storage.buckets (id, name, public) 
VALUES ('media', 'media', true) ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Public Media Access" ON storage.objects FOR ALL USING (bucket_id = 'media');

-- ======================================================
-- 5. الترايجر (Triggers)
-- ======================================================

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- 1. التأكد من تفعيل الحماية
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- 2. حذف أي سياسات تحديث قديمة لتجنب التعارض
DROP POLICY IF EXISTS "Admins can update all profiles" ON public.profiles;

-- 3. إنشاء سياسة تسمح للمدير فقط بتحديث أي سجل في جدول profiles
CREATE POLICY "Admins can update all profiles" 
ON public.profiles 
FOR UPDATE 
TO authenticated 
USING ( (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin' )
WITH CHECK ( (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin' );