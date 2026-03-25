// ==========================================
// 🎨 modules/settings/settings.js - الإعدادات والمظهر (النسخة المتزامنة)
// ==========================================

function initSettings() {
    fetchSettings();
    attachColorListeners();
    // 🟢 إظهار وجلب قسم المستخدمين إذا كان الشخص مديراً
    if (window.currentUserRole === 'admin') {
        const usersSection = document.getElementById('adminUsersSection');
        if (usersSection) usersSection.style.display = 'block';
        fetchUsersList();

        // 🟢 إظهار إعدادات شريط الأخبار للمدير فقط
        const settingsTicker = document.getElementById('adminSettingsTicker');
        if (settingsTicker) settingsTicker.style.display = 'block';
    }
}

async function fetchSettings() {
    try {
        const { data } = await window.sb.from('settings').select('*');
        if (data) {
            const showSetting = data.find(item => item.key === 'show_ticker');
            const isShowing = showSetting ? (showSetting.value === 'true') : true;
            if (document.getElementById('tickerToggle')) document.getElementById('tickerToggle').checked = isShowing;
            if (document.getElementById('settingsTickerToggle')) document.getElementById('settingsTickerToggle').checked = isShowing;

            const newsSetting = data.find(item => item.key === 'news_ticker');
            if (newsSetting) {
                if(document.getElementById('newsInput')) document.getElementById('newsInput').value = newsSetting.value;
                if(document.getElementById('settingsNewsInput')) document.getElementById('settingsNewsInput').value = newsSetting.value;
            }

            const fallbackSetting = data.find(item => item.key === 'fallback_image');
            if (fallbackSetting && fallbackSetting.value) {
                if(document.getElementById('currentFallbackPreview')){
                    document.getElementById('currentFallbackPreview').src = fallbackSetting.value;
                    document.getElementById('currentFallbackPreview').style.display = 'block';
                    if(document.getElementById('fallbackPlaceholder')) document.getElementById('fallbackPlaceholder').style.display = 'none';
                }
            }

            const sysName = data.find(item => item.key === 'system_name')?.value || 'SabaPost';
            const primaryColor = data.find(item => item.key === 'theme_primary')?.value || '#5c6bc0';
            const sidebarColor = data.find(item => item.key === 'theme_sidebar')?.value || '#2b2b44';
            const bgColor = data.find(item => item.key === 'theme_bg')?.value || '#f4f7fa';
            const cardBgColor = data.find(item => item.key === 'theme_card_bg')?.value || '#ffffff';
            const textColor = data.find(item => item.key === 'theme_text')?.value || '#333333';
            const showIdSetting = data.find(item => item.key === 'show_device_id');
            const isShowId = showIdSetting ? (showIdSetting.value === 'true') : true;

            document.querySelectorAll('.brand span').forEach(el => el.innerText = sysName);
            if(document.getElementById('systemName')) document.getElementById('systemName').value = sysName;
            if(document.getElementById('showDeviceIdToggle')) document.getElementById('showDeviceIdToggle').checked = isShowId;
            
            document.documentElement.style.setProperty('--primary', primaryColor);
            document.documentElement.style.setProperty('--sidebar-bg', sidebarColor);
            document.documentElement.style.setProperty('--bg-color', bgColor);
            document.documentElement.style.setProperty('--card-bg', cardBgColor);
            document.documentElement.style.setProperty('--text-color', textColor);

            const themeColors = {
                'bgColor': bgColor,
                'cardBgColor': cardBgColor,
                'textColor': textColor,
                'primaryColor': primaryColor,
                'sidebarColor': sidebarColor
            };

            for (const [id, colorValue] of Object.entries(themeColors)) {
                if(document.getElementById(id)) {
                    document.getElementById(id).value = colorValue;
                    if(document.getElementById(id + 'Text')) document.getElementById(id + 'Text').value = colorValue;
                }
            }

            const tBg = data.find(item => item.key === 'ticker_bg')?.value || '#000000';
            const tColor = data.find(item => item.key === 'ticker_color')?.value || '#ffffff';
            const tSpeed = data.find(item => item.key === 'ticker_speed')?.value || '50';
            
            ['tickerBgColor', 'settingsTickerBgColor'].forEach(id => { if(document.getElementById(id)) document.getElementById(id).value = tBg; });
            ['tickerTextColor', 'settingsTickerTextColor'].forEach(id => { if(document.getElementById(id)) document.getElementById(id).value = tColor; });
            ['tickerSpeed', 'settingsTickerSpeed'].forEach(id => { if(document.getElementById(id)) document.getElementById(id).value = tSpeed; });
        }
    } catch (err) { console.error("خطأ في جلب الإعدادات:", err); }
}

async function saveThemeSettings() {
    const sysName = document.getElementById('systemName').value;
    const primary = document.getElementById('primaryColor').value;
    const sidebar = document.getElementById('sidebarColor').value;
    const bg = document.getElementById('bgColor').value;
    const cardBg = document.getElementById('cardBgColor').value;
    const textC = document.getElementById('textColor').value;

    try {
        await window.sb.from('settings').upsert([
            { key: 'system_name', value: sysName },
            { key: 'theme_primary', value: primary },
            { key: 'theme_sidebar', value: sidebar },
            { key: 'theme_bg', value: bg },
            { key: 'theme_card_bg', value: cardBg },
            { key: 'theme_text', value: textC },
        ]);
        alert('تم حفظ وتطبيق المظهر بنجاح! 🎨');
        fetchSettings();
    } catch (err) {
        alert('حدث خطأ أثناء الحفظ');
    }
}

async function autoSaveSystemPreferences() {
    const showIdBtn = document.getElementById('showDeviceIdToggle');
    if(!showIdBtn) return;
    try {
        await window.sb.from('settings').upsert([ { key: 'show_device_id', value: showIdBtn.checked.toString() } ]);
    } catch (err) { console.error('حدث خطأ في الاتصال.'); }
}

async function toggleTickerVisibility(source) {
    const isVisible = source === 'dashboard' 
        ? document.getElementById('tickerToggle').checked 
        : document.getElementById('settingsTickerToggle').checked;
    try {
        await window.sb.from('settings').upsert({ key: 'show_ticker', value: isVisible.toString() });
        if(document.getElementById('tickerToggle')) document.getElementById('tickerToggle').checked = isVisible;
        if(document.getElementById('settingsTickerToggle')) document.getElementById('settingsTickerToggle').checked = isVisible;
    } catch (err) { console.error(err); }
}

// 🟢 دالة التحديث مع ميزة التزامن مع لوحة القيادة
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
        
        // التزامن اليدوي لحقول لوحة القيادة (إذا كانت موجودة في الـ DOM حالياً)
        if(document.getElementById('newsInput')) document.getElementById('newsInput').value = text;
        if(document.getElementById('tickerBgColor')) document.getElementById('tickerBgColor').value = bgColor;
        if(document.getElementById('tickerTextColor')) document.getElementById('tickerTextColor').value = txtColor;
        if(document.getElementById('tickerSpeed')) document.getElementById('tickerSpeed').value = speed;
        
        alert('تم التحديث! وتزامنت لوحة القيادة بنجاح 📡');
        
        // التزامن عبر استدعاء دالة لوحة القيادة (كطبقة أمان إضافية)
        if (typeof fetchTickerSettingsForDashboard === 'function') {
            fetchTickerSettingsForDashboard();
        }

    } catch (err) { alert('حدث خطأ: ' + err.message); }
}

async function uploadFallbackImage() {
    const fileInput = document.getElementById('fallbackInput');
    const file = fileInput.files[0];
    if (!file) return alert('الرجاء اختيار صورة الشعار أولاً!');
    const statusLabel = document.getElementById('fallbackStatus');
    statusLabel.innerText = 'جاري رفع الشعار... ⏳';

    try {
        const fileExtension = file.name.split('.').pop();
        const fileName = 'fallback_' + Date.now() + '.' + fileExtension;
        const { data, error } = await window.sb.storage.from('media').upload(fileName, file);
        if (error) throw error;
        const { data: { publicUrl } } = window.sb.storage.from('media').getPublicUrl(fileName);
        await window.sb.from('settings').upsert({ key: 'fallback_image', value: publicUrl });
        statusLabel.innerText = 'تم تعيين الشعار بنجاح! ✅';
        fileInput.value = '';
        fetchSettings(); 
    } catch (err) {
        statusLabel.innerText = 'فشل الرفع: ' + err.message;
    }
}

async function deleteFallbackImage() {
    if (confirm('هل أنت متأكد من حذف الشعار الافتراضي؟ ستعود الشاشات لعرض رسالة "الشاشة متاحة" عند فراغها.')) {
        const statusLabel = document.getElementById('fallbackStatus');
        statusLabel.innerText = 'جاري الحذف... ⏳';
        try {
            await window.sb.from('settings').delete().eq('key', 'fallback_image');
            if(document.getElementById('currentFallbackPreview')) {
                document.getElementById('currentFallbackPreview').style.display = 'none';
                if(document.getElementById('fallbackPlaceholder')) document.getElementById('fallbackPlaceholder').style.display = 'flex';
                document.getElementById('currentFallbackPreview').src = '';
            }
            statusLabel.innerText = 'تم حذف الشعار بنجاح! 🗑️';
        } catch (err) {
            statusLabel.innerText = 'حدث خطأ أثناء الحذف.';
        }
    }
}

// 🔄 تحديث الألوان الحية في المتصفح
function attachColorListeners() {
    document.getElementById('primaryColor')?.addEventListener('input', e => {
        if(document.getElementById('primaryColorText')) document.getElementById('primaryColorText').value = e.target.value;
        document.documentElement.style.setProperty('--primary', e.target.value);
    });

    document.getElementById('sidebarColor')?.addEventListener('input', e => {
        if(document.getElementById('sidebarColorText')) document.getElementById('sidebarColorText').value = e.target.value;
        document.documentElement.style.setProperty('--sidebar-bg', e.target.value);
    });

    ['bgColor', 'cardBgColor', 'textColor'].forEach(id => {
        document.getElementById(id)?.addEventListener('input', e => {
            if(document.getElementById(id + 'Text')) document.getElementById(id + 'Text').value = e.target.value;
            let cssVar = id === 'bgColor' ? '--bg-color' : (id === 'cardBgColor' ? '--card-bg' : '--text-color');
            document.documentElement.style.setProperty(cssVar, e.target.value);
        });
    });
}

// ==========================================
// 👥 قسم إدارة المستخدمين (للمدراء فقط)
// ==========================================

async function fetchUsersList() {
    try {
        const { data: users, error } = await window.sb.from('profiles').select('*').order('created_at', { ascending: false });
        if (error) throw error;
        
        const tbody = document.getElementById('usersListTable');
        if (!tbody) return;
        tbody.innerHTML = '';
        
        // جلب معرف المستخدم الحالي لكي لا يقوم المدير بإيقاف نفسه بالخطأ!
        const { data: { user: currentUser } } = await window.sb.auth.getUser();
        
        users.forEach(u => {
            const isMe = u.id === currentUser?.id;
            
            const roleBadge = u.role === 'admin' 
                ? '<span class="status-badge status-linked" style="background:#e3f2fd; color:#1565c0;">مدير 👑</span>' 
                : '<span class="status-badge status-pending">محرر ✍️</span>';
                
            const statusBadge = u.is_active !== false
                ? '<span class="status-badge status-linked">نشط ✅</span>'
                : '<span class="status-badge" style="background:#ffebee; color:#c62828;">موقوف 🚫</span>';
                
            // أزرار التحكم (نخفيها إذا كان المستخدم هو نفسه المدير الحالي)
            const actionButtons = isMe ? `<span style="color:#888; font-size:11px; font-weight:bold;">(حسابك الحالي)</span>` : `
                <button class="btn btn-primary" style="padding: 5px 8px; font-size:11px;" onclick="toggleUserRole('${u.id}', '${u.role}')" title="تغيير الصلاحية"><i class="fa-solid fa-user-shield"></i></button>
                <button class="btn ${u.is_active !== false ? 'btn-danger' : 'btn-success'}" style="padding: 5px 8px; font-size:11px;" onclick="toggleUserStatus('${u.id}', ${u.is_active !== false})" title="${u.is_active !== false ? 'إيقاف الحساب' : 'تفعيل الحساب'}"><i class="fa-solid ${u.is_active !== false ? 'fa-ban' : 'fa-check'}"></i></button>
            `;

            tbody.innerHTML += `
                <tr>
                    <td><strong>${u.full_name || 'غير محدد'}</strong></td>
                    <td dir="ltr" style="text-align: right; font-size:13px;">${u.email || 'غير متوفر'}</td>
                    <td>${roleBadge}</td>
                    <td>${statusBadge}</td>
                    <td><div style="display:flex; gap:5px; align-items:center;">${actionButtons}</div></td>
                </tr>
            `;
        });
    } catch (err) { console.error('خطأ في جلب المستخدمين:', err); }
}

async function toggleUserRole(userId, currentRole) {
    const newRole = currentRole === 'admin' ? 'editor' : 'admin';
    const msg = currentRole === 'admin' ? 'هل أنت متأكد من سحب صلاحيات الإدارة من هذا المستخدم وإعادته كمحرر؟' : 'هل تريد ترقية هذا المحرر ليصبح مدير نظام؟';
    
    if(confirm(msg)) {
        await window.sb.from('profiles').update({ role: newRole }).eq('id', userId);
        fetchUsersList(); // تحديث الجدول فوراً
    }
}

async function toggleUserStatus(userId, isCurrentlyActive) {
    const newStatus = !isCurrentlyActive;
    const msg = isCurrentlyActive ? 'إيقاف الحساب؟ لن يتمكن هذا المستخدم من تسجيل الدخول للنظام نهائياً.' : 'هل تريد إعادة تفعيل هذا الحساب؟';
    
    if(confirm(msg)) {
        await window.sb.from('profiles').update({ is_active: newStatus }).eq('id', userId);
        fetchUsersList(); // تحديث الجدول فوراً
    }
}

// تشغيل النظام للقسم عند التحميل
initSettings();