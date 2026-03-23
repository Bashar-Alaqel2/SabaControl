// ==========================================
// core/app.js - العقل المدبر للنظام (النسخة المدعومة بالصلاحيات)
// ==========================================

// متغير عالمي لحفظ صلاحية المستخدم الحالي
window.currentUserRole = 'editor'; 

// 1. دالة تحميل الأقسام ديناميكياً
async function loadModule(moduleName) {
    const contentDiv = document.getElementById('app-content');

    // 🔴 حماية صفحة الإعدادات (Routing Protection)
    if (moduleName === 'settings' && window.currentUserRole !== 'admin') {
        contentDiv.innerHTML = `
            <div style="text-align:center; margin-top:100px; color: var(--danger); animation: fadeIn 0.4s;">
                <i class="fa-solid fa-lock" style="font-size: 50px;"></i>
                <h2 style="margin-top: 20px;">صلاحيات غير كافية</h2>
                <p style="color: #666; font-size: 16px;">عذراً، هذه الصفحة مخصصة لمديري النظام (Admins) فقط.</p>
            </div>
        `;
        updateUI(moduleName);
        return; // إيقاف التحميل هنا
    }

    contentDiv.innerHTML = `
        <div style="text-align:center; margin-top:50px;">
            <i class="fa-solid fa-spinner fa-spin" style="font-size: 40px; color: var(--primary);"></i>
            <p style="margin-top: 15px; font-weight: bold;">جاري تحميل القسم...</p>
        </div>
    `;

    try {
        const response = await fetch(`modules/${moduleName}/${moduleName}.html`);
        if (!response.ok) throw new Error('لم يتم العثور على الملف');
        const html = await response.text();
        contentDiv.innerHTML = html;

        if (!document.getElementById(`style-${moduleName}`)) {
            const link = document.createElement('link');
            link.id = `style-${moduleName}`;
            link.rel = 'stylesheet';
            link.href = `modules/${moduleName}/${moduleName}.css`;
            document.head.appendChild(link);
        }

        if (!document.getElementById(`script-${moduleName}`)) {
            const script = document.createElement('script');
            script.id = `script-${moduleName}`;
            script.src = `modules/${moduleName}/${moduleName}.js`;
            document.body.appendChild(script);
        } else {
            const initFunctionName = `init${capitalizeFirstLetter(moduleName)}`;
            if (typeof window[initFunctionName] === 'function') {
                window[initFunctionName]();
            }
        }

        updateUI(moduleName);

    } catch (error) {
        console.error(`خطأ في تحميل القسم [${moduleName}]:`, error);
        contentDiv.innerHTML = `
            <div style="text-align:center; margin-top:50px; color: var(--danger);">
                <i class="fa-solid fa-triangle-exclamation" style="font-size: 40px;"></i>
                <h3 style="margin-top: 15px;">عذراً، حدث خطأ أثناء تحميل الصفحة!</h3>
            </div>
        `;
    }
}

// 2. تحديث واجهة المستخدم
function updateUI(moduleName) {
    document.querySelectorAll('.nav-links li').forEach(li => li.classList.remove('active'));
    const activeTab = document.getElementById(`tab-${moduleName}`);
    if (activeTab) activeTab.classList.add('active');

    const titles = { 'dashboard': 'لوحة القيادة الرئيسية', 'screens': 'إدارة الشاشات والأجهزة', 'content': 'إدارة المحتوى والمكتبة', 'settings': 'إعدادات النظام' };
    const pageTitle = document.getElementById('pageTitle');
    if (pageTitle) pageTitle.innerText = titles[moduleName] || 'SabaPost';

    if (window.innerWidth <= 768) {
        const sidebar = document.querySelector('.sidebar');
        const overlay = document.getElementById('sidebar-overlay');
        if (sidebar) sidebar.classList.remove('active');
        if (overlay) overlay.classList.remove('active');
    }
}

function toggleSidebar() {
    const sidebar = document.querySelector('.sidebar');
    const overlay = document.getElementById('sidebar-overlay');
    if (sidebar) sidebar.classList.toggle('active');
    if (overlay) overlay.classList.toggle('active');
}

function capitalizeFirstLetter(string) {
    return string.charAt(0).toUpperCase() + string.slice(1);
}

// 🟢 3. جلب بيانات المستخدم وتحديث القائمة الجانبية
async function loadUserProfile() {
    try {
        const { data: { user } } = await window.sb.auth.getUser();
        if (!user) return;

        // جلب الملف الشخصي من جدول profiles
        const { data: profile } = await window.sb.from('profiles').select('*').eq('id', user.id).single();

        if (profile) {
            // 🔴 إذا كان الحساب موقوفاً، اطرده فوراً
            if (profile.is_active === false) {
                alert("تم إيقاف حسابك من قبل إدارة النظام. يرجى التواصل مع الإدارة.");
                await window.sb.auth.signOut();
                window.location.replace('login.html');
                return;
            }
            window.currentUserRole = profile.role; // حفظ الصلاحية عالمياً
            
            // تحديث الجزء السفلي من القائمة الجانبية
            const footer = document.querySelector('.sidebar-footer');
            if (footer) {
                const roleDisplay = profile.role === 'admin' ? 'مدير النظام 👑' : 'محرر محتوى ✍️';
                footer.innerHTML = `
                    <div style="margin-bottom: 15px; background: rgba(0,0,0,0.2); padding: 10px; border-radius: 8px;">
                        <div style="font-size: 14px; color: white; margin-bottom: 4px;">
                            <i class="fa-regular fa-circle-user"></i> <b>${profile.full_name || 'مستخدم'}</b>
                        </div>
                        <div style="font-size: 11px; color: #bbb;">${roleDisplay}</div>
                    </div>
                    <button class="btn btn-danger btn-block" onclick="logout()" style="font-size: 13px; padding: 8px; background-color: #d32f2f;">
                        <i class="fa-solid fa-power-off"></i> خروج
                    </button>
                `;
            }

            // إخفاء تبويب الإعدادات نهائياً إذا لم يكن مديراً
            if (profile.role !== 'admin') {
                const settingsTab = document.getElementById('tab-settings');
                if (settingsTab) settingsTab.style.display = 'none';
            }
        }
    } catch (err) {
        console.error("لم نتمكن من جلب الملف الشخصي:", err);
    }
}

// ==========================================
// 🚀 بدء التشغيل التلقائي للنظام
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
    loadUserProfile().then(() => {
        loadModule('dashboard'); // تحميل لوحة القيادة بعد معرفة الصلاحيات
    });
});