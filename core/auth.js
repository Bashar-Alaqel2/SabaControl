// ==========================================
// 🔐 core/auth.js - نظام تسجيل الدخول والحماية المطور
// ==========================================

let isLoginMode = true;

// 1. التحقق من حالة تسجيل الدخول (الحارس)
async function checkAuth() {
    const { data: { session } } = await window.sb.auth.getSession();
    const isLoginPage = window.location.pathname.includes('login.html');

    if (!session && !isLoginPage) window.location.replace('login.html');
    else if (session && isLoginPage) window.location.replace('index.html');
}

// 2. دالة التبديل بين واجهة الدخول والتسجيل
window.toggleAuthMode = function() {
    isLoginMode = !isLoginMode;
    const nameGroup = document.getElementById('nameGroup');
    const title = document.getElementById('formTitle');
    const submitBtn = document.getElementById('submitBtn');
    const toggleBtn = document.getElementById('toggleModeBtn');
    const fullNameInput = document.getElementById('fullName');
    
    document.getElementById('errorMsg').style.display = 'none';
    document.getElementById('successMsg').style.display = 'none';

    if (isLoginMode) {
        nameGroup.style.display = 'none';
        fullNameInput.removeAttribute('required');
        title.innerText = 'بوابة وصول المشرفين';
        submitBtn.innerHTML = '<i class="fa-solid fa-right-to-bracket"></i> دخول للنظام';
        toggleBtn.innerText = 'ليس لديك حساب؟ تسجيل مستخدم جديد';
    } else {
        nameGroup.style.display = 'block';
        fullNameInput.setAttribute('required', 'true');
        title.innerText = 'إنشاء حساب محرر جديد';
        submitBtn.innerHTML = '<i class="fa-solid fa-user-plus"></i> إنشاء حساب';
        toggleBtn.innerText = 'لديك حساب بالفعل؟ تسجيل الدخول';
    }
}

// 3. دوال مساعدة لجلب معلومات الجهاز والـ IP
async function getUserIP() {
    try {
        const res = await fetch('https://api.ipify.org?format=json');
        const data = await res.json();
        return data.ip;
    } catch { return 'Unknown'; }
}

function getBrowserInfo() {
    const ua = navigator.userAgent;
    let browser = "متصفح غير معروف";
    if (ua.includes("Chrome")) browser = "Chrome";
    else if (ua.includes("Firefox")) browser = "Firefox";
    else if (ua.includes("Safari") && !ua.includes("Chrome")) browser = "Safari";
    else if (ua.includes("Edge")) browser = "Edge";
    
    return {
        browser: browser,
        os: navigator.platform,
        timestamp: new Date().toISOString()
    };
}

// 4. معالجة إرسال النموذج (تسجيل دخول أو حساب جديد)
async function handleAuth(e) {
    e.preventDefault();
    
    const fullName = document.getElementById('fullName').value;
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    const btn = document.getElementById('submitBtn');
    const errorMsg = document.getElementById('errorMsg');
    const successMsg = document.getElementById('successMsg');

    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> جاري المعالجة...';
    btn.disabled = true;
    errorMsg.style.display = 'none';

    try {
        if (isLoginMode) {
    // 1. تنظيف شامل قبل البدء
    await window.sb.auth.signOut(); 
    localStorage.clear();
    sessionStorage.clear();

    // 2. تسجيل الدخول
    const { data, error } = await window.sb.auth.signInWithPassword({ email, password });
    if (error) throw new Error('البريد الإلكتروني أو كلمة المرور غير صحيحة.');
    
    // 3. جمع البيانات
    const info = getBrowserInfo();
    const ip = await getUserIP();
    
    // 4. ✨ الانتظار (await) لضمان كتابة الجلسة في القاعدة قبل الانتقال
    const { error: sessionError } = await window.sb.from('user_sessions').insert([{
        user_id: data.user.id,
        user_email: email,
        browser: info.browser,
        os: info.os,
        ip_address: ip,
        session_id: data.session.access_token.slice(-20)
    }]);

    if (sessionError) throw new Error("فشل في تهيئة الجلسة الأمنية، حاول مجدداً.");

    // 5. ⏳ تأخير بسيط جداً (500ms) لضمان مزامنة السيرفر
    setTimeout(() => {
        window.location.replace('index.html');
    }, 500);

} else {
            // 🟢 عملية تسجيل حساب جديد
            const { data, error } = await window.sb.auth.signUp({
                email: email,
                password: password,
                options: { data: { full_name: fullName } }
            });
            
            if (error) throw new Error(error.message);

            successMsg.style.display = 'block';
            setTimeout(() => { window.location.replace('index.html'); }, 1500);
        }
    } catch (error) {
        btn.innerHTML = isLoginMode ? '<i class="fa-solid fa-right-to-bracket"></i> دخول للنظام' : '<i class="fa-solid fa-user-plus"></i> إنشاء حساب';
        btn.disabled = false;
        errorMsg.innerHTML = `<i class="fa-solid fa-triangle-exclamation"></i> ${error.message}`;
        errorMsg.style.display = 'block';
    }
}

// 5. إدارة الجلسات (للمدير)
async function fetchAllSessions() {
    try {
        const { data: sessions, error } = await window.sb
            .from('user_sessions')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) throw error;

        const tableBody = document.getElementById('activeSessionsTable');
        if (!tableBody) return;
        
        tableBody.innerHTML = '';
        sessions.forEach(session => {
            const isOnline = new Date() - new Date(session.created_at) < 300000; 

            tableBody.innerHTML += `
                <tr>
                    <td class="ps-3">
                        <div class="fw-bold">${session.user_email.split('@')[0]}</div>
                        <div class="small text-muted">${session.user_email}</div>
                    </td>
                    <td>
                        <span class="badge bg-light text-dark border">
                            <i class="fa-solid fa-window-restore me-1"></i> ${session.browser}
                        </span>
                    </td>
                    <td><code class="text-primary">${session.ip_address}</code></td>
                    <td>
                        <span class="status-dot ${isOnline ? 'bg-success' : 'bg-secondary'}"></span>
                        ${new Date(session.created_at).toLocaleTimeString('ar-EG')}
                    </td>
                    <td class="text-center">
                        <button class="btn btn-sm btn-outline-danger" 
                                onclick="terminateSession('${session.id}')">
                            <i class="fa-solid fa-user-slash"></i>
                        </button>
                    </td>
                </tr>
            `;
        });
    } catch (error) {
        console.error("خطأ في جلب الجلسات:", error);
    }
}

// 6. إنهاء الجلسة (الطرد)
async function terminateSession(sessionId) {
    if (confirm("هل أنت متأكد من إنهاء جلسة هذا المستخدم؟")) {
        const { error } = await window.sb.from('user_sessions').delete().eq('id', sessionId);
        if (!error) {
            fetchAllSessions();
            if (typeof showToast === 'function') showToast("تم إنهاء الجلسة", "success");
        }
    }
}

// 7. تسجيل الخروج
window.logout = async function() {
    console.log("🔄 جاري تسجيل الخروج وتنظيف الجلسة...");

    try {
        // 1. مسح الكاش البرمجي (Global Cache)
        if (typeof appCache !== 'undefined') {
            appCache.profile = null;
            appCache.settings = null;
            appCache.lastFetch = { profile: 0, settings: 0 };
        }

        // الخطوة الأهم: مسح ذاكرة المتصفح تماماً 
        // هذا يضمن عدم بقاء أي توكن (Token) قديم يسبب تداخل
        localStorage.clear();
        sessionStorage.clear();

        // 3. تسجيل الخروج من Supabase (تعطيل الجلسة في السيرفر)
        await window.sb.auth.signOut();

    } catch (err) {
        console.error("خطأ أثناء تسجيل الخروج:", err);
    } finally {
        // 4. التوجيه لصفحة الدخول باستخدام replace لضمان عدم العودة للخلف
        window.location.replace('login.html');
    }
}
// تشغيل الأحداث والحماية
const authForm = document.getElementById('authForm');
if (authForm) authForm.addEventListener('submit', handleAuth);

checkAuth();