// ==========================================
// 🔐 core/auth.js - نظام تسجيل الدخول والحماية
// ==========================================

let isLoginMode = true; // متغير لمعرفة حالة الواجهة الحالية (دخول أم تسجيل)

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
    
    // إخفاء رسائل الخطأ عند التبديل
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

// 3. معالجة إرسال النموذج (تسجيل دخول أو حساب جديد)
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
    successMsg.style.display = 'none';

    try {
        if (isLoginMode) {
            // 🟢 عملية تسجيل الدخول
            const { error } = await window.sb.auth.signInWithPassword({ email, password });
            if (error) throw new Error('البريد الإلكتروني أو كلمة المرور غير صحيحة.');
            
            window.location.replace('index.html');

        } else {
            // 🟢 عملية تسجيل حساب جديد
            const { data, error } = await window.sb.auth.signUp({
                email: email,
                password: password,
                options: {
                    data: { full_name: fullName } // نرسل الاسم ليقوم الزناد بتخزينه في جدول profiles
                }
            });
            
            if (error) throw new Error(error.message);

            // نجاح التسجيل
            successMsg.style.display = 'block';
            setTimeout(() => { window.location.replace('index.html'); }, 1500);
        }
    } catch (error) {
        // فشل العملية
        btn.innerHTML = isLoginMode ? '<i class="fa-solid fa-right-to-bracket"></i> دخول للنظام' : '<i class="fa-solid fa-user-plus"></i> إنشاء حساب';
        btn.disabled = false;
        errorMsg.innerHTML = `<i class="fa-solid fa-triangle-exclamation"></i> ${error.message}`;
        errorMsg.style.display = 'block';
    }
}

// 4. تسجيل الخروج
window.logout = async function() {
    await window.sb.auth.signOut();
    window.location.replace('login.html');
}

// ربط الحدث بالنموذج إذا كنا في صفحة تسجيل الدخول
const authForm = document.getElementById('authForm');
if (authForm) {
    authForm.addEventListener('submit', handleAuth);
}

// تشغيل حارس الأمن
checkAuth();