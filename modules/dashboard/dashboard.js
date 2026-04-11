/**
 * modules/dashboard/dashboard.js
 * النسخة الاحترافية الموحدة: تجنب تداخل الدوال وتوحيد العمليات
 */

window.DashboardModule = {
    /**
     * 1. تهيئة لوحة القيادة
     */
    init() {
        this.loadStatsLayout();
        this.fetchAndRenderAll();

        // 🟢 الحماية البرمجية: إظهار وجلب بيانات شريط الأخبار للمدير فقط
        if (window.currentUserRole === 'admin') {
            const dashboardTicker = document.getElementById('adminDashboardTicker');
            if (dashboardTicker) dashboardTicker.style.display = 'block';

            this.populateTickerTargetSelect();
            this.fetchLastActiveTicker();
            this.fetchTickerHistory();
        }

        this.attachEventListeners();
    },

    /**
     * جلب البيانات ورسمها (دالة موحدة للاستدعاء من الخارج والـ Real-time)
     */
    async fetchAndRenderAll() {
        // جلب الشاشات من الـ API المركزي
        const screens = await window.api.fetchScreens();
        
        // الصلاحيات الحالية
        const myUserId = (await window.sb.auth.getUser()).data?.user?.id;
        const myRole = window.currentUserRole || 'editor';

        this.renderScreensTable(screens, myUserId, myRole);
    },

    attachEventListeners() {
        const tickerToggle = document.getElementById('tickerToggle');
        if (tickerToggle) {
            tickerToggle.addEventListener('change', (e) => this.handleTickerToggle(e));
        }
    },

    async handleTickerToggle(e) {
        const isVisible = e.target.checked;
        const targetId = document.getElementById('tickerTargetScreen')?.value || 'all';
        const message = document.getElementById('newsInput')?.value || "تحديث حالة الشريط";

        try {
            const { error } = await window.sb.from('tickers').insert([{
                message: message,
                show_ticker: isVisible,
                target_screen_id: targetId,
                bg_color: document.getElementById('tickerBgColor')?.value || '#000000',
                text_color: document.getElementById('tickerTextColor')?.value || '#ffffff',
                speed: parseInt(document.getElementById('tickerSpeed')?.value || '50')
            }]);

            if (error) throw error;
            console.log("✅ تم تحديث حالة الشريط");
            
            // 🚀 إرسال أمر بث فوري للشاشات
            window.broadcastCommand('SYNC_TICKER', targetId);
        } catch (err) {
            console.error("خطأ في التحديث:", err.message);
            e.target.checked = !isVisible;
        }
    },

    async fetchLastActiveTicker() {
        const data = await window.api.fetchLastActiveTicker();
        if (data) {
            if (document.getElementById('newsInput')) document.getElementById('newsInput').value = data.message;
            if (document.getElementById('tickerToggle')) document.getElementById('tickerToggle').checked = data.show_ticker;
            if (document.getElementById('tickerBgColor')) document.getElementById('tickerBgColor').value = data.bg_color;
            if (document.getElementById('tickerTextColor')) document.getElementById('tickerTextColor').value = data.text_color;
            if (document.getElementById('tickerSpeed')) document.getElementById('tickerSpeed').value = data.speed;
        }
    },

    async populateTickerTargetSelect() {
        const screens = await window.api.fetchScreens();
        const select = document.getElementById('tickerTargetScreen');
        if (!select || !screens) return;

        select.innerHTML = '<option value="all">بث لجميع الشاشات (موحد)</option>';
        screens.forEach(s => {
            const name = s.screen_name || `شاشة (${s.device_id})`;
            select.innerHTML += `<option value="${s.device_id}">${name}</option>`;
        });
    },

    async loadSpecificScreenTicker() {
        const targetId = document.getElementById('tickerTargetScreen')?.value || 'all';
        const data = await window.api.fetchLastActiveTicker(targetId);
        
        if (data) {
            document.getElementById('newsInput').value = data.message;
            document.getElementById('tickerToggle').checked = data.show_ticker;
            document.getElementById('tickerBgColor').value = data.bg_color;
            document.getElementById('tickerTextColor').value = data.text_color;
            document.getElementById('tickerSpeed').value = data.speed;
        } else if (targetId === 'all') {
            this.fetchLastActiveTicker();
        } else {
            document.getElementById('newsInput').value = '';
        }
    },

    async updateAdvancedTickerDashboard() {
        const btn = document.querySelector('button[onclick="DashboardModule.updateAdvancedTickerDashboard()"]');
        const newsInput = document.getElementById('newsInput');
        const tickerToggle = document.getElementById('tickerToggle');
        const targetId = document.getElementById('tickerTargetScreen')?.value || 'all';

        const text = newsInput?.value.trim() || '';
        if (!text) return alert("الرجاء كتابة نص الخبر أولاً!");

        const isVisible = tickerToggle?.checked || false;
        if (!isVisible) return alert("⚠️ يرجى تفعيل 'إظهار شريط الأخبار' أولاً.");

        try {
            if (btn) {
                btn.disabled = true;
                btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> جاري المعالجة...';
            }

            const { error } = await window.sb.from('tickers').insert([{
                message: text,
                bg_color: document.getElementById('tickerBgColor')?.value || '#000000',
                text_color: document.getElementById('tickerTextColor')?.value || '#ffffff',
                speed: parseInt(document.getElementById('tickerSpeed')?.value || '50'),
                show_ticker: isVisible,
                target_screen_id: targetId
            }]);

            if (error) throw error;
            alert(`تم بث الخبر بنجاح! 📡`);

            // 🚀 إرسال أمر بث فوري للشاشات
            window.broadcastCommand('SYNC_TICKER', targetId);

            newsInput.value = '';
        } catch (err) {
            alert('حدث خطأ: ' + err.message);
        } finally {
            if (btn) {
                btn.disabled = false;
                btn.innerHTML = 'تحديث وبث الأخبار';
            }
        }
    },

    async fetchTickerHistory() {
        const data = await window.api.fetchTickerHistory(10);
        const tbody = document.getElementById('tickerHistoryBody');
        const historyCard = document.getElementById('tickerHistoryCard');

        if (historyCard) historyCard.style.display = 'block';

        if (data && data.length > 0) {
            tbody.innerHTML = '';
            data.forEach(log => {
                const time = new Date(log.created_at).toLocaleTimeString('ar-YE', { hour: '2-digit', minute: '2-digit' });
                const sender = log.profiles?.full_name || 'مدير النظام';
                const screenDisplayName = log.target_screen_id === 'all' ? 'الكل' : (log.screens?.screen_name || log.target_screen_id);

                tbody.innerHTML += `
                    <tr id="row-${log.id}" style="border-bottom: 1px solid rgba(255,255,255,0.05);">
                        <td class="py-3"><span id="text-${log.id}" style="font-size: 14px; color: #fff; font-weight: 600;">${log.message}</span></td>
                        <td style="color: rgba(255,255,255,0.6); font-weight: 600;">${sender}</td>
                        <td style="color: rgba(255,255,255,0.4); font-size: 13px;">${time}</td>
                        <td><span class="badge-neon" style="background:rgba(255,255,255,0.05); color: #fff;">${screenDisplayName}</span></td>
                        <td>
                            <div class="d-flex gap-2">
                                <button class="neon-btn edit" style="width: 32px; height: 32px;" onclick="DashboardModule.editTickerInline('${log.id}')">
                                    <i class="fa-solid fa-pen-to-square"></i>
                                </button>
                                <button class="neon-btn delete" style="width: 32px; height: 32px;" onclick="DashboardModule.deleteTickerRecord('${log.id}')">
                                    <i class="fa-solid fa-trash-can"></i>
                                </button>
                            </div>
                        </td>
                    </tr>
                `;
            });
        } else {
            if (tbody) tbody.innerHTML = '<tr><td colspan="5" class="text-center p-3 text-muted">لا توجد سجلات حالياً</td></tr>';
        }
    },

    async deleteTickerRecord(id) {
        if (!confirm("هل أنت متأكد من حذف هذا الخبر؟")) return;
        try {
            // جلب المعرف قبل الحذف
            const { data: log } = await window.sb.from('tickers').select('target_screen_id').eq('id', id).single();
            
            const { error } = await window.sb.from('tickers').delete().eq('id', id);
            if (error) throw error;
            
            if (log) {
                window.broadcastCommand('SYNC_TICKER', log.target_screen_id);
            }
            
            document.getElementById(`row-${id}`)?.remove();
        } catch (err) { alert("فشل الحذف: " + err.message); }
    },

    async editTickerInline(id) {
        const textElement = document.getElementById(`text-${id}`);
        const oldMessage = textElement ? textElement.innerText : "";
        const newMessage = prompt("تعديل نص الخبر:", oldMessage);
        
        if (!newMessage || newMessage === oldMessage) return;

        try {
            const { error } = await window.sb.from('tickers').update({
                message: newMessage,
                created_at: new Date().toISOString()
            }).eq('id', id).select('target_screen_id').single();

            if (error) throw error;

            // 🚀 إرسال أمر بث فوري للشاشات
            window.broadcastCommand('SYNC_TICKER', 'all'); // التعديل في السجل نعتبره تحديث عام أو نحدد المعرف

            if (textElement) textElement.innerText = newMessage;
            alert("تم التعديل بنجاح! ✅");
        } catch (err) { alert("خطأ في التعديل: " + err.message); }
    },

    loadStatsLayout() {
        const statsHTML = `
            <div class="stats-grid">
                <div class="stat-card-glass">
                    <div class="stat-icon-wrapper"><i class="fa-solid fa-tv"></i></div>
                    <div class="stat-content"><h4 class="totalScreensVal">0</h4><span>إجمالي الشاشات</span></div>
                </div>
                <div class="stat-card-glass" style="--primary: #10b981; --primary-glow: rgba(16, 185, 129, 0.4);">
                    <div class="stat-icon-wrapper"><i class="fa-solid fa-wifi"></i></div>
                    <div class="stat-content"><h4 class="onlineScreensVal">0</h4><span>نشطة الآن</span></div>
                </div>
                <div class="stat-card-glass" style="--primary: #ef4444; --primary-glow: rgba(239, 68, 68, 0.4);">
                    <div class="stat-icon-wrapper"><i class="fa-solid fa-plug-circle-xmark"></i></div>
                    <div class="stat-content"><h4 class="offlineScreensVal">0</h4><span>غير متصلة</span></div>
                </div>
            </div>
        `;
        document.querySelectorAll('.load-stats-here').forEach(container => container.innerHTML = statsHTML);
    },

    renderScreensTable(screens, myUserId, myRole) {
        const tbodyDashboard = document.getElementById('screensList');
        if (tbodyDashboard) tbodyDashboard.innerHTML = '';

        let onlineCount = 0;
        let offlineCount = 0;
        const now = new Date();

        screens.forEach(s => {
            const displayName = s.screen_name || `شاشة (${s.device_id})`;
            const lastPing = new Date(s.last_ping);
            const isOnline = (now - lastPing) / (1000 * 60) <= 2;
            
            if (isOnline) onlineCount++; else offlineCount++;

            const statusBadge = isOnline
                ? `<span class="badge-neon online" style="font-size: 10px; padding: 4px 8px;">متصلة</span>`
                : `<span class="badge-neon offline" style="font-size: 10px; padding: 4px 8px;">منقطعة</span>`;

            if (tbodyDashboard) {
                tbodyDashboard.innerHTML += `
                    <tr>
                        <td>
                            <div class="fw-bold">${displayName}</div>
                            <div class="owner-pill"><i class="fa-solid fa-user"></i> ${s.profiles?.full_name || 'غير معروف'}</div>
                        </td>
                        <td>${statusBadge}</td>
                        <td>${s.status === 'linked' ? '<span class="text-success">يبث</span>' : '-'}</td>
                    </tr>
                `;
            }
        });

        document.querySelectorAll('.totalScreensVal').forEach(el => el.innerText = screens.length);
        document.querySelectorAll('.onlineScreensVal').forEach(el => el.innerText = onlineCount);
        document.querySelectorAll('.offlineScreensVal').forEach(el => el.innerText = offlineCount);
    }
};

// تشغيل الوحدة
DashboardModule.init();