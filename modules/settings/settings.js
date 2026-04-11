// ==========================================
// 🎨 modules/settings/settings.js - الإعدادات والتحكم الشامل
// النسخة الاحترافية (المزامنة + الأمان + إدارة الجلسات)
// ==========================================

/**
 * 1. تهيئة صفحة الإعدادات عند التحميل
 */
function initSettings() {
    fetchSettings();
    attachColorListeners();

    // 🛡️ تفعيل الخصائص الإدارية فقط للمدير (Admin)
    if (window.currentUserRole === 'admin') {
        const usersSection = document.getElementById('adminUsersSection');
        const sessionsSection = document.getElementById('adminSessionsSection');
        const settingsTicker = document.getElementById('adminSettingsTicker');

        if (usersSection) {
            usersSection.style.display = 'block';
            fetchUsersList();
        }

        if (sessionsSection) {
            sessionsSection.style.display = 'block';
            fetchAllSessions();
        }

        if (settingsTicker) {
            settingsTicker.style.display = 'block';
        }
    }
}

/**
 * 2. جلب إعدادات المظهر والهوية من القاعدة
 */
async function fetchSettings() {
    try {
        const { data } = await window.sb.from('settings').select('*');
        if (data) {
            // إعدادات شريط الأخبار
            const showSetting = data.find(item => item.key === 'show_ticker');
            const isShowing = showSetting ? (showSetting.value === 'true') : true;
            if (document.getElementById('tickerToggle')) document.getElementById('tickerToggle').checked = isShowing;
            if (document.getElementById('settingsTickerToggle')) document.getElementById('settingsTickerToggle').checked = isShowing;

            const newsSetting = data.find(item => item.key === 'news_ticker');
            if (newsSetting) {
                if (document.getElementById('newsInput')) document.getElementById('newsInput').value = newsSetting.value;
                if (document.getElementById('settingsNewsInput')) document.getElementById('settingsNewsInput').value = newsSetting.value;
            }

            // إعدادات الشعار (Fallback)
            const fallbackSetting = data.find(item => item.key === 'fallback_image');
            if (fallbackSetting && fallbackSetting.value) {
                const preview = document.getElementById('currentFallbackPreview');
                const placeholder = document.getElementById('fallbackPlaceholder');
                if (preview) {
                    preview.src = fallbackSetting.value;
                    preview.style.display = 'block';
                    if (placeholder) placeholder.style.display = 'none';
                }
            }

            // إعدادات الألوان واسم النظام
            const sysName = data.find(item => item.key === 'system_name')?.value || 'SabaPost';
            const primaryColor = data.find(item => item.key === 'theme_primary')?.value || '#5c6bc0';
            const sidebarColor = data.find(item => item.key === 'theme_sidebar')?.value || '#2b2b44';
            const bgColor = data.find(item => item.key === 'theme_bg')?.value || '#f4f7fa';
            const cardBgColor = data.find(item => item.key === 'theme_card_bg')?.value || '#ffffff';
            const textColor = data.find(item => item.key === 'theme_text')?.value || '#333333';

            document.querySelectorAll('.brand span').forEach(el => el.innerText = sysName);
            if (document.getElementById('systemName')) document.getElementById('systemName').value = sysName;

            // تطبيق الألوان على المتصفح
            const root = document.documentElement.style;
            root.setProperty('--primary', primaryColor);
            root.setProperty('--sidebar-bg', sidebarColor);
            root.setProperty('--bg-color', bgColor);
            root.setProperty('--card-bg', cardBgColor);
            root.setProperty('--text-color', textColor);

            // تحديث قيم حقول الألوان (Color Pickers)
            const themeColors = {
                'primaryColor': primaryColor,
                'sidebarColor': sidebarColor,
                'bgColor': bgColor,
                'cardBgColor': cardBgColor,
                'textColor': textColor
            };

            for (const [id, colorValue] of Object.entries(themeColors)) {
                const picker = document.getElementById(id);
                const textInput = document.getElementById(id + 'Text');
                const circle = document.getElementById(id + 'Circle');
                if (picker) picker.value = colorValue;
                if (textInput) textInput.value = colorValue;
                if (circle) circle.style.borderColor = colorValue;
            }
        }
    } catch (err) { console.error("خطأ في جلب الإعدادات:", err); }
}

/**
 * 3. حفظ إعدادات المظهر (Theme)
 */
async function saveThemeSettings() {
    const settings = [
        { key: 'system_name', value: document.getElementById('systemName').value },
        { key: 'theme_primary', value: document.getElementById('primaryColor').value },
        { key: 'theme_sidebar', value: document.getElementById('sidebarColor').value },
        { key: 'theme_bg', value: document.getElementById('bgColor').value },
        { key: 'theme_card_bg', value: document.getElementById('cardBgColor').value },
        { key: 'theme_text', value: document.getElementById('textColor').value }
    ];

    try {
        const { error } = await window.sb.from('settings').upsert(settings);
        if (error) throw error;
        alert('تم حفظ وتطبيق المظهر بنجاح! 🎨');
        fetchSettings();
    } catch (err) { alert('حدث خطأ أثناء الحفظ'); }
}

/**
 * 4. إدارة المستخدمين (Profiles)
 */
async function fetchUsersList() {
    try {
        const { data: users, error } = await window.sb.from('profiles').select('*').order('created_at', { ascending: false });
        if (error) throw error;

        const tbody = document.getElementById('usersListTable');
        if (!tbody) return;
        tbody.innerHTML = '';

        const { data: { user: currentUser } } = await window.sb.auth.getUser();

        users.forEach(u => {
            const isMe = u.id === currentUser?.id;
            const roleBadge = u.role === 'admin' 
                ? '<span class="badge-glass" style="background:rgba(148,15,49,0.1); color:var(--primary);">مدير النظام 👑</span>' 
                : '<span class="badge-glass" style="background:rgba(0,0,0,0.05); color:#666;">محرر محتوى ✍️</span>';
                
            const statusBadge = u.is_active !== false
                ? '<span class="badge-glass" style="background:rgba(46,204,113,0.1); color:#2ecc71;"><span class="status-dot bg-success"></span> نشط حالياً</span>'
                : '<span class="badge-glass" style="background:rgba(231,76,60,0.1); color:#e74c3c;"><span class="status-dot" style="background:#e74c3c;"></span> حساب موقوف</span>';
                
            const actionButtons = isMe ? `<span class="badge-glass bg-light">أنت (المالك)</span>` : `
                <button class="btn btn-sm btn-light rounded-circle shadow-sm" onclick="toggleUserRole('${u.id}', '${u.role}')" title="تغيير الرتبة" style="width:32px; height:32px; border:1px solid #eee; display: flex; align-items: center; justify-content: center; padding: 0;"><i class="fa-solid fa-user-shield text-primary" style="font-size: 12px;"></i></button>
                <button class="btn btn-sm ${u.is_active !== false ? 'btn-light' : 'btn-success'} rounded-circle shadow-sm" onclick="toggleUserStatus('${u.id}', ${u.is_active !== false})" style="width:32px; height:32px; border:1px solid #eee; display: flex; align-items: center; justify-content: center; padding: 0;"><i class="fa-solid ${u.is_active !== false ? 'fa-user-slash text-danger' : 'fa-check'} " style="font-size: 12px;"></i></button>
            `;

            tbody.innerHTML += `
                <tr style="transition:0.3s;">
                    <td class="fw-bold text-dark">${u.full_name || 'موظف مجهول'}</td>
                    <td><code class="small text-muted" style="font-size: 0.75rem;">${u.email}</code></td>
                    <td>${roleBadge}</td>
                    <td>${statusBadge}</td>
                    <td><div class="d-flex gap-2 justify-content-center">${actionButtons}</div></td>
                </tr>`;
        });
    } catch (err) { console.error('خطأ في جلب المستخدمين:', err); }
}

async function toggleUserRole(userId, currentRole) {
    const newRole = currentRole === 'admin' ? 'editor' : 'admin';
    if (!confirm(`تغيير الرتبة إلى ${newRole}؟`)) return;

    console.log("🚀 جاري محاولة الترقية للمستخدم:", userId);

    try {
        const { data, error } = await window.sb
            .from('profiles')
            .update({ role: newRole })
            .eq('id', userId)
            .select(); // سحب البيانات بعد التحديث للتأكد

        if (error) {
            console.error("❌ فشل تحديث قاعدة البيانات:", error.message);
            alert("فشل التحديث: " + error.message);
            return;
        }

        if (data && data.length > 0) {
            console.log("✅ نجحت العملية في السيرفر:", data[0]);
            alert(`تم تغيير الرتبة إلى ${newRole} بنجاح!`);

            // طرد الجلسة فوراً لضمان التفعيل
            await window.sb.from('user_sessions').delete().eq('user_id', userId);

            fetchUsersList(); // تحديث الجدول في الواجهة
        } else {
            console.warn("⚠️ لم يتم العثور على السجل أو لم تتغير البيانات.");
            alert("تنبيه: لم يتم تحديث أي سجل، تأكد من صلاحياتك كمدير.");
        }
    } catch (err) {
        console.error("💥 خطأ غير متوقع:", err);
    }
}

async function toggleUserStatus(userId, isCurrentlyActive) {
    const msg = isCurrentlyActive ? 'هل تريد إيقاف الحساب وطرد المستخدم؟' : 'تفعيل الحساب؟';
    if (confirm(msg)) {
        try {
            await window.sb.from('profiles').update({ is_active: !isCurrentlyActive }).eq('id', userId);
            if (isCurrentlyActive) {
                await window.sb.from('user_sessions').delete().eq('user_id', userId);
            }
            alert("تم تنفيذ العملية بنجاح ✅");
            fetchUsersList();
        } catch (err) { alert("فشل تغيير الحالة"); }
    }
}

/**
 * 5. إدارة الجلسات النشطة (Active Sessions)
 */
async function fetchAllSessions() {
    const tbody = document.getElementById('activeSessionsTable');
    if (!tbody) return;

    try {
        const { data: sessions, error } = await window.sb.from('user_sessions').select('*').order('created_at', { ascending: false });
        if (error) throw error;

        tbody.innerHTML = '';
        if (!sessions || sessions.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" class="text-center p-3 text-muted">لا توجد جلسات نشطة حالياً.</td></tr>';
            return;
        }

        sessions.forEach(s => {
            const isOnline = (Date.now() - new Date(s.created_at)) < 300000;
            tbody.innerHTML += `
                <tr class="border-0">
                    <td class="ps-0">
                        <div class="fw-bold text-dark" style="font-size:12px;">${s.user_email}</div>
                        <div class="text-muted" style="font-size:10px;">${s.ip_address}</div>
                    </td>
                    <td>
                        <span class="badge-glass bg-light text-dark border-0" style="font-size:10px; padding: 4px 8px;">${s.browser} / ${s.os}</span>
                    </td>
                    <td class="text-end pe-0">
                        <div class="d-flex align-items-center justify-content-end gap-2">
                            <span class="small text-muted" style="font-size:10px;">${new Date(s.created_at).toLocaleTimeString('ar-YE', {hour:'2-digit', minute:'2-digit'})}</span>
                            <span class="status-dot ${isOnline ? 'bg-success' : 'bg-secondary'}" style="width:7px; height:7px; margin:0;"></span>
                            <button class="btn btn-sm btn-link text-danger p-0 ms-2" onclick="terminateUserSession('${s.id}')" title="طرد"><i class="fa-solid fa-circle-xmark"></i></button>
                        </div>
                    </td>
                </tr>`;
        });
    } catch (err) { console.error(err); }
}

async function terminateUserSession(id) {
    if (confirm("هل أنت متأكد من طرد هذا المستخدم فوراً؟")) {
        await window.sb.from('user_sessions').delete().eq('id', id);
        fetchAllSessions();
    }
}

/**
 * 6. إدارة شريط الأخبار والوسائط
 */
async function saveAdvancedTicker() {
    const text = document.getElementById('settingsNewsInput')?.value || '';
    const bgColor = document.getElementById('settingsTickerBgColor')?.value || '#000000';
    const txtColor = document.getElementById('settingsTickerTextColor')?.value || '#ffffff';
    const speed = document.getElementById('settingsTickerSpeed')?.value || '50';

    try {
        await window.sb.from('settings').upsert([
            { key: 'news_ticker', value: text },
            { key: 'ticker_bg', value: bgColor },
            { key: 'ticker_color', value: txtColor },
            { key: 'ticker_speed', value: speed }
        ]);
        alert('تم تحديث شريط الأخبار بنجاح 📡');
    } catch (err) { alert('خطأ في البث'); }
}

async function uploadFallbackImage() {
    const fileInput = document.getElementById('fallbackInput');
    const file = fileInput.files[0];
    if (!file) return alert('اختر صورة أولاً');

    try {
        const fileName = `fallback_${Date.now()}.${file.name.split('.').pop()}`;
        const { data, error } = await window.sb.storage.from('media').upload(fileName, file);
        if (error) throw error;

        const { data: { publicUrl } } = window.sb.storage.from('media').getPublicUrl(fileName);
        await window.sb.from('settings').upsert({ key: 'fallback_image', value: publicUrl });
        alert("تم رفع الشعار بنجاح ✅");
        fetchSettings();
    } catch (err) { alert("فشل الرفع"); }
}

// 🔄 مراقبة تغيير الألوان لحظياً في المتصفح
function attachColorListeners() {
    const colorIds = ['primaryColor', 'sidebarColor', 'bgColor', 'cardBgColor', 'textColor'];
    colorIds.forEach(id => {
        const picker = document.getElementById(id);
        if (picker) {
            picker.addEventListener('input', (e) => {
                const textInput = document.getElementById(id + 'Text');
                if (textInput) textInput.value = e.target.value;
                
                // تحديث الدائرة المحيطة
                const circle = document.getElementById(id + 'Circle');
                if (circle) circle.style.borderColor = e.target.value;

                // تطبيق حي ومؤقت للعين
                let cssVar = id === 'primaryColor' ? '--primary' : (id === 'sidebarColor' ? '--sidebar-bg' : (id === 'bgColor' ? '--bg-color' : (id === 'cardBgColor' ? '--card-bg' : '--text-color')));
                document.documentElement.style.setProperty(cssVar, e.target.value);
            });
        }
    });
}


// تشغيل النظام
initSettings();