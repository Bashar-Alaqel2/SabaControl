
//  core/app.js - النسخة الذكية (الجلسات + الكاش + الأمان اللحظي)


// 1. نظام التخزين المؤقت (Global Cache System)
const appCache = {
    profile: null,
    settings: null,
    lastFetch: { profile: 0, settings: 0 }
};

window.currentUserRole = localStorage.getItem('userRole') || 'editor'; // قراءة من الذاكرة لسرعة الرسم الابتدائي
// 2. دالة الجلب الذكي (تمنع تكرار الطلبات للسيرفر)
async function getSmartData(key, fetchFn, expiry = 300000) { // كاش لمدة 5 دقائق افتراضياً
    const now = Date.now();
    if (appCache[key] && (now - appCache.lastFetch[key] < expiry)) {
        return appCache[key];
    }
    const data = await fetchFn();
    appCache[key] = data;
    appCache.lastFetch[key] = now;
    return data;
}

// 3. حارس الجلسة النشطة (Active Session Guard)
// هذه الدالة تتأكد أن المدير لم يطرد المستخدم حالياً
async function validateSessionIntegrity() {
    try {
        const { data: { session } } = await window.sb.auth.getSession();
        if (!session) return false;

        //   وقت سماح للدخول الجديد (5 ثوانٍ) لضمان مزامنة القاعدة
        const loginTime = new Date(session.user.last_sign_in_at).getTime();
        const now = new Date().getTime();
        if (now - loginTime < 5000) return true; 

        //  جلب بيانات الجلسة والبروفايل في طلب واحد لضمان الدقة
        const [sessionRes, profileRes] = await Promise.all([
            window.sb.from('user_sessions')
                .select('id')
                .eq('session_id', session.access_token.slice(-20))
                .eq('user_id', session.user.id)
                .maybeSingle(),
            window.sb.from('profiles')
                .select('role, is_active')
                .eq('id', session.user.id)
                .maybeSingle()
        ]);

        const activeSession = sessionRes.data;
        const profile = profileRes.data;

        //  فحص الطرد (إذا حذف المدير الجلسة)
        if (!activeSession) {
            console.warn("⚠️ لم يتم العثور على الجلسة، جاري الطرد...");
            alert("تم إنهاء جلستك من قبل الإدارة.");
            if (typeof window.logout === 'function') window.logout();
            return false;
        }

        //  فحص الحساب الموقوف (الحل لمشكلتك الثانية)
        if (profile && profile.is_active === false) {
            alert("🚫 عذراً، تم إيقاف حسابك من قبل الإدارة.");
            if (typeof window.logout === 'function') window.logout();
            return false;
        }

        // 5.  تحديث الرتبة لحظياً (الحل لمشكلة الترقية)
        if (profile && profile.role !== window.currentUserRole) {
            console.log(`🔄 تم تحديث الرتبة من ${window.currentUserRole} إلى ${profile.role}`);
            window.currentUserRole = profile.role;
            // يمكنك هنا استدعاء دالة تحديث واجهة الإعدادات إذا كانت مفتوحة
        }

        return true;
    } catch (err) {
        console.error("Session integrity check failed:", err);
        return true; // حماية من أخطاء الشبكة العابرة في اليمن
    }
}

//يعمل زر المنيو عند الضغط عليه
function toggleSidebar() {
    const sidebar = document.querySelector('.sidebar');
    const overlay = document.querySelector('.sidebar-overlay');
    
    sidebar.classList.toggle('active');
    overlay.classList.toggle('active');
}


// 4. تحميل الأقسام ديناميكياً مع حماية المسارات
async function loadModule(moduleName) {
    const contentDiv = document.getElementById('app-content');
    const pageTitle = document.getElementById('pageTitle');

    // التحقق من صلاحية الجلسة قبل تحميل أي مديول
    const isSessionValid = await validateSessionIntegrity();
    if (!isSessionValid) return;
    //   تحديث نص العنوان بناءً على اسم المديول
    const moduleTitles = {
        'dashboard': 'الرئيسية',
        'screens': 'إدارة الشاشات والارتباط',
        'content': 'إدارة محتوى البث',
        'settings': 'إعدادات النظام والألوان',
        'tickers': 'شريط الأخبار العاجلة'
    };

    // تحديث النص في الـ Header
    if (pageTitle) {
        pageTitle.innerText = moduleTitles[moduleName] || 'SabaPost';
    }

    // حماية صفحة الإعدادات
    if (moduleName === 'settings' && window.currentUserRole !== 'admin') {
        renderAccessDenied(contentDiv);
        return;
    }

    showLoader(contentDiv);

    try {
        const response = await fetch(`modules/${moduleName}/${moduleName}.html`);
        if (!response.ok) throw new Error('الملف غير موجود');
        const html = await response.text();
        contentDiv.innerHTML = html;

        injectAssets(moduleName);
        // ملاحظة: دالة updateUI(moduleName) قد تكون لديك لتنفيذ أكواد إضافية
        if (typeof updateUI === 'function') updateUI(moduleName);

    } catch (error) {
        renderError(contentDiv);
    }

    if (window.innerWidth <= 768) {
        const sidebar = document.querySelector('.sidebar');
        if (sidebar && sidebar.classList.contains('active')) {
            toggleSidebar(); // إغلاق القائمة بعد الاختيار
        }
    }
}

// 5. جلب الملف الشخصي (باستخدام الكاش)
async function loadUserProfile() {
    try {
        const { data: { user } } = await window.sb.auth.getUser();
        if (!user) return;

        // جلب البيانات من الجدول مباشرة وبسرعة
        const { data: profile, error } = await window.sb
            .from('profiles')
            .select('role, is_active, full_name')
            .eq('id', user.id)
            .single();

        if (error) throw error;

        if (profile) {
            // تحديث الرتبة في كل مكان
            window.currentUserRole = profile.role;
            localStorage.setItem('userRole', profile.role); // حفظها للمرة القادمة

            // تنفيذ الإخفاء والإظهار بناءً على القيمة الطازجة
            const settingsTab = document.getElementById('tab-settings');
            const adminUsers = document.getElementById('adminUsersSection');
            
            if (profile.role === 'admin') {
                if (settingsTab) settingsTab.style.setProperty('display', 'block', 'important');
                if (adminUsers) adminUsers.style.setProperty('display', 'block', 'important');
            } else {
                if (settingsTab) settingsTab.style.setProperty('display', 'none', 'important');
            }

            renderSidebarFooter(profile);
        }
    } catch (err) { console.error(err); }
}

// 6. تطبيق المظهر (باستخدام الكاش + المزامنة اللحظية)
async function applyInitialTheme() {
    const settings = await getSmartData('settings', async () => {
        const { data } = await window.sb.from('settings').select('key, value');
        return data;
    });

    if (settings) {
        const themeMap = {};
        settings.forEach(s => themeMap[s.key] = s.value);
        
        const root = document.documentElement.style;
        root.setProperty('--primary', themeMap['theme_primary'] || '#5c6bc0');
        root.setProperty('--sidebar-bg', themeMap['theme_sidebar'] || '#2b2b44');
        root.setProperty('--bg-color', themeMap['theme_bg'] || '#f4f7fa');
        root.setProperty('--card-bg', themeMap['theme_card_bg'] || '#ffffff');
        root.setProperty('--text-color', themeMap['theme_text'] || '#333333');

        document.querySelectorAll('.brand span').forEach(el => el.innerText = themeMap['system_name'] || 'SabaPost');
    }
}

// 7. دوال مساعدة للواجهة (UI Helpers)
function showLoader(container) {
    container.innerHTML = `<div class="loader-container"><i class="fa-solid fa-spinner fa-spin"></i><p>جاري التحميل...</p></div>`;
}

function renderAccessDenied(container) {
    container.innerHTML = `<div class="error-view"><i class="fa-solid fa-lock"></i><h2>دخول غير مسموح</h2></div>`;
}

function renderSidebarFooter(profile) {
    const userInfoContent = document.getElementById('userInfoContent');
    if (!userInfoContent) return;

    const roleLabel = profile.role === 'admin' ? 'مدير النظام 👑' : 'محرر محتوى ✍️';
    
    userInfoContent.innerHTML = `
        <div class="user-info-box" style="margin-bottom: 10px; border-top: 1px solid rgba(255,255,255,0.1); padding-top: 10px;">
            <div style="font-size: 14px; font-weight: bold; color: #fff;">${profile.full_name}</div>
            <div style="font-size: 11px; color: #bbb; margin-top: 2px;">${roleLabel}</div>
        </div>
        <button class="logout-btn" onclick="logout()" 
                style="font-size: 12px; padding: 8px 12px; background-color: #d32f2f; color: white; border: none; border-radius: 5px; cursor: pointer; width: 100%; display: flex; align-items: center; justify-content: center; gap: 8px;">
            <i class="fa-solid fa-power-off"></i> تسجيل الخروج
        </button>
    `;
}

function injectAssets(moduleName) {
    if (!document.getElementById(`style-${moduleName}`)) {
        const link = document.createElement('link');
        link.id = `style-${moduleName}`; link.rel = 'stylesheet';
        link.href = `modules/${moduleName}/${moduleName}.css`;
        document.head.appendChild(link);
    }
    // إعادة تشغيل الـ Script إذا كان موجوداً لضمان عمل initFunction
    const oldScript = document.getElementById(`script-${moduleName}`);
    if (oldScript) oldScript.remove(); 
    
    const script = document.createElement('script');
    script.id = `script-${moduleName}`;
    script.src = `modules/${moduleName}/${moduleName}.js`;
    document.body.appendChild(script);
}


// 8. تشغيل النظام
document.addEventListener('DOMContentLoaded', async () => {
    await applyInitialTheme();
    
    // مراقبة تحديثات الإعدادات (الألوان والاسم)
    window.sb.channel('public:settings').on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'settings' }, () => {
        appCache.settings = null;
        applyInitialTheme();
    }).subscribe();

    // ✨ إضافة مراقب لصلاحيات المستخدم (الترقية والإيقاف اللحظي) ✨
    const { data: { user } } = await window.sb.auth.getUser();
    if (user) {
        window.sb.channel('user-security')
            .on('postgres_changes', { 
                event: 'UPDATE', 
                schema: 'public', 
                table: 'profiles', 
                filter: `id=eq.${user.id}` 
            }, (payload) => {
                console.log("🛡️ تغيير أمني رُصد:", payload.new);
                // إذا تم إيقاف الحساب أو تغيير الرتبة، نحدث البيانات فوراً
                loadUserProfile(); 
            }).subscribe();
    }

    await loadUserProfile();
    loadModule('dashboard');
});