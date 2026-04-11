/**
 * modules/screens/screens.js - إدارة الشاشات (Namespaced Version)
 */

window.ScreensModule = {
    init() {
        // إذا كان هناك حاجة لشحن الإحصائيات، نتأكد أنها متاحة
        if (window.DashboardModule && typeof window.DashboardModule.loadStatsLayout === 'function') {
            window.DashboardModule.loadStatsLayout();
        }

        this.fetchAndRender();
        this.initRealtime();

        // تحديث دوري كل دقيقة
        setInterval(() => this.fetchAndRender(), 60000);
    },

    async fetchAndRender() {
        const screens = await window.api.fetchScreens();

        const myUserId = (await window.sb.auth.getUser()).data?.user?.id;
        const myRole = window.currentUserRole || 'editor';

        this.renderDetailedTable(screens, myUserId, myRole);

        // تحديث الاختيارات في إدارة المحتوى إذا كان المديول محّملاً
        if (typeof updateTargetSelect === 'function') updateTargetSelect(screens);
    },

    renderDetailedTable(screens, myUserId, myRole) {
        const tbodyDetailed = document.getElementById('detailedScreensList');
        if (!tbodyDetailed) return;

        tbodyDetailed.innerHTML = '';
        const now = new Date();
        let onlineCount = 0, offlineCount = 0;

        screens.forEach(s => {
            const displayName = s.screen_name || `شاشة (${s.device_id})`;
            const isLinked = s.status === 'linked';
            const lastPing = new Date(s.last_ping);
            const isOnline = (now - lastPing) / (1000 * 60) <= 2;

            if (isOnline) onlineCount++; else offlineCount++;

            const statusBadge = isOnline
                ? `<span class="badge-glass" style="background:#e8fdf5; color:#10b981; border:1px solid #d1fae5;"><span class="status-glow online"></span> متصلة</span>`
                : `<span class="badge-glass" style="background:#fef2f2; color:#ef4444; border:1px solid #fee2e2;"><span class="status-glow offline"></span> منقطعة</span>`;

            const isPlaying = s.play_status && s.play_status.includes('playing');
            const playBadge = isPlaying
                ? `<span class="badge-glass" style="background:#eff6ff; color:#3b82f6; border:1px solid #dbeafe;"><i class="fa-solid fa-play me-1"></i> يبث الآن</span>`
                : `<span class="badge-glass" style="background:#f1f5f9; color:#64748b; border:1px solid #e2e8f0;"><i class="fa-solid fa-stop me-1"></i> متوقف</span>`;

            const ownerName = s.profiles?.full_name || 'غير معروف';
            const isOwner = (s.created_by === myUserId) || (myRole === 'admin');

            let actions = '';
            if (isOwner) {
                actions = `
                    <button class="action-circle-btn text-info shadow-sm" onclick="ScreensModule.identify('${s.device_id}')" title="تعريف الشاشة">
                        <i class="fa-solid fa-id-badge"></i>
                    </button>
                    <button class="action-circle-btn text-danger shadow-sm" onclick="ScreensModule.updateStatus('${s.device_id}', '${isLinked ? 'pending' : 'linked'}')" title="تبديل الحالة">
                        <i class="fa-solid fa-power-off"></i>
                    </button>
                    <button class="action-circle-btn text-warning shadow-sm" onclick="ScreensModule.rename('${s.device_id}', '${s.screen_name || ''}')" title="تعديل الاسم">
                        <i class="fa-solid fa-pen"></i>
                    </button>
                    <button class="action-circle-btn text-danger shadow-sm" onclick="ScreensModule.delete('${s.device_id}')" title="حذف">
                        <i class="fa-solid fa-trash"></i>
                    </button>
                `;
            } else {
                actions = `<span class="badge-glass bg-light"><i class="fa-solid fa-lock me-1"></i> محمية</span>`;
            }

            tbodyDetailed.innerHTML += `
                <tr class="detailed-table-row">
                    <td class="ps-3">
                        <div class="fw-bold text-dark" style="font-size: 15px;">${displayName}</div>
                        <span class="screen-id-badge">${s.device_id}</span>
                        <div class="owner-pill mt-2"><i class="fa-solid fa-user-tie"></i> المالك: ${ownerName}</div>
                    </td>
                    <td>
                        <code class="small text-muted">${s.ip_address || '---.---.---.---'}</code><br>
                        ${statusBadge}
                    </td>
                    <td>
                        <div class="d-flex flex-column gap-1">
                            ${isLinked ? `<span class="badge-glass bg-light text-success fw-bold" style="font-size:10px;">مصرحة بالبث ✓</span>` : `<span class="badge-glass bg-light text-warning fw-bold" style="font-size:10px;">بانتظار الموافقة ⏳</span>`}
                            ${isLinked ? playBadge : ''}
                        </div>
                    </td>
                    <td dir="ltr" class="text-end pe-4">
                        <div class="small fw-bold">${lastPing.toLocaleTimeString('ar-YE', { hour: '2-digit', minute: '2-digit' })}</div>
                        <div class="small text-muted" style="font-size: 10px;">${lastPing.toLocaleDateString('ar-YE')}</div>
                    </td>
                    <td><div class="d-flex gap-2 justify-content-center">${actions}</div></td>
                </tr>
            `;
        });

        // تحديث العدادات إذا كانت موجودة في الصفحة
        document.querySelectorAll('.totalScreensVal').forEach(el => el.innerText = screens.length);
        document.querySelectorAll('.onlineScreensVal').forEach(el => el.innerText = onlineCount);
        document.querySelectorAll('.offlineScreensVal').forEach(el => el.innerText = offlineCount);
    },

    async updateStatus(id, status) {
        try {
            const { error } = await window.sb.from('screens').update({ status }).eq('device_id', id);
            if (error) throw error;
            this.fetchAndRender();
        } catch (err) { alert("فشل في تحديث الحالة."); }
    },

    async delete(id) {
        if (!confirm('هل أنت متأكد من الحذف؟')) return;
        try {
            const { error } = await window.sb.from('screens').delete().eq('device_id', id);
            if (error) throw error;
            this.fetchAndRender();
        } catch (err) { alert("فشل في حذف الشاشة."); }
    },

    async rename(deviceId, currentName) {
        const newName = prompt('أدخل الاسم الجديد:', currentName);
        if (newName === null) return;
        try {
            const { error } = await window.sb.from('screens').update({ screen_name: newName }).eq('device_id', deviceId);
            if (error) throw error;
            this.fetchAndRender();
        } catch (err) { alert('فشل تغيير الاسم.'); }
    },

    async identify(deviceId) {
        try {
            window.broadcastCommand('SHOW_ID', deviceId);
            console.log(`📡 Identify command sent to: ${deviceId}`);
        } catch (err) { console.error(err); }
    },

    openModal() {
        const modal = document.getElementById('addScreenModal');
        if (modal) modal.style.display = 'flex';
    },

    closeModal() {
        const modal = document.getElementById('addScreenModal');
        if (modal) modal.style.display = 'none';
    },

    async submitNewScreen() {
        const id = document.getElementById('newScreenId').value.trim();
        const name = document.getElementById('newScreenName').value.trim();
        if (!id || !name) return alert('أدخل البيانات كاملة!');

        try {
            const { error } = await window.sb.from('screens').upsert([
                { device_id: id, screen_name: name, status: 'linked', last_ping: new Date().toISOString() }
            ]);
            if (error) throw error;
            this.closeModal();
            this.fetchAndRender();
        } catch (err) { alert('خطأ: ' + err.message); }
    },

    initRealtime() {
        window.sb.channel('screens-module-sync')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'screens' }, () => {
                this.fetchAndRender();
            })
            .subscribe();
    }
};

// تشغيل الوحدة
ScreensModule.init();