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
        const container = document.getElementById('detailedScreensList');
        if (!container) return;

        container.innerHTML = '';
        const now = new Date();
        let onlineCount = 0, offlineCount = 0;

        screens.forEach((s, index) => {
            const displayName = s.screen_name || `شاشة (${s.device_id})`;
            const isLinked = s.status === 'linked';
            const lastPing = new Date(s.last_ping);
            const isOnline = (now - lastPing) / (1000 * 60) <= 2;

            if (isOnline) onlineCount++; else offlineCount++;

            const statusBadge = isOnline
                ? `<span class="badge-neon online"><span class="status-glow online"></span> متصلة الآن</span>`
                : `<span class="badge-neon offline"><span class="status-glow offline"></span> منقطعة</span>`;

            const isPlaying = s.play_status && s.play_status.includes('playing');
            const playBadge = isPlaying
                ? `<span class="badge-neon" style="color: #60a5fa; background: rgba(96, 165, 250, 0.1);"><i class="fa-solid fa-play"></i> يبث الآن</span>`
                : `<span class="badge-neon" style="color: #94a3b8; background: rgba(148, 163, 184, 0.1);"><i class="fa-solid fa-stop"></i> متوقف</span>`;

            const ownerName = s.profiles?.full_name || 'غير معروف';
            const isOwner = (s.created_by === myUserId) || (myRole === 'admin');

            let actions = '';
            if (isOwner) {
                actions = `
                    <div class="action-hub">
                        <button class="action-btn identify" onclick="ScreensModule.identify('${s.device_id}')" title="تعريف الشاشة">
                            <i class="fa-solid fa-id-badge"></i>
                        </button>
                        <button class="action-btn" style="color: ${isLinked ? '#818cf8' : '#fbbf24'}" onclick="ScreensModule.updateStatus('${s.device_id}', '${isLinked ? 'pending' : 'linked'}')" title="تبديل الحالة">
                            <i class="fa-solid fa-power-off"></i>
                        </button>
                        <button class="action-btn edit" onclick="ScreensModule.rename('${s.device_id}', '${s.screen_name || ''}')" title="تعديل الاسم">
                            <i class="fa-solid fa-pen"></i>
                        </button>
                        <button class="action-btn delete" onclick="ScreensModule.delete('${s.device_id}')" title="حذف">
                            <i class="fa-solid fa-trash"></i>
                        </button>
                    </div>
                `;
            } else {
                actions = `<span class="badge-neon" style="background: rgba(255,255,255,0.05); color: #fff;"><i class="fa-solid fa-lock me-2"></i> شاشة محمية</span>`;
            }

            container.innerHTML += `
                <div class="screen-card-row" style="animation-delay: ${index * 0.1}s">
                    <div class="screen-main-info">
                        <div class="screen-avatar">${displayName.charAt(0).toUpperCase()}</div>
                        <div class="screen-text-meta">
                            <h5>${displayName}</h5>
                            <span class="screen-id-badge">${s.device_id}</span>
                            <div class="owner-pill"><i class="fa-solid fa-shield-user"></i> المالك: ${ownerName}</div>
                        </div>
                    </div>
                    
                    <div class="screen-network-info">
                        <div style="font-family: monospace; color: #fff; margin-bottom: 8px;">${s.ip_address || '---.---.---.---'}</div>
                        ${statusBadge}
                    </div>

                    <div class="screen-status-info">
                        <div class="d-flex flex-column gap-2">
                             ${isLinked ? `<span class="badge-neon" style="color: #10b981;"><i class="fa-solid fa-check-double"></i> مصرحة بالبث</span>` : `<span class="badge-neon" style="color: #f59e0b;"><i class="fa-solid fa-hourglass-half"></i> بانتظار الموافقة</span>`}
                             ${isLinked ? playBadge : ''}
                        </div>
                    </div>

                    <div class="screen-time-info" dir="ltr">
                        <div style="font-weight: 900; color: #fff; font-size: 16px;">${lastPing.toLocaleTimeString('ar-YE', { hour: '2-digit', minute: '2-digit' })}</div>
                        <div style="color: rgba(255,255,255,0.4); font-size: 12px;">${lastPing.toLocaleDateString('ar-YE')}</div>
                    </div>

                    <div class="screen-actions">
                        ${actions}
                    </div>
                </div>
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