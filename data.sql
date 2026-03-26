--  جدول الشاشات (screens): لإدارة الأجهزة المتصلة وحالتها
CREATE TABLE screens (
    device_id TEXT PRIMARY KEY, -- المعرف الفريد للشاشة (ID الجهاز)
    ip_address TEXT, -- عنوان الـ IP للشاشة
    status TEXT DEFAULT 'pending', -- حالة التصريح ('linked' مفعل، أو 'pending' بانتظار الموافقة)
    play_status TEXT DEFAULT 'empty', -- حالة العرض ('playing' يعرض محتوى، أو 'empty' شاشة فارغة)
    last_ping TIMESTAMPTZ DEFAULT NOW(), -- آخر مرة اتصلت فيها الشاشة بالسيرفر (لمعرفة Online/Offline)
    created_at TIMESTAMPTZ DEFAULT NOW() -- تاريخ إضافة الشاشة للنظام
);

--  جدول قائمة التشغيل (playlist): لإدارة المحتوى (صور/فيديو) والجدولة

CREATE TABLE playlist (
    id UUID DEFAULT gen_random_uuid () PRIMARY KEY, -- معرف فريد تلقائي لكل إعلان
    url TEXT NOT NULL, -- الرابط المباشر للملف (صورة أو فيديو)
    type TEXT NOT NULL, -- نوع الملف ('image' أو 'video')
    duration INTEGER DEFAULT 10000, -- مدة العرض بالمللي ثانية (للصور)
    target_screen_id TEXT DEFAULT 'all', -- الشاشة المستهدفة (ID الشاشة، أو 'all' للجميع)
    starts_at TIMESTAMPTZ, -- وقت وتاريخ بداية العرض المجدول
    expires_at TIMESTAMPTZ, -- وقت وتاريخ انتهاء العرض المجدول
    created_at TIMESTAMPTZ DEFAULT NOW() -- وقت رفع الملف
);

--   3 الإعدادات (settings): لحفظ هوية النظام وشريط الأخبار والشعار
CREATE TABLE settings (
    key TEXT PRIMARY KEY, -- اسم الإعداد (مثل: news_ticker, theme_primary)
    value TEXT, -- قيمة الإعداد
    created_at TIMESTAMPTZ DEFAULT NOW() -- تاريخ آخر تحديث
);

-- تفعيل خاصية (Realtime): ضرورية جداً لكي تتحدث الشاشات فوراً بدون تحديث
ALTER PUBLICATION supabase_realtime ADD TABLE screens;

ALTER PUBLICATION supabase_realtime ADD TABLE playlist;

ALTER PUBLICATION supabase_realtime ADD TABLE settings;

-- تعطيل امان طبقة  الصفوف  ومنح الوصول الكامل للمستخدمين المجهولين والمصادقة  عليهم

-- 1. التأكد أن حماية RLS معطلة تماماً
ALTER TABLE screens DISABLE ROW LEVEL SECURITY;

ALTER TABLE playlist DISABLE ROW LEVEL SECURITY;

ALTER TABLE settings DISABLE ROW LEVEL SECURITY;

-- 2. إعطاء صلاحيات كاملة للمستخدمين المجهولين (anon)
GRANT ALL ON TABLE screens TO anon;

GRANT ALL ON TABLE playlist TO anon;

GRANT ALL ON TABLE settings TO anon;

-- 3. إعطاء صلاحيات كاملة للمستخدمين المسجلين (authenticated)
GRANT ALL ON TABLE screens TO authenticated;

GRANT ALL ON TABLE playlist TO authenticated;

GRANT ALL ON TABLE settings TO authenticated;

--السماح بالوصول العام للشاشات
-- 1. السماح لأي جهاز بإضافة نفسه (Insert) وتحديث حالته (Update)
alter table screens disable row level security;

-- 2. (احتياط) إنشاء سياسة سماح شاملة
drop policy if exists "Allow Public Access" on screens;

create policy "Allow Public Access" on screens for all using (true)
with
    check (true);

-- إضافة قيمة افتراضية لشريط الأخبار
insert into
    settings (key, value)
values (
        'news_ticker',
        'نظام سبأ ميديا - مرحبا بكم'
    ) on conflict (key) do nothing;

-- 4. تفعيل Realtime (حذف القديم أولاً لتجنب الأخطاء)
drop publication if exists supabase_realtime;

create publication supabase_realtime for
table screens,
playlist,
settings;

-- 5. التخزين (Storage)
insert into
    storage.buckets (id, name, public)
values ('media', 'media', true) on conflict (id) do nothing;

-- 6. السياسات الأمنية (تنظيف القديم ثم إنشاء الجديد)
alter table screens enable row level security;

alter table playlist enable row level security;

alter table settings enable row level security;

-- حذف السياسات القديمة لتجنب خطأ "already exists"
drop policy if exists "Public Access Screens" on screens;

drop policy if exists "Public Access Playlist" on playlist;

drop policy if exists "Public Access Settings" on settings;

drop policy if exists "Public Access Storage" on storage.objects;

-- إنشاء السياسات من جديد
create policy "Public Access Screens" on screens for all using (true)
with
    check (true);

create policy "Public Access Playlist" on playlist for all using (true)
with
    check (true);

create policy "Public Access Settings" on settings for all using (true)
with
    check (true);

create policy "Public Access Storage" on storage.objects for all using (bucket_id = 'media');



-- 1. السماح لأي جهاز بإضافة نفسه (Insert) وتحديث حالته (Update)
alter table screens disable row level security;

-- 2. (احتياط) إنشاء سياسة سماح شاملة
drop policy if exists "Allow Public Access" on screens;
create policy "Allow Public Access" on screens for all using (true) with check (true);


-- ==========================================
-- 🛠️ 1. إنشاء جدول الملفات الشخصية (Profiles)
-- ==========================================
CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid NOT NULL REFERENCES auth.users ON DELETE CASCADE, -- المعرف المرتبط بحساب الدخول
  email text,                                               -- 🟢 تم إضافة حقل الإيميل هنا
  full_name text,                                           -- الاسم الكامل للمستخدم
  role text DEFAULT 'editor',                               -- الصلاحية الافتراضية (محرر)
  avatar_url text,                                          -- رابط الصورة الشخصية (اختياري للمستقبل)
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  
  PRIMARY KEY (id)
);


-- ==========================================
-- 🛡️ 2. تفعيل نظام حماية الصفوف (Row Level Security - RLS)
-- ==========================================
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- سياسة (Policy): السماح بقراءة بيانات الملفات الشخصية للجميع
CREATE POLICY "Public profiles are viewable by everyone."
  ON public.profiles FOR SELECT
  USING ( true );

-- سياسة (Policy): السماح للمستخدم بتعديل بياناته هو فقط
CREATE POLICY "Users can update own profile."
  ON public.profiles FOR UPDATE
  USING ( auth.uid() = id );


-- ==========================================
-- 🤖 3. برمجة الأتمتة (Function) 
-- ==========================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  -- 🟢 أضفنا حقل email هنا لكي يتم إدخاله
  INSERT INTO public.profiles (id, email, full_name, role)
  VALUES (
    NEW.id, 
    NEW.email,                            -- 🟢 سحب الإيميل تلقائياً من نظام الحماية
    NEW.raw_user_meta_data->>'full_name', -- استخراج الاسم من البيانات القادمة من واجهة التسجيل
    'editor'                              -- تعيين الصلاحية الافتراضية كمحرر
  );
  RETURN NEW;
END;
$$;



-- ==========================================
-- ⚡ 4. إنشاء الزناد (Trigger)
-- ==========================================
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- ==========================================
-- 🔐 تحديث سياسات الحماية (RLS) لجدول Profiles
-- ==========================================

-- 1. حذف السياسة القديمة (المفتوحة للجميع)
DROP POLICY IF EXISTS "Public profiles are viewable by everyone." ON public.profiles;


-- 2. إنشاء دالة آمنة لمعرفة صلاحية المستخدم الحالي (تتجنب الدوران اللانهائي)
CREATE OR REPLACE FUNCTION public.get_my_role()
RETURNS text
LANGUAGE sql
SECURITY DEFINER SET search_path = public
AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid();
$$;


-- 3. السياسة الأولى: يحق لأي مستخدم أن يقرأ بياناته الشخصية هو فقط
CREATE POLICY "Users can view own profile."
  ON public.profiles FOR SELECT
  USING ( auth.uid() = id );


-- 4. السياسة الثانية: يحق للمدير (admin) قراءة بيانات جميع المستخدمين
CREATE POLICY "Admins can view all profiles."
  ON public.profiles FOR SELECT
  USING ( public.get_my_role() = 'admin' );  


ALTER TABLE public.profiles ADD COLUMN is_active BOOLEAN DEFAULT true;

-- ==========================================
-- 1️⃣ ربط المحتوى بصاحبه (المالك)
-- ==========================================
-- نفترض أن جدول المحتوى الخاص بك اسمه playlist
-- نضيف عموداً يسجل تلقائياً معرف الشخص الذي قام برفع المحتوى
ALTER TABLE public.playlist 
ADD COLUMN IF NOT EXISTS created_by uuid DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE;

-- ==========================================
-- 2️⃣ سياسات الحماية الصارمة (Strict RLS) لجدول playlist
-- ==========================================
ALTER TABLE public.playlist ENABLE ROW LEVEL SECURITY;

-- 🟢 السماح للجميع (مدير ومحرر) بـ (قراءة / رؤية) كل المحتوى
DROP POLICY IF EXISTS "View all playlist items" ON public.playlist;
CREATE POLICY "View all playlist items" ON public.playlist FOR SELECT USING (true);

-- 🟢 السماح لأي مستخدم مسجل بـ (إضافة) محتوى، بشرط أن يكون هو المالك
DROP POLICY IF EXISTS "Insert playlist items" ON public.playlist;
CREATE POLICY "Insert playlist items" ON public.playlist FOR INSERT WITH CHECK (auth.uid() = created_by);

-- 🔴 منع (التعديل) إلا للمدير، أو المحرر الذي يمتلك المحتوى
DROP POLICY IF EXISTS "Update playlist items" ON public.playlist;
CREATE POLICY "Update playlist items" ON public.playlist FOR UPDATE USING (
    public.get_my_role() = 'admin' OR created_by = auth.uid()
);

-- 🔴 منع (الحذف) إلا للمدير، أو المحرر الذي يمتلك المحتوى
DROP POLICY IF EXISTS "Delete playlist items" ON public.playlist;
CREATE POLICY "Delete playlist items" ON public.playlist FOR DELETE USING (
    public.get_my_role() = 'admin' OR created_by = auth.uid()
);

-- ==========================================
-- 3️⃣ نظام المراقبة الشامل (Audit Trail)
-- ==========================================
-- إنشاء جدول السجل السري الذي لا يراه إلا المدير
CREATE TABLE IF NOT EXISTS public.audit_logs (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id uuid REFERENCES public.profiles(id), -- من قام بالعملية؟
    action text NOT NULL,                        -- نوع العملية (INSERT, UPDATE, DELETE)
    table_name text NOT NULL,                    -- أين تمت العملية؟
    record_id text,                              -- رقم العنصر الذي تم التعديل عليه
    created_at timestamp with time zone DEFAULT now()
);

-- دالة (روبوت المراقبة) التي تسجل الحركات تلقائياً
CREATE OR REPLACE FUNCTION public.log_system_action()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.audit_logs (user_id, action, table_name, record_id)
    VALUES (
        auth.uid(), 
        TG_OP, 
        TG_TABLE_NAME, 
        COALESCE(NEW.id::text, OLD.id::text)
    );
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- تفعيل كاميرات المراقبة (الزناد) على جدول المحتوى
DROP TRIGGER IF EXISTS audit_playlist ON public.playlist;
CREATE TRIGGER audit_playlist
    AFTER INSERT OR UPDATE OR DELETE ON public.playlist
    FOR EACH ROW EXECUTE PROCEDURE public.log_system_action();


-- 🟢 إضافة عمود المالك لجدول الشاشات
ALTER TABLE public.devices 
ADD COLUMN IF NOT EXISTS created_by uuid DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE;

-- 🛡️ تفعيل الحماية لجدول الشاشات
ALTER TABLE public.devices ENABLE ROW LEVEL SECURITY;

-- 1. الجميع يرى الشاشات (لأغراض البث)
CREATE POLICY "View all devices" ON public.devices FOR SELECT USING (true);

-- 2. المحرر يضيف شاشات لنفسه فقط
CREATE POLICY "Insert own devices" ON public.devices FOR INSERT WITH CHECK (auth.uid() = created_by);

-- 3. التعديل والحذف: للمدير (الكل) أو للمحرر (شاشاته فقط)
CREATE POLICY "Manage own or admin devices" ON public.devices 
FOR ALL USING (public.get_my_role() = 'admin' OR created_by = auth.uid());

-- 🎥 تفعيل كاميرا المراقبة (Audit) على جدول الشاشات أيضاً
CREATE TRIGGER audit_devices
    AFTER INSERT OR UPDATE OR DELETE ON public.devices
    FOR EACH ROW EXECUTE PROCEDURE public.log_system_action();


ALTER TABLE public.screens 
ADD COLUMN IF NOT EXISTS created_by uuid DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE;

-- 1. مسح العمود القديم الذي يسبب المشكلة
ALTER TABLE public.screens DROP COLUMN IF EXISTS created_by;

-- 2. إنشاء العمود الجديد وربطه بجدول المستخدمين بشكل صحيح
ALTER TABLE public.screens 
ADD COLUMN created_by uuid DEFAULT auth.uid() REFERENCES public.profiles(id) ON DELETE CASCADE;

-- 1. مسح عمود الارتباط القديم الخاطئ
ALTER TABLE public.playlist DROP COLUMN IF EXISTS created_by;

-- 2. إنشاء العمود الجديد وربطه بجدول المستخدمين (Profiles) بشكل صحيح ومكشوف
ALTER TABLE public.playlist 
ADD COLUMN created_by uuid DEFAULT auth.uid() REFERENCES public.profiles(id) ON DELETE CASCADE;

-- ==========================================
-- 1️⃣ إيقاف سياسات الحماية مؤقتاً (التي تعتمد على العمود القديم)
-- ==========================================
DROP POLICY IF EXISTS "Insert playlist items" ON public.playlist;
DROP POLICY IF EXISTS "Update playlist items" ON public.playlist;
DROP POLICY IF EXISTS "Delete playlist items" ON public.playlist;

-- ==========================================
-- 2️⃣ مسح العمود القديم (الآن سيتم مسحه بدون أي اعتراض)
-- ==========================================
ALTER TABLE public.playlist DROP COLUMN IF EXISTS created_by;

-- ==========================================
-- 3️⃣ إنشاء العمود الجديد وربطه بجدول المستخدمين (Profiles)
-- ==========================================
ALTER TABLE public.playlist 
ADD COLUMN created_by uuid DEFAULT auth.uid() REFERENCES public.profiles(id) ON DELETE CASCADE;

-- ==========================================
-- 4️⃣ إعادة تشغيل سياسات الحماية (RLS) الذكية
-- ==========================================
-- المحرر يضيف محتوى لنفسه فقط
CREATE POLICY "Insert playlist items" ON public.playlist 
FOR INSERT WITH CHECK (auth.uid() = created_by);

-- التعديل للمدير (الكل) أو للمحرر (محتواه فقط)
CREATE POLICY "Update playlist items" ON public.playlist 
FOR UPDATE USING (public.get_my_role() = 'admin' OR created_by = auth.uid());

-- الحذف للمدير (الكل) أو للمحرر (محتواه فقط)
CREATE POLICY "Delete playlist items" ON public.playlist 
FOR DELETE USING (public.get_my_role() = 'admin' OR created_by = auth.uid());


-- ======================================================
-- 🧹 المرحلة 1: تنظيف جدول الشاشات (حذف الأعمدة السابقة)
-- لضمان عدم تداخل بيانات "الحالة" مع "محتوى الخبر" هندسياً.
-- ======================================================
ALTER TABLE public.screens 
DROP COLUMN IF EXISTS show_ticker,
DROP COLUMN IF EXISTS ticker_text,
DROP COLUMN IF EXISTS ticker_bg,
DROP COLUMN IF EXISTS ticker_color,
DROP COLUMN IF EXISTS ticker_speed;

-- ======================================================
-- 🏗️ المرحلة 2: إنشاء جدول أشرطة الأخبار (Tickers)
-- يدعم المساءلة (created_by) والتوثيق الزمني (created_at).
-- ======================================================
CREATE TABLE IF NOT EXISTS public.tickers (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    
    -- محتوى الشريط والتصميم
    message text NOT NULL,
    bg_color varchar(10) DEFAULT '#000000',
    text_color varchar(10) DEFAULT '#ffffff',
    speed integer DEFAULT 50,
    show_ticker boolean DEFAULT true,

    -- 🎯 المرونة في الاستهداف (device_id محدد أو 'all' للكل)
    target_screen_id text DEFAULT 'all', 

    -- ⚖️ المساءلة والشفافية (من أضاف الخبر؟)
    -- يربط بجدول profiles لمعرفة اسم المدير وصلاحيته
    created_by uuid REFERENCES public.profiles(id) DEFAULT auth.uid(), 

    -- 📅 التوثيق الزمني (متى نُشر الخبر؟)
    created_at timestamp with time zone DEFAULT now()
);

-- ======================================================
-- 🛡️ المرحلة 3: نظام الحماية والسياسات (Security Policies)
-- لضمان أن المدراء فقط هم من يملكون حق البث.
-- ======================================================

-- تفعيل الحماية على مستوى الصف
ALTER TABLE public.tickers ENABLE ROW LEVEL SECURITY;

-- 1. سياسة القراءة (تسمح للشاشات وللمستخدمين برؤية الأخبار)
DROP POLICY IF EXISTS "Enable read access for all" ON public.tickers;
CREATE POLICY "Enable read access for all" 
ON public.tickers FOR SELECT 
USING (true);

-- 2. سياسة الإضافة (تسمح فقط للمدراء Admins بإرسال أخبار جديدة)
-- هنا نتحقق من جدول profiles أن المستخدم الحالي هو admin
DROP POLICY IF EXISTS "Enable insert for admins only" ON public.tickers;
CREATE POLICY "Enable insert for admins only" 
ON public.tickers FOR INSERT 
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE id = auth.uid() AND role = 'admin'
    )
);

-- 3. سياسة الحذف (اختيارية للمدراء فقط لتنظيف السجل)
DROP POLICY IF EXISTS "Enable delete for admins only" ON public.tickers;
CREATE POLICY "Enable delete for admins only" 
ON public.tickers FOR DELETE 
USING (
    EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE id = auth.uid() AND role = 'admin'
    )
);



CREATE TABLE user_sessions (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  user_email TEXT,
  browser TEXT,
  os TEXT,
  ip_address TEXT,
  session_id TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- تفعيل الحماية لكي يرى الجميع جلساتهم ولكن المدير يرى الكل
ALTER TABLE user_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can see all sessions" ON user_sessions 
USING ( auth.jwt() ->> 'role' = 'admin' );

-- 1. حذف السياسة المسببة للمشكلة
DROP POLICY IF EXISTS "Admins can see all sessions" ON user_sessions;

-- 2. سياسة تسمح لأي مستخدم برؤية "جلسته الخاصة" فقط (ضرورية لعمل الـ Guard في app.js)
CREATE POLICY "Users can see their own sessions" 
ON user_sessions FOR SELECT 
USING (auth.uid() = user_id);

-- 3. سياسة تسمح للمدير برؤية وحذف جميع الجلسات (لطرد المستخدمين)
CREATE POLICY "Admins have full control on sessions" 
ON user_sessions FOR ALL 
USING (
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() AND role = 'admin'
  )
);

-- 4. التأكد من منح الصلاحيات للمستخدمين المسجلين
GRANT ALL ON TABLE user_sessions TO authenticated;

-- نفذ هذا الأمر لتفعيل الـ Realtime لجدول الأخبار (إذا لم تكن قد فعلته)
alter publication supabase_realtime add table tickers;


-- 1. التأكد من وجود الجداول الأساسية بهيكلها الصحيح
-- (افترضنا أنك نفذت الـ CREATE TABLES أعلاه)

-- 2. تفعيل الحماية لكل الجداول (الأمان أولاً)
ALTER TABLE screens ENABLE ROW LEVEL SECURITY;
ALTER TABLE playlist ENABLE ROW LEVEL SECURITY;
ALTER TABLE settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE tickers ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_sessions ENABLE ROW LEVEL SECURITY;

-- 3. سياسات القراءة العامة (لكي يعمل تطبيق Flutter والشاشات)
-- تسمح للشاشات برؤية المحتوى بدون تسجيل دخول
CREATE POLICY "Public Read Screens" ON screens FOR SELECT USING (true);
CREATE POLICY "Public Read Playlist" ON playlist FOR SELECT USING (true);
CREATE POLICY "Public Read Settings" ON settings FOR SELECT USING (true);
CREATE POLICY "Public Read Tickers" ON tickers FOR SELECT USING (true);

-- 4. سياسات التحكم (للمدراء فقط)
-- نستخدم دالة get_my_role التي أنشأتها أنت
CREATE POLICY "Admins Full Control Tickers" ON tickers 
FOR ALL USING (public.get_my_role() = 'admin');

CREATE POLICY "Admins Full Control Screens" ON screens 
FOR ALL USING (public.get_my_role() = 'admin');

-- 5. إعداد البث اللحظي (الخاتمة)
DROP PUBLICATION IF EXISTS supabase_realtime;
CREATE PUBLICATION supabase_realtime FOR TABLE 
    screens, 
    playlist, 
    settings, 
    tickers;

-- 6. صلاحيات الـ Storage (مهم جداً للصور)
-- تأكد أن الباكت 'media' عام (Public) كما فعلت أنت


-- إضافة الجداول إلى قائمة البث اللحظي
alter publication supabase_realtime add table screens;
alter publication supabase_realtime add table tickers;
alter publication supabase_realtime add table playlist;


-- تفعيل سياسة الحماية لجدول الأخبار (Tickers)
alter table tickers enable row level security;

-- السماح للكل (بما في ذلك تطبيق Flutter) بالقراءة فقط
create policy "Allow anyone to read tickers" 
on tickers for select 
using (true);

-- السماح للمديرين فقط بالإضافة والتعديل (عبر لوحة التحكم)
create policy "Allow authenticated users to insert tickers" 
on tickers for insert 
with check (auth.role() = 'authenticated');