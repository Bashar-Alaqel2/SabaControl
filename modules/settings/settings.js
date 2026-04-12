/**
 * modules/settings/settings.js - إدارة الإعدادات (Namespaced Version)
 */

window.SettingsModule = {
    init() {
        this.fetchSettings();
        this.attachColorListeners();

        if (window.currentUserRole === 'admin') {
            const usersSection = document.getElementById('adminUsersSection');
            const sessionsSection = document.getElementById('adminSessionsSection');
            const settingsTickerContainer = document.getElementById('settingsTickerContainer');

            if (usersSection) {
                usersSection.style.display = 'block';
                this.fetchUsersList();
            }

            if (sessionsSection) {
                sessionsSection.style.display = 'block';
                this.fetchSessions();
            }

            if (settingsTickerContainer) {
                window.TickerModule.render('settingsTickerContainer');
            }
        }
    },

    async fetchSettings() {
        const data = await window.api.fetchSettings();
        if (!data) return;

        const themeMap = {};
        data.forEach(item => themeMap[item.key] = item.value);

        // Removed old ticker settings parsing since it's now dynamically fetched from tickers table

        // الشعار (Fallback)
        if (themeMap['fallback_image']) {
            const preview = document.getElementById('currentFallbackPreview');
            if (preview) {
                preview.src = themeMap['fallback_image'];
                preview.style.display = 'block';
            }
        }

        // تطبيق الألوان
        const root = document.documentElement.style;
        const colors = {
            'primaryColor': themeMap['theme_primary'] || '#940f31',
            'sidebarColor': themeMap['theme_sidebar'] || '#2b2b44',
            'bgColor': themeMap['theme_bg'] || '#f4f7fa',
            'cardBgColor': themeMap['theme_card_bg'] || '#ffffff',
            'textColor': themeMap['theme_text'] || '#333333'
        };

        Object.entries(colors).forEach(([id, val]) => {
            const picker = document.getElementById(id);
            const circle = document.getElementById(id + 'Circle');
            const hexText = document.getElementById(id + 'Hex');

            if (picker) picker.value = val;
            if (circle) circle.style.backgroundColor = val; // تغيير من borderColor إلى backgroundColor للدوائر الجديدة
            if (hexText) hexText.innerText = val.toUpperCase();
        });
    },

    async saveTheme() {
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

            // 🚀 إرسال أمر بث فوري لتحديث الهوية البصرية
            window.broadcastCommand('SYNC_SETTINGS', 'all');

            alert('تم الحفظ بنجاح! 🎨');
            this.fetchSettings();
        } catch (err) { alert('خطأ في الحفظ'); }
    },

    async fetchUsersList() {
        try {
            const { data: users, error } = await window.sb.from('profiles').select('*').order('created_at', { ascending: false });
            if (error) throw error;

            const tbody = document.getElementById('usersListTable');
            if (!tbody) return;
            tbody.innerHTML = '';

            const currentUser = (await window.sb.auth.getUser()).data?.user;

            users.forEach(u => {
                const isMe = u.id === currentUser?.id;
                const statusBadge = u.is_active !== false
                    ? '<span class="badge-neon online" style="font-size: 10px; padding: 4px 10px;">نشط</span>'
                    : '<span class="badge-neon offline" style="font-size: 10px; padding: 4px 10px;">موقوف</span>';

                const roleBadge = u.role === 'admin'
                    ? '<span class="badge-role badge-admin">مدير النظام</span>'
                    : '<span class="badge-role badge-editor">محرر محتوى</span>';

                tbody.innerHTML += `
                    <tr style="border-bottom: 1px solid rgba(255,255,255,0.05);">
                        <td class="py-4" style="font-weight: 800; color: #fff;">${u.full_name || 'موظف غير مسمى'}</td>
                        <td style="color: rgba(255,255,255,0.6); font-family: monospace;">${u.email}</td>
                        <td>${roleBadge}</td>
                        <td>${statusBadge}</td>
                        <td>
                            <div class="d-flex gap-2 justify-content-center">
                                ${isMe ? '<span class="text-muted small">أنت حالياً</span>' : `
                                    <button onclick="SettingsModule.toggleRole('${u.id}', '${u.role}')" class="action-btn edit" title="تغيير الرتبة">
                                        <i class="fa-solid fa-user-shield"></i>
                                    </button>
                                    <button onclick="SettingsModule.toggleStatus('${u.id}', ${u.is_active !== false})" class="action-btn delete" title="إيقاف/تفعيل الحساب">
                                        <i class="fa-solid fa-power-off"></i>
                                    </button>
                                `}
                            </div>
                        </td>
                    </tr>`;
            });
        } catch (err) { console.error(err); }
    },

    async toggleRole(userId, currentRole) {
        const newRole = currentRole === 'admin' ? 'editor' : 'admin';
        if (!confirm(`تحويل إلى ${newRole}؟`)) return;
        try {
            await window.sb.from('profiles').update({ role: newRole }).eq('id', userId);
            this.fetchUsersList();
        } catch (err) { alert("فشل التحديث"); }
    },

    async toggleStatus(userId, isActive) {
        if (!confirm('تغيير حالة الحساب؟')) return;
        try {
            await window.sb.from('profiles').update({ is_active: !isActive }).eq('id', userId);
            this.fetchUsersList();
        } catch (err) { alert("فشل التحديث"); }
    },

    async fetchSessions() {
        const data = await window.api.fetchSessions();
        const tbody = document.getElementById('activeSessionsTable');
        if (!tbody) return;
        tbody.innerHTML = '';

        data.forEach(s => {
            tbody.innerHTML += `
                <tr style="border-bottom: 1px solid rgba(255,255,255,0.05);">
                    <td class="py-3" style="font-weight: 600;">${s.user_email}</td>
                    <td class="text-muted" style="font-size: 11px;">${s.browser} / ${s.os}</td>
                    <td style="color: var(--primary); font-family: monospace;">${new Date(s.created_at).toLocaleTimeString('ar-YE')}</td>
                    <td>
                         <button onclick="SettingsModule.terminateSession('${s.id}')" class="action-btn delete" title="إنهاء الجلسة">
                            <i class="fa-solid fa-user-slash"></i>
                         </button>
                    </td>
                </tr>`;
        });
    },

    async terminateSession(id) {
        if (!confirm("طرد المستخدم؟")) return;
        await window.sb.from('user_sessions').delete().eq('id', id);
        this.fetchSessions();
    },

    // -- Advanced Ticker Functions moved to core/ticker.js --
    async uploadFallbackImage() {
        const fileInput = document.getElementById('fallbackInput');
        const file = fileInput?.files[0];
        if (!file) return alert('اختر صورة أولاً');

        try {
            const fileName = `fallback_${Date.now()}.${file.name.split('.').pop()}`;
            const { data, error } = await window.sb.storage.from('media').upload(fileName, file);
            if (error) throw error;

            const { data: { publicUrl } } = window.sb.storage.from('media').getPublicUrl(fileName);
            await window.sb.from('settings').upsert({ key: 'fallback_image', value: publicUrl });

            // 🚀 إرسال أمر بث فوري لتحديث الشعار المرجعي
            window.broadcastCommand('SYNC_SETTINGS', 'all');

            alert("تم رفع الشعار بنجاح ✅");
            this.fetchSettings();
        } catch (err) { alert("فشل الرفع"); }
    },

    async deleteFallbackImage() {
        if (!confirm('هل تريد حذف الشعار الحالي؟')) return;
        try {
            await window.sb.from('settings').delete().eq('key', 'fallback_image');

            // 🚀 إرسال أمر تعميم التحديث
            window.broadcastCommand('SYNC_SETTINGS', 'all');

            const preview = document.getElementById('currentFallbackPreview');
            if (preview) { preview.src = ''; preview.style.display = 'none'; }

            alert('تم حذف الشعار بنجاح!');
        } catch (err) { alert("خطأ في الحذف"); }
    },

    attachColorListeners() {
        const ids = ['primaryColor', 'sidebarColor', 'bgColor', 'cardBgColor', 'textColor'];
        ids.forEach(id => {
            const picker = document.getElementById(id);
            if (picker) {
                picker.addEventListener('input', (e) => {
                    const circle = document.getElementById(id + 'Circle');
                    const hexText = document.getElementById(id + 'Hex');
                    const val = e.target.value;

                    if (circle) circle.style.backgroundColor = val;
                    if (hexText) hexText.innerText = val.toUpperCase();

                    const cssVar = id === 'primaryColor' ? '--primary' : (id === 'sidebarColor' ? '--sidebar-bg-color' : (id === 'bgColor' ? '--bg-color' : (id === 'cardBgColor' ? '--card-bg' : '--text-color')));
                    document.documentElement.style.setProperty(cssVar, val);
                });
            }
        });
    }
};

// تشغيل الوحدة
SettingsModule.init();