/**
 * core/auth.js - نظام تسجيل الدخول والحماية (Namespaced Version)
 */

window.Auth = {
    isLoginMode: true,

    // 1. التحقق من حالة تسجيل الدخول
    async checkAuth() {
        const { data: { session } } = await window.sb.auth.getSession();
        const isLoginPage = window.location.pathname.includes('login.html');

        if (!session && !isLoginPage) window.location.replace('login.html');
        else if (session && isLoginPage) window.location.replace('index.html');
    },

    // 2. التبديل بين واجهة الدخول والتسجيل
    toggleMode() {
        this.isLoginMode = !this.isLoginMode;
        const nameGroup = document.getElementById('nameGroup');
        const title = document.getElementById('formTitle');
        const submitBtn = document.getElementById('submitBtn');
        const toggleBtn = document.getElementById('toggleModeBtn');

        if (this.isLoginMode) {
            if (nameGroup) nameGroup.style.display = 'none';
            if (title) title.innerText = 'بوابة وصول المشرفين';
            if (submitBtn) submitBtn.innerHTML = '<i class="fa-solid fa-right-to-bracket"></i> دخول للنظام';
        } else {
            if (nameGroup) nameGroup.style.display = 'block';
            if (title) title.innerText = 'إنشاء حساب محرر جديد';
            if (submitBtn) submitBtn.innerHTML = '<i class="fa-solid fa-user-plus"></i> إنشاء حساب';
        }
    },

    // 3. معالجة إرسال النموذج
    async handleAuth(e) {
        e.preventDefault();
        const fullName = document.getElementById('fullName')?.value;
        const email = document.getElementById('email')?.value;
        const password = document.getElementById('password')?.value;
        const btn = document.getElementById('submitBtn');

        if (btn) btn.disabled = true;

        try {
            if (this.isLoginMode) {
                const { data, error } = await window.sb.auth.signInWithPassword({ email, password });
                if (error) throw error;

                // تسجيل الجلسة آلياً
                await this.logSession(data.user, data.session, email);
                window.location.replace('index.html');
            } else {
                const { data, error } = await window.sb.auth.signUp({
                    email, password, options: { data: { full_name: fullName } }
                });
                if (error) throw error;
                alert("تم إنشاء الحساب بنجاح! يمكنك الدخول الآن.");
                this.toggleMode();
            }
        } catch (err) {
            alert(err.message);
        } finally {
            if (btn) btn.disabled = false;
        }
    },

    async logSession(user, session, email) {
        try {
            const ip = await fetch('https://api.ipify.org?format=json').then(r => r.json()).then(d => d.ip).catch(() => 'Unknown');
            await window.sb.from('user_sessions').insert([{
                user_id: user.id,
                user_email: email,
                browser: navigator.userAgent.slice(0, 50),
                os: navigator.platform,
                ip_address: ip,
                session_id: session.access_token.slice(-20)
            }]);
        } catch (e) { console.error("Session log failed", e); }
    },

    async logout() {
        localStorage.clear();
        sessionStorage.clear();
        await window.sb.auth.signOut();
        window.location.replace('login.html');
    }
};

// التشغيل التلقائي
Auth.checkAuth();
const authForm = document.getElementById('authForm');
if (authForm) authForm.addEventListener('submit', (e) => Auth.handleAuth(e));